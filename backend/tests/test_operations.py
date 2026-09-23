import io
import json
import sqlite3
import zipfile
import pytest
from fibda.backup import create_backup, validate_backup, stage_restore
from fibda.transfers import preview_import, sanitize_photo, batch_photos
from fibda.printing import render_print, export_document
from PIL import Image


def state():
    return dict(name='<script>alert(1)</script>',version=2,people=[dict(id='p',first_name='A',last_name='B')],entries=[dict(id='e',person_id='p',category_id='c',bib=7)],categories=[dict(id='c',name='Senior')],rounds=[dict(id='r',category_id='c',phase='final',status='validated',participant_ids=['e'],ballots={'j':dict(ranking=['e'],version=2,source='paper')},result={'official':[dict(entry_id='e',rank=1,total=3)]})])


def test_html_escape_and_ballot_isolation():
    html = render_print(state(),'ballot',judge_id='j')
    assert '<script>' not in html and '&lt;script&gt;' in html
    assert 'juge j' in html and 'version 2' in html
    assert 'exam' not in html.lower()
    assert 'repeat' not in html or 'table-header-group' in html
    assert 'juge j' not in render_print(state(),'ballot',judge_id='other')


def test_blank_and_exports():
    event = state()
    event['rounds'][0].update(phase='elimination',quota=1)
    assert 'sélectionner 1' in render_print(event,'blank')
    for fmt, magic in [('csv',b'\xef\xbb\xbf'),('xlsx',b'PK'),('pdf',b'%PDF')]:
        data, mime, name = export_document(event,'registrations',fmt)
        assert data.startswith(magic) and name.endswith(fmt)


def test_csv_import_errors_and_formula_escape():
    valid = preview_import(b'first_name;last_name;sex;height_cm;birth_date;section;country;nationalities\nAnne;Dupont;F;165;1990-01-01;amateur;CI;CI\n','people.csv')
    assert not valid['errors'] and valid['rows'][0]['height_cm']=='165'
    invalid = preview_import(b'first_name,last_name,sex\n=HYPERLINK(1),X,Z\n','people.csv')
    assert any('Formule' in e['message'] for e in invalid['errors'])
    assert any('Sexe' in e['message'] for e in invalid['errors'])
    event = state(); event['people'][0]['first_name']='=formula'
    assert b"'=formula" in export_document(event,'registrations','csv')[0]


def photo():
    stream=io.BytesIO(); Image.new('RGB',(50,80),'green').save(stream,'PNG'); return stream.getvalue()


def test_photos_sanitize_crop_and_mapping():
    image=Image.open(io.BytesIO(sanitize_photo(photo(),[0,0,30,40])))
    assert image.size==(30,40) and image.format=='JPEG' and not image.getexif()
    with pytest.raises(ValueError): sanitize_photo(photo(),[-1,0,20,20])
    archive=io.BytesIO()
    with zipfile.ZipFile(archive,'w') as z: z.writestr('photo.png',photo())
    result=batch_photos(archive.getvalue(),[dict(filename='photo.png',owner_type='person',owner_id='p',kind='portrait')])
    assert len(result)==1 and result[0]['data'].startswith(b'\xff\xd8')
    with pytest.raises(ValueError): batch_photos(archive.getvalue(),[dict(filename='missing.png')])


def test_backup_snapshot_restore_and_tamper(tmp_path):
    database=tmp_path/'live.sqlite'
    with sqlite3.connect(database) as connection:
        for table in ['users','sessions','commands','audit','photos']: connection.execute(f'CREATE TABLE {table}(id TEXT)')
        connection.execute('CREATE TABLE events(data TEXT)')
        connection.execute('INSERT INTO events VALUES (?)',(json.dumps(state()),))
    photos=tmp_path/'photos'; photos.mkdir(); (photos/'one.jpg').write_bytes(photo())
    data=create_backup(database,photos)
    assert validate_backup(data)['photos']['one.jpg']==photo()
    staged=stage_restore(data,tmp_path)
    assert staged['database_path'] != str(database) and database.exists()
    stream=io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(data)) as source,zipfile.ZipFile(stream,'w') as target:
        for name in source.namelist(): target.writestr(name,b'broken' if name=='database.sqlite' else source.read(name))
    with pytest.raises(ValueError,match='Empreinte'): validate_backup(stream.getvalue())
    malicious=io.BytesIO()
    with zipfile.ZipFile(malicious,'w') as z: z.writestr('../outside',b'x')
    with pytest.raises(ValueError,match='Chemin'): validate_backup(malicious.getvalue())


def test_xlsx_formulas_are_not_executed():
    from openpyxl import Workbook
    workbook=Workbook(); sheet=workbook.active
    sheet.append(['first_name','last_name']); sheet.append(['=1+1','Nom'])
    stream=io.BytesIO(); workbook.save(stream)
    result=preview_import(stream.getvalue(),'athletes.xlsx')
    assert result['rows'][0]['first_name']=='=1+1'
    assert any('Formule' in e['message'] for e in result['errors'])


def test_diploma_requires_validated_results_and_exams_remain_separate():
    event=state()
    assert 'Diplôme - A B' in render_print(event,'diploma')
    event['rounds'][0]['status']='open'
    assert 'Diplôme - A B' not in render_print(event,'diploma')
    event['rounds'][0]['participant_ids']=['e','e2']
    event['exam_programs']=[dict(user_id='trainee',round_ids=['r'])]
    assert 'N/D' in render_print(event,'exams')
    assert 'Manquant ou non comparable' in render_print(event,'exams')
    assert 'Concordance' not in render_print(event,'ballot',judge_id='j')


def test_print_assignment_missing_expired_and_rewards():
    from fibda.printing import document_sections
    event=state();rnd=event['rounds'][0]
    event['users']=[dict(id='j',name='Jean'),dict(id='t',name='Tina'),dict(id='m',name='Marc')]
    rnd.update(panel=['j','m'],trainees=['t'],expired_trainees=['t'])
    rnd['ballots']['j']['corrections']=[{'reason':'Rectification'}]
    blank=document_sections(event,'blank')
    assert len(blank)==3 and 'Jean (officiel)' in blank[0][0] and 'Tina (stagiaire)' in blank[2][0]
    recap=document_sections(event,'recap')
    assert 'Rectifié' in recap[0][0] and 'Manquant' in recap[1][0] and 'Expiré' in recap[2][0]
    rnd['participant_ids']=[]
    blank=document_sections(event,'blank',judge_id='j')
    assert 'participants à confirmer' in blank[0][0] and len(blank[0][2])==6
    event['rewards']=[dict(title='Champion',category_id='c',entry_id='e',kind='overall'),dict(title='Club',collective_name='Club Abidjan')]
    rewards=document_sections(event,'rewards')
    assert len(rewards)==2 and rewards[0][0]=='Overall - Senior'
    assert rewards[0][2][0][1:3]==[7,'A B'] and rewards[1][2][0][2]=='Club Abidjan'
    assert 'A4 landscape' in render_print(event,'diploma')
