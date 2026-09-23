#!/usr/bin/env python3
"""Local launcher with explicit HTTPS for shared-network use."""
import argparse
import ipaddress
import os
from pathlib import Path
import socket
import sqlite3
import ssl
import sys
import time
from urllib.parse import urlsplit

ROOT = Path(getattr(sys, '_MEIPASS', Path(__file__).resolve().parent))
sys.path.insert(0, str(ROOT / 'backend'))


def default_data_dir(demo=False):
    if sys.platform == 'win32':
        base = Path(os.environ.get('LOCALAPPDATA', Path.home() / 'AppData' / 'Local'))
    elif sys.platform == 'darwin':
        base = Path.home() / 'Library' / 'Application Support'
    else:
        base = Path(os.environ.get('XDG_DATA_HOME', Path.home() / '.local' / 'share'))
    return base / 'FIBDA' / 'Bodybuilding' / ('demo' if demo else 'official')


def is_loopback(host):
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return host.lower() == 'localhost'


def validate_config(args):
    behind_proxy = getattr(args, 'behind_proxy', False)
    public_url = getattr(args, 'public_url', None)
    if bool(args.cert) != bool(args.key):
        raise ValueError('--cert et --key doivent être fournis ensemble')
    if behind_proxy:
        # Mode hébergeur (Railway) : le TLS est terminé par le proxy de la plateforme,
        # l'application reçoit du HTTP en clair sur un port interne jamais exposé directement.
        if args.cert or args.key:
            raise ValueError('--behind-proxy : le TLS est terminé par le proxy, --cert/--key interdits')
        if not public_url:
            raise ValueError('--behind-proxy exige --public-url https://… (adresse publique servie par le proxy)')
    elif not is_loopback(args.host) and not (args.cert and args.key):
        raise ValueError('Écoute réseau refusée sans HTTPS : fournir --cert et --key')
    if not 1 <= args.port <= 65535:
        raise ValueError('Port attendu entre 1 et 65535')
    if not is_loopback(args.host) and not public_url:
        raise ValueError('Écoute réseau : --public-url HTTPS correspondant au certificat est obligatoire')
    if public_url:
        parsed = urlsplit(public_url)
        if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ('', '/'):
            raise ValueError('--public-url : URL HTTPS sans chemin')
        # Derrière un proxy, le port public (443) n'est pas celui d'écoute de l'application.
        if not behind_proxy and (parsed.port or 443) != args.port:
            raise ValueError('--public-url : URL HTTPS sans chemin, avec le port du serveur')
        if not args.cert and not behind_proxy:
            raise ValueError('--public-url exige --cert et --key')
    if args.cert:
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(str(args.cert), str(args.key))
        if public_url:
            validate_certificate_name(ssl._ssl._test_decode_cert(str(args.cert)), parsed.hostname)


def validate_certificate_name(cert, hostname):
    # Exact SAN matching deliberately excludes wildcard and legacy CN certificates.
    hostname = hostname.encode('idna').decode('ascii').lower()
    try:
        address = ipaddress.ip_address(hostname)
    except ValueError:
        address = None
    matched = False
    for kind, name in cert.get('subjectAltName', ()):
        if address is None and kind == 'DNS' and name.lower() == hostname:
            matched = True
        elif address is not None and kind == 'IP Address':
            try:
                matched = matched or ipaddress.ip_address(name) == address
            except ValueError:
                pass
    if not matched:
        raise ssl.CertificateError('Le nom public doit correspondre exactement à un SAN du certificat (sans joker)')
    now = time.time()
    if cert.get('notBefore') and now < ssl.cert_time_to_seconds(cert['notBefore']):
        raise ssl.CertificateError('Certificat pas encore valide')
    if cert.get('notAfter') and now >= ssl.cert_time_to_seconds(cert['notAfter']):
        raise ssl.CertificateError('Certificat expiré')


def check_sqlite(host, behind_proxy=False):
    if sqlite3.sqlite_version_info < (3, 51, 3):
        message = f'SQLite {sqlite3.sqlite_version} : version 3.51.3 minimum requise pour le réseau ; mettre à jour Python et SQLite.'
        # Derrière un proxy le serveur est exposé à Internet quel que soit l'hôte d'écoute : refus.
        if not is_loopback(host) or behind_proxy:
            raise ValueError(message)
        print('AVERTISSEMENT : ' + message)


