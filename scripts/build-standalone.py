#!/usr/bin/env python3
"""Build the isolated test application; production sources are never changed."""
import base64
import hashlib
import importlib.util
import json
import re
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / 'standalone' / '.build'
OUT = ROOT / 'livrables' / 'FIBDA-autonome'
WORK.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)
tsconfig = json.loads((ROOT / 'frontend/tsconfig.json').read_text())
tsconfig['include'] = ['*.ts', '*.tsx']
(WORK / 'tsconfig.json').write_text(json.dumps(tsconfig))

def source_commit():
    # An extracted archive must not inherit the repository of its parent folder.
    if not (ROOT / '.git').exists():
        return None
    try:
        top = subprocess.check_output(['git', 'rev-parse', '--show-toplevel'], cwd=ROOT, text=True, stderr=subprocess.DEVNULL).strip()
        if Path(top).resolve() != ROOT:
            return None
        return subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True, stderr=subprocess.DEVNULL).strip()
    except (OSError, subprocess.CalledProcessError):
        return None

def asset(name):
    path = ROOT / 'frontend/public/assets' / name
    mime = {'jpg':'image/jpeg','png':'image/png','ttf':'font/ttf'}[path.suffix[1:]]
    return 'data:' + mime + ';base64,' + base64.b64encode(path.read_bytes()).decode()

logo = asset('fibda-logo.jpg')
for source in (ROOT / 'frontend/src').glob('*'):
    if source.suffix not in {'.ts', '.tsx', '.css'} or '.test.' in source.name:
        continue
    text = source.read_text()
    if source.suffix == '.tsx' and '<img' in text:
        text = 'import { LocalImage } from "./browser";\n' + text.replace('<img', '<LocalImage')
    if source.suffix == '.tsx' and re.search(r'<a[ >\n]', text):
        text = 'import { LocalLink } from "./browser";\n' + re.sub(r'<a(?=[ >\n])', '<LocalLink', text).replace('</a>', '</LocalLink>')
    for name in ['fibda-logo.jpg','fibda-embleme.png','Manrope-Variable.ttf']:
        if '/assets/' + name in text:
            text = text.replace('/assets/'+name, asset(name))
    if source.name == 'App.tsx':
        text = text.replace('const screen = location.pathname.match(', 'const screen = new URLSearchParams(location.search).get("screen") || location.pathname.match(')
        start = text.index('    let disposed = false;')
        end = text.index('  }, [user?.id, refresh]);', start)
        text = text[:start] + '''    const reload = () => refresh().catch(() => {});
    const poll = setInterval(reload, 2000);
    window.addEventListener("fibda-local-change", reload);
    return () => { clearInterval(poll); window.removeEventListener("fibda-local-change", reload); };
''' + text[end:]
        text = text.replace('Connecté au serveur','Connecté · copie locale')
        text = text.replace('Accusé de réception serveur reçu.','Bulletin enregistré dans ce navigateur.')
        text = text.replace('Modification enregistrée sur le serveur.','Modification enregistrée dans ce navigateur.')
        text = text.replace('L’état a changé sur un autre appareil.', 'L’état de cette copie a changé.')
        text = text.replace('Serveur inaccessible : ', 'Copie locale indisponible : ')
        text = text.replace('État serveur v','Copie locale v')
        text = text.replace('Enregistrement sur le serveur…','Enregistrement local…')
        text = text.replace('Journal du serveur','Journal de cette copie')
        text = text.replace('sur l’ordinateur serveur.', 'dans cette copie locale.')
        text = text.replace('sur le serveur.', 'sur cet appareil.')
        text = text.replace('le serveur.', 'le stockage local.')
        text = text.replace('sur le serveur de', 'dans cette copie de')
    if source.name == 'Judge.tsx':
        text = text.replace('Bulletin reçu et verrouillé par le serveur.', 'Bulletin enregistré et verrouillé sur cet appareil.')
    if source.name == 'Regie.tsx':
        text = text.replace('<small>Ouvrir dans une autre fenêtre</small>', '<small>{id === "speaker" ? "Ouvrir ici · retour par le navigateur" : "Ouvrir dans une autre fenêtre"}</small>')
    if source.name == 'main.tsx':
        text = '''import { boot, TestGuide } from './browser';
import './standalone.css';
''' + text
        text = text.replace('sur le serveur.', 'dans ce navigateur.')
        text = text.replace('createRoot(document.getElementById("root")!).render(', 'boot().then(() => { document.getElementById("boot")?.remove(); createRoot(document.getElementById("root")!).render(')
        text = text.replace('<App />', '<TestGuide /><App />')
        text += '''\n}).catch(error => { const el = document.getElementById('boot-status'); if(el) el.textContent = 'Ouverture impossible : ' + error.message + '. Ouvrez ce fichier dans un navigateur récent avec le stockage local autorisé.'; console.error(error); });\n'''
    if source.name == 'Preparation.tsx':
        text = re.sub(r'<Field label="Dossier de sauvegarde sur l’ordinateur serveur">.*?</Field>', '<p className="muted">Copie autonome : les données sont conservées dans ce navigateur. Exportez une sauvegarde ZIP dans Documents ; aucun dossier serveur n’est utilisé.</p>', text, flags=re.S)
        text = text.replace('Le serveur contrôle la composition et les retraits.', 'Le moteur embarqué contrôle la composition et les retraits.')
        text = text.replace('await api("/restore", { method: "POST", body: fd });\n                await refresh();', 'await api("/restore", { method: "POST", body: fd });')
        text = text.replace('serveur de l’état précédent et déconnecte tous les appareils.', 'locale de l’état précédent et déconnecte cette session.')
        text = text.replace('la déconnexion des appareils', 'la déconnexion de cette copie')
    if source.name == 'drafts.ts':
        text = text.replace('fibda-ballot-drafts', 'fibda-autonome-ballot-drafts')
    if source.name == 'ConnectionHelp.tsx':
        text = '''export function ConnectionHelp() { return <details className="connection-help"><summary>Aide · essais dans cette copie</summary><ol><li>Choisissez un code à quatre chiffres dans « Guide de test ».</li><li>Classez les dossards en les déplaçant, ou touchez un dossard puis un rang.</li><li>Annulez et recommencez librement, puis validez une seule fois.</li><li>Attendez la confirmation « enregistré et verrouillé sur cet appareil ».</li></ol><p>Les données et les codes sont réservés aux essais. Chaque appareil utilise sa propre copie. Exportez régulièrement une sauvegarde dans Documents.</p></details>; }'''
    (WORK / source.name).write_text(text)

