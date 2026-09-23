import hashlib
import hmac
import secrets
import json
from sqlalchemy import select, insert, delete
from .store import users, sessions, uid, dump, safe_user

ROLES={'chief','responsable','director','judge','trainee','secretariat','regie','speaker','commission'}
ADMIN={'chief','responsable','director'}
SPORT={'chief','responsable'}
PREPARATION=ADMIN|{'secretariat'}
REGIE=ADMIN|{'regie'}

class Problem(Exception):
    def __init__(self,message,status=422):
        self.message=message; self.status=status
        super().__init__(message)


def require(actor,allowed):
    if not set(actor['roles']) & set(allowed):
        raise Problem('Cette action ne relève pas de vos habilitations.',403)


def hash_code(code,salt=None):
    salt=salt or secrets.token_hex(16)
    return salt+':'+hashlib.pbkdf2_hmac('sha256',code.encode(),salt.encode(),240000).hex()


def matches(code,stored):
    return hmac.compare_digest(hash_code(code,stored.split(':')[0]),stored)


def add_user(store,conn,name,roles,code,approved=False):
    if not isinstance(code,str) or len(code)<4 or len(code)>128:
        raise Problem('Le code personnel doit contenir de 4 à 128 caractères.')
    if not name.strip() or not roles or not set(roles)<=ROLES:
        raise Problem('Nom et fonctions valides obligatoires.')
    if 'director' in roles and set(roles)&{'chief','responsable','judge','trainee'}:
        raise Problem('Le directeur ne peut cumuler une fonction de vote.')
    if 'trainee' in roles and set(roles)&{'chief','responsable','judge'}:
        raise Problem('Un stagiaire ne siège pas simultanément comme juge officiel.')
    rows=list(conn.execute(select(users)).mappings())
    if any(matches(code,row['code_hash']) for row in rows):
        raise Problem('Ce code personnel est déjà utilisé.',409)
    if 'chief' in roles and any('chief' in json.loads(row['roles']) for row in rows):
        raise Problem('Un chef existe déjà pour cet événement.',409)
    user={'id':uid(),'name':name.strip(),'roles':list(dict.fromkeys(roles)),'approved':approved,'active':True}
    conn.execute(insert(users).values(**{**user,'roles':dump(user['roles']),'code_hash':hash_code(code),'created_at':store.clock()}))
    return user


def new_session(store,conn,user_id):
    token=secrets.token_urlsafe(40)
    conn.execute(insert(sessions).values(id=hashlib.sha256(token.encode()).hexdigest(),user_id=user_id,expires=store.clock()+16*3600))
    return token


def authenticate(store,token):
    if not token: raise Problem('Connectez-vous avec votre code personnel.',401)
    ident=hashlib.sha256(token.encode()).hexdigest()
    with store.engine.connect() as conn:
        row=conn.execute(select(users).join(sessions,sessions.c.user_id==users.c.id).where(sessions.c.id==ident,sessions.c.expires>store.clock(),users.c.active==1)).mappings().first()
        if row is None: raise Problem('Session expirée. Reconnectez-vous.',401)
        if not row['approved']: raise Problem('Votre accès attend la validation du chef des juges.',403)
        return safe_user(row)