def diagnostics(directory, host, port, behind_proxy=False):
    check_sqlite(host, behind_proxy)
    directory.mkdir(parents=True, exist_ok=True)
    probe = directory / '.write-probe'
    try:
        probe.write_text('ok'); probe.unlink()
    except OSError as exc:
        raise ValueError('Dossier de données non accessible en écriture') from exc
    with sqlite3.connect(':memory:') as connection:
        if connection.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            raise ValueError('Autocontrôle SQLite échoué')
    db = directory / 'competition.sqlite3'
    if db.exists():
        with sqlite3.connect(f'file:{db}?mode=ro',uri=True) as connection:
            if connection.execute('PRAGMA quick_check').fetchone()[0] != 'ok':
                raise ValueError('Base existante : contrôle SQLite échoué')
    address = socket.getaddrinfo(host,port,type=socket.SOCK_STREAM,flags=socket.AI_PASSIVE)[0]
    with socket.socket(address[0],address[1],address[2]) as probe_socket:
        # POSIX conserves TIME_WAIT après l'arrêt ; cela ne doit pas empêcher la reprise.
        if os.name != 'nt':probe_socket.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1)
        probe_socket.bind(address[4])
    print(f'SQLite {sqlite3.sqlite_version} : contrôle local réussi. Dossier : {directory}')
    print('Port local disponible. La connexion des téléphones et le réseau Wi-Fi restent à vérifier.')


def display_url(host,port,secure,public_url=None):
    if public_url:
        return public_url.rstrip('/')
    if not is_loopback(host):
        raise ValueError('Adresse réseau explicite requise ; aucune adresse DNS ou IP n’est déduite')
    shown = '['+host+']' if ':' in host else host
    return f"{'https' if secure else 'http'}://{shown}:{port}"


def main(argv=None):
    parser = argparse.ArgumentParser(description='Serveur local FIBDA Bodybuilding')
    parser.add_argument('--demo',action='store_true')
    parser.add_argument('--data-dir',type=Path)
    parser.add_argument('--host',default='127.0.0.1')
    parser.add_argument('--port',type=int,default=8443)
    parser.add_argument('--public-url',help='URL HTTPS configurée dans le DNS local et couverte par le certificat')
    parser.add_argument('--cert',type=Path); parser.add_argument('--key',type=Path)
    parser.add_argument('--behind-proxy',action='store_true',help='Hébergeur (Railway) : TLS terminé par le proxy de la plateforme, écoute HTTP sur --port (Railway fournit $PORT : --port $PORT)')
    args = parser.parse_args(argv)
    try:
        validate_config(args)
        directory = (args.data_dir or default_data_dir(args.demo)).expanduser().resolve()
        diagnostics(directory,args.host,args.port,args.behind_proxy)
    except (ValueError,OSError,ssl.SSLError) as exc:
        parser.error(str(exc))
    from fibda.app import create_app
    import uvicorn
    application = create_app(directory,demo=args.demo,behind_proxy=args.behind_proxy)
    url = display_url(args.host,args.port,bool(args.cert),args.public_url)
    print(('DÉMONSTRATION' if args.demo else 'COMPÉTITION')+' : '+url)
    if args.behind_proxy:
        print(f'MODE PROXY : TLS terminé par le proxy ; écoute HTTP sur {args.host}:{args.port}. Ne jamais exposer ce port directement.')
    elif is_loopback(args.host):
        print('Adresse utilisable uniquement sur cet ordinateur.')
    try:
        import qrcode
        qr=qrcode.QRCode();qr.add_data(url);qr.make(fit=True);qr.print_ascii(invert=True)
    except (ImportError,UnicodeEncodeError):
        print('QR indisponible ; utiliser l’adresse ci-dessus.')
    # Les en-têtes X-Forwarded-* sont interprétés par l'application elle-même (fibda.app) en mode proxy ;
    # uvicorn ne réécrit alors ni l'adresse client ni le schéma, pour garder une seule règle vérifiable.
    uvicorn.run(application,host=args.host,port=args.port,ssl_certfile=str(args.cert) if args.cert else None,ssl_keyfile=str(args.key) if args.key else None,proxy_headers=not args.behind_proxy)


if __name__ == '__main__':
    main()