for source in (ROOT / 'standalone/src').glob('*'):
    shutil.copy2(source, WORK/source.name)

node_script = '''const esbuild = require(%s);
esbuild.build({entryPoints:[%s],bundle:true,format:'iife',outfile:%s,minify:true,jsx:'automatic',nodePaths:[%s],define:{'process.env.NODE_ENV':'"production"'},target:['es2022']}).catch(()=>process.exit(1));''' % tuple(json.dumps(str(p)) for p in [ROOT/'frontend/node_modules/esbuild',WORK/'main.tsx',WORK/'app.js',ROOT/'frontend/node_modules'])
(WORK/'bundle.cjs').write_text(node_script)
subprocess.run(['node',str(WORK/'bundle.cjs')],check=True,cwd=ROOT)
spec = importlib.util.spec_from_file_location('runtime_build', ROOT/'scripts/build-runtime.py')
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)
files = {'/home/pyodide/fibda/'+p.name:p.read_text() for p in (ROOT/'backend/fibda').glob('*') if p.suffix in {'.py','.json'}}
files.update({'/home/pyodide/'+p.name:p.read_text() for p in (ROOT/'standalone/python').glob('*.py')})
runtime_html = runtime.build_runtime_scripts(files=files)
js = (WORK/'app.js').read_text().replace('</script','<\\/script')
css = (WORK/'app.css').read_text()
html = '''<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="color-scheme" content="light"><title>FIBDA — application autonome de test</title><style>html,body{margin:0;background:#e2ede6;color:#192c2b}#boot{max-width:560px;margin:12vh auto;padding:30px;font:17px/1.6 system-ui}#boot img{width:150px;background:white;padding:16px;border-radius:18px}#boot h1{font-size:28px}#boot-status{font-weight:600}</style><style>''' + css + '''</style></head><body><div id="boot"><img src="''' + logo + '''" alt="FIBDA"><h1>Votre espace de test FIBDA</h1><p id="boot-status" role="status">Chargement du moteur sportif embarqué…</p><p>Quelques secondes à la première ouverture. Aucune connexion Internet nécessaire après le chargement du fichier.</p><noscript>Activez JavaScript pour utiliser l’application.</noscript></div><div id="root"></div>''' + runtime_html + '<script>window.FIBDAStandalone={logo:'+json.dumps(logo)+'};</script><script>'+js+'</script></body></html>'
target=OUT/'FIBDA-application-autonome.html'
target.write_text(html)
manifest={'version':'2026-09-23','bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'source_commit':source_commit(),'source_files':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in (ROOT/'backend/fibda').glob('*') if p.suffix in {'.py','.json'}},'note':'Version de test locale : moteur Python original, stockage navigateur, aucune synchronisation entre appareils.'}
manifest['adapted_sources']={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for folder in ['frontend/src','standalone/src','standalone/python','scripts'] for p in (ROOT/folder).glob('*') if p.is_file() and p.suffix in {'.py','.ts','.tsx','.css'}}
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
print(json.dumps({'html':str(target),'bytes':manifest['bytes'],'sha256':manifest['sha256']},indent=2))
