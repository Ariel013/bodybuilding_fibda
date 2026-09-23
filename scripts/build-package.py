#!/usr/bin/env python3
"""Produce a native PyInstaller directory bundle on the target operating system."""
import argparse
import os
from pathlib import Path
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--check',action='store_true',help='Contrôle des prérequis uniquement')
    args=parser.parse_args()
    required=[ROOT/'frontend/dist/index.html',ROOT/'backend/fibda/catalogue.json',ROOT/'launch.py',ROOT/'alembic.ini']
    missing=[str(path) for path in required if not path.exists()]
    if missing:
        parser.error('Prérequis manquants : '+', '.join(missing))
    try:
        import PyInstaller
    except ImportError:
        parser.error('Installer PyInstaller dans le Python de construction : python -m pip install pyinstaller')
    if args.check:
        print('Prérequis de paquet natif présents. Build et réception matérielle non exécutés.')
        return
    command=[sys.executable,'-m','PyInstaller','--noconfirm','--clean','--onedir','--name','FIBDA-Bodybuilding','--paths',str(ROOT/'backend'),'--collect-all','fibda','--collect-all','uvicorn','--collect-all','reportlab','--hidden-import','PIL._imaging','--hidden-import','openpyxl','--collect-all','alembic','--hidden-import','sqlite3','--hidden-import','sqlalchemy.dialects.sqlite', '--distpath',str(ROOT/'dist'),'--workpath',str(ROOT/'build'),'--specpath',str(ROOT/'build')]
    for source,destination in [('frontend/dist','frontend/dist'),('backend/fibda/catalogue.json','fibda'),('alembic.ini','.'),('migrations','migrations'),('docs','docs'),('livrables/Dossier-developpeur-FIBDA.pdf','livrables'),('livrables/Dossier-developpeur-FIBDA.docx','livrables')]:
        command.extend(['--add-data',str(ROOT/source)+':'+destination])
    command.append(str(ROOT/'launch.py'))
    environment = os.environ.copy()
    environment['PYINSTALLER_CONFIG_DIR'] = str(ROOT/'build'/'pyinstaller-cache')
    subprocess.run(command,cwd=ROOT,env=environment,check=True)
    print('Paquet créé pour '+sys.platform+'. Exécuter la recette sur cette plateforme avant diffusion.')

if __name__=='__main__':main()
