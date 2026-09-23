import base64
import copy
import io
import json
from pathlib import Path
import sys
import unittest
import uuid
import zipfile

ROOT=Path(__file__).resolve().parents[2]
sys.path[:0]=[str(ROOT/'backend'),str(ROOT/'standalone'/'python')]
import bridge


class BridgeTests(unittest.TestCase):
    def setUp(self):
        self.now=2000000000
        bridge.CLOCK=lambda:self.now
        result=json.loads(bridge.init())
        self.assertEqual(result['status'],200,result)
        self.chief=self.login('1111')
        self.judges=[self.login(str(2000+i)) for i in range(1,5)]
        self.trainee=self.login('3001')
        self.director=self.login('5555')
        self.secretary=self.login('6666')

    def call(self,method,path,body=None,actor=None,status=200):
        response=json.loads(bridge.handle(method,path,json.dumps(body or {}),actor or ''))
        self.assertEqual(response['status'],status,response)
        return response['data']

    def login(self,code):return self.call('POST','/auth/login',{'code':code})['user']['id']
    def state(self):return self.call('GET','/state',actor=self.chief)
    def command(self,kind,payload=None,actor=None,status=200,ident=None,version=None):
        data={'id':ident or str(uuid.uuid4()),'version':self.state()['version'] if version is None else version,'type':kind,'payload':payload or {}}
        return self.call('POST','/command',data,actor or self.chief,status)
    def begin(self):
        self.command('programme.generate');self.command('event.start')
        return next(r for r in self.state()['rounds'] if r['status']=='open')
    def vote(self,r,actor=None,ranking=None,**kwargs):
        return self.command('ballot.submit',{'round_id':r['id'],'restore_id':self.state()['restore_id'],'ranking':ranking or r['participant_ids']},actor or self.chief,**kwargs)
    def finish_round(self,r):
        for judge in [self.chief]+self.judges+[self.trainee]:self.vote(r,judge)
        return self.command('round.validate',{'round_id':r['id']})

    def test_seed_accounts_catalogue(self):
        state=self.state()
        self.assertEqual(len(state['people']),24)
        self.assertEqual(len(state['categories']),3)
        self.assertEqual(len(state['users']),12)
        self.assertEqual(state['status'],'preparation')
        self.assertEqual(len(self.call('GET','/catalogue',actor=self.chief)['rules']),106)
        self.assertTrue(self.call('GET','/eligibility/'+state['people'][0]['id'],actor=self.secretary)['proposals'])

    def test_demo_entry_without_existing_session(self):
        response=self.call('POST','/demo')
        self.assertEqual(response['state']['me']['id'],self.chief)
        self.assertEqual(response['codes'][self.chief]['code'],'1111')

    def test_failed_command_rolls_back_every_collection(self):
        previous=bridge.snapshot()
        self.command('event.update',{'name':'Ne doit pas rester','date':'incorrecte'},status=422)
        self.assertEqual(bridge.snapshot(),previous)

    def test_idempotency_and_command_collision(self):
        identifier=str(uuid.uuid4());version=self.state()['version']
        first=self.command('event.update',{'name':'Test'},ident=identifier,version=version)
        again=self.command('event.update',{'name':'Test'},ident=identifier,version=version)
        self.assertEqual(first,again)
        self.command('event.update',{'name':'Autre'},ident=identifier,version=version,status=409)

    def test_version_conflict(self):
        old=self.state()['version'];self.command('event.update',{'name':'Autre'})
        self.command('event.update',{'name':'Ancien'},version=old,status=409)

    def test_judge_cannot_read_audit_or_others_prints(self):
        self.call('GET','/audit',actor=self.judges[0],status=403)
        self.call('GET','/print/ballot?judge_id='+self.judges[1],actor=self.judges[0],status=403)
        self.call('GET','/snapshot',actor=self.judges[0],status=403)

    def test_director_cannot_vote(self):
        r=self.begin();self.vote(r,self.director,status=403)
        self.assertEqual(self.state()['rounds'][0]['ballots'],{})

    def test_validated_votes_and_local_lock(self):
        r=self.begin();v=self.state()['version']
        result=self.vote(r,self.chief,version=v)
        self.assertTrue(result['result']['received'])
        self.vote(r,self.judges[0],version=v)
        self.vote(r,self.chief,status=409)
        view=self.call('GET','/state',actor=self.judges[0])
        self.assertEqual(set(view['rounds'][0]['ballots']),{self.judges[0]})

    def test_all_trainees_trigger_next_before_timeout(self):
        r=self.begin()
        for judge in [self.chief]+self.judges:self.vote(r,judge)
        self.assertEqual(self.state()['active_round_id'],r['id'])
        self.command('round.next',status=409)
        self.vote(r,self.trainee)
        state=self.state();done=next(x for x in state['rounds'] if x['id']==r['id'])
        self.assertEqual(done['status'],'awaiting_validation')
        self.assertNotEqual(state['active_round_id'],r['id'])

    def test_timeout_expired_alert_and_no_fabricated_vote(self):
        r=self.begin()
        for judge in [self.chief]+self.judges:self.vote(r,judge)
        self.now+=59;self.call('POST','/tick',actor=self.chief)
        self.assertEqual(self.state()['active_round_id'],r['id'])
        self.now+=1;self.call('POST','/tick',actor=self.chief)
        state=self.state();done=next(x for x in state['rounds'] if x['id']==r['id'])
        self.assertEqual(done['expired_trainees'],[self.trainee]);self.assertNotIn(self.trainee,done['ballots'])
        self.assertEqual(state['alerts'][-1]['roles'],['chief','responsable'])
        self.vote(r,self.trainee,status=409)

    def test_no_trainee_transition(self):
        self.command('jury.configure',{**self.state()['jury'],'trainees':[]})
        r=self.begin()
        for judge in [self.chief]+self.judges:self.vote(r,judge)
        self.assertNotEqual(self.state()['active_round_id'],r['id'])

    def test_national_recalc_and_common_guest_qualification(self):
        r=self.begin();guest=r['participant_ids'][-1];ranking=[guest]+r['participant_ids'][:-1]
        for judge in [self.chief]+self.judges+[self.trainee]:self.vote(r,judge,ranking)
        result=self.command('round.validate',{'round_id':r['id']})['result']['result']
        self.assertEqual(result['qualified'][0],guest)
        self.assertNotIn(guest,[x['entry_id'] for x in result['official']])
        self.assertEqual(result['official'][0]['total'],3)
        self.assertEqual(result['common'][1]['total'],6)

    def test_photos_consent_and_public_access(self):
        person=self.state()['people'][0]
        jpeg='data:image/jpeg;base64,'+base64.b64encode(b'\xff\xd8\xffFAKE\xff\xd9').decode()
        photo=self.call('POST','/photos',{'owner_type':'person','owner_id':person['id'],'kind':'portrait','data_url':jpeg},self.secretary)['id']
        self.call('GET','/photos/'+photo,status=401)
        self.assertEqual(self.call('GET','/photos/'+photo,actor=self.secretary)['data_url'],jpeg)
        self.call('POST','/photos/'+photo+'/approve',{'consent':False},self.secretary,status=422)
        self.call('POST','/photos/'+photo+'/approve',{'consent':True},self.secretary)
        self.assertEqual(self.call('GET','/photos/'+photo)['data_url'],jpeg)
        self.command('person.save',{'person':{**person,'photo_consent':False}})
        self.call('GET','/photos/'+photo,status=401)

    def test_batch_photo_failure_rolls_back_first(self):
        person=self.state()['people'][0]
        jpeg='data:image/jpeg;base64,'+base64.b64encode(b'\xff\xd8\xffFAKE\xff\xd9').decode()
        old=bridge.snapshot()
        self.call('POST','/photos/batch',{'items':[{'owner_type':'person','owner_id':person['id'],'kind':'portrait','data_url':jpeg},{'owner_type':'person','owner_id':'unknown','kind':'portrait','data_url':jpeg}]},self.secretary,status=404)
        self.assertEqual(old,bridge.snapshot())

    def test_import_csv_and_transaction(self):
        csv='first_name,last_name,birth_date,sex,section,country,nationalities\nNouveau,Athlete,1999-05-03,M,amateur,CI,CI\n'
        preview=self.call('POST','/imports/preview',{'filename':'test.csv','data_b64':base64.b64encode(csv.encode()).decode()},self.secretary)
        self.assertEqual(preview['errors'],[])
        self.assertEqual(self.call('POST','/imports/commit',{'preview_id':preview['preview_id']},self.secretary)['count'],1)
        self.assertEqual(len(self.state()['people']),25)

    def test_stale_import_preview_refused(self):
        csv='first_name,last_name,birth_date,sex,section,country,nationalities\nNouveau,Athlete,1999-05-03,M,amateur,CI,CI\n'
        preview=self.call('POST','/imports/preview',{'filename':'test.csv','data_b64':base64.b64encode(csv.encode()).decode()},self.secretary)
        self.command('event.update',{'name':'Modifié'})
        self.call('POST','/imports/commit',{'preview_id':preview['preview_id']},self.secretary,status=409)

    def test_xlsx_export_and_import(self):
        try:import openpyxl
        except ImportError:self.skipTest('Exécuter avec .venv/bin/python pour les dépendances Excel.')
        document=self.call('GET','/export/registrations?format=xlsx',actor=self.chief)
        wb=openpyxl.load_workbook(io.BytesIO(base64.b64decode(document['data_b64'])))
        self.assertIn('Men',str(wb.active['A1'].value))
        wb.close()
        source=openpyxl.Workbook();source.active.append(['first_name','last_name','birth_date','sex','section','country','nationalities'])
        source.active.append(['Excel','Fictif','1999-05-03','M','amateur','CI','CI'])
        output=io.BytesIO();source.save(output)
        preview=self.call('POST','/imports/preview',{'filename':'test.xlsx','data_b64':base64.b64encode(output.getvalue()).decode()},self.secretary)
        self.assertEqual(preview['errors'],[])
        self.assertEqual(preview['rows'][0]['first_name'],'Excel')

    def test_backup_restore_and_invalid_archive_preserve_data(self):
        data=self.call('POST','/backup',actor=self.chief)
        old=self.state()['restore_id']
        self.command('event.update',{'name':'À annuler'})
        self.call('POST','/restore',data,self.chief)
        self.assertNotEqual(self.state()['restore_id'],old)
        self.assertEqual(self.state()['name'],'FIBDA — compétition fictive de test')
        self.assertEqual(bridge.DB['commands'],{})
        previous=bridge.snapshot();out=io.BytesIO()
        with zipfile.ZipFile(out,'w') as z:z.writestr('../snapshot.json','{}')
        self.call('POST','/restore',{'data_b64':base64.b64encode(out.getvalue()).decode()},self.chief,status=422)
        self.assertEqual(previous,bridge.snapshot())

    def test_original_print_engine_and_csv(self):
        self.command('programme.generate')
        html=self.call('GET','/print/blank',actor=self.chief)
        self.assertIn('participants à confirmer',html)
        self.assertIn('break-before:page',html)
        data=self.call('GET','/export/registrations?format=csv',actor=self.chief)
        self.assertTrue(base64.b64decode(data['data_b64']).startswith(b'\xef\xbb\xbf'))
        pdf=self.call('GET','/export/results?format=pdf',actor=self.chief)
        self.assertIn('window.print()',pdf)

    def test_invite_approval_and_unapproved_login(self):
        result=self.command('user.invite',{'name':'Nouveau juge','roles':['judge'],'code':'1234'},self.director)
        identifier=result['result']['user']['id']
        self.call('POST','/auth/login',{'code':'1234'},status=403)
        self.command('user.approve',{'user_id':identifier})
        self.assertEqual(self.login('1234'),identifier)
        self.command('user.invite',{'name':'Directeur votant','roles':['director','judge'],'code':'4321'},status=422)

    def test_snapshot_reload_preserves_staged_import(self):
        before=bridge.snapshot();result=json.loads(bridge.init(before))
        self.assertEqual(result['status'],200,result)
        self.assertEqual(before,bridge.snapshot())

    def test_public_official_excludes_private_account(self):
        self.command('official.save',{'official':{'first_name':'Ada','last_name':'Exemple','post':'Invitée','pedigree':'Ingénieure'}})
        official=self.state()['officials'][-1]
        self.command('scene.set',{'screen':'main','scene':{'kind':'official','official_id':official['id']}})
        public=self.call('GET','/public/main')
        self.assertEqual(public['officials'][0]['pedigree'],'Ingénieure')
        self.assertNotIn('users',public)
        self.assertEqual(len(self.state()['users']),12)

    def test_full_competition_overall_rewards_and_snapshot_restore(self):
        self.begin()
        for discipline in ['mens_physique','bikini']:
            while True:
                state=self.state()
                active=next((r for r in state['rounds'] if r['id']==state['active_round_id']),None)
                if not active:break
                self.assertEqual(active['discipline'],discipline)
                self.finish_round(active)
            finals=[r for r in self.state()['rounds'] if r['discipline']==discipline and r['phase']=='final']
            self.assertTrue(all(r['status']=='validated' for r in finals))
            self.command('rewards.complete',{'discipline':discipline,'kind':'category'})
            overall=self.command('overall.create',{'discipline':discipline,'section':'amateur'})['result']
            # Les overall n'ont pas de catégorie enregistrée, leur clé est synthétique.
            self.assertEqual(json.loads(bridge.init(bridge.snapshot()))['status'],200)
            rnd=next(r for r in self.state()['rounds'] if r['id']==overall['round_id'])
            if len(rnd['participant_ids'])==1:
                self.command('overall.confirm',{'round_id':rnd['id']})
                self.assertIsNone(next(r for r in self.state()['rounds'] if r['id']==rnd['id'])['result']['reference_ranking'])
            else:self.finish_round(rnd)
            self.command('rewards.complete',{'discipline':discipline,'kind':'overall'})
            self.command('discipline.advance',{'discipline':discipline})
        self.command('event.finish')
        state=self.state()
        self.assertEqual(state['status'],'finished')
        self.assertEqual(len([r for r in state['rewards'] if r['kind']=='final']),9)
        self.assertEqual(len([r for r in state['rewards'] if r['kind']=='overall']),2)
        self.assertTrue(self.call('GET','/collective',actor=self.chief)['complete'])

    def test_published_result_correction_requires_two_signatures(self):
        # Une finale sans dépendant pour éprouver les signatures de publication.
        self.command('programme.generate')
        cat=self.state()['categories'][0]
        raw=json.loads(bridge.snapshot())
        rnd=next(r for r in raw['state']['rounds'] if r['category_id']==cat['id'] and r['phase']=='final')
        rnd.update(participant_ids=cat['entry_ids'][:6],dependency_id=None)
        raw['state']['rounds']=[rnd]
        self.assertEqual(json.loads(bridge.init(json.dumps(raw)))['status'],200)
        self.command('event.start')
        rnd=self.state()['rounds'][0];self.finish_round(rnd)
        self.command('scene.set',{'screen':'main','scene':{'kind':'reveal','round_id':rnd['id'],'revealed_count':1}})
        original=copy.deepcopy(self.state()['rounds'][0]['result'])
        self.command('round.correct',{'round_id':rnd['id'],'judge_id':self.chief,'ranking':list(reversed(rnd['participant_ids'])),'reason':'Test correction de transcription'})
        self.assertEqual(self.state()['rounds'][0]['result'],original)
        self.command('correction.sign',{'round_id':rnd['id']},self.chief)
        self.assertEqual(self.state()['rounds'][0]['result'],original)
        self.command('correction.sign',{'round_id':rnd['id']},self.director)
        self.assertIsNone(self.state()['rounds'][0]['correction'])
        self.assertEqual(self.state()['rounds'][0]['result']['version'],original['version']+1)
        self.assertEqual(self.state()['public']['main']['kind'],'idle')


if __name__=='__main__':unittest.main(verbosity=2)
