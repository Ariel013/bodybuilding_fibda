"""Parcours métier via HTTP ASGI, démo officielle de trois catégories."""
import tempfile
import unittest
import uuid
from contextlib import ExitStack
from fastapi.testclient import TestClient
from fibda.app import create_app


class EventJourneyTests(unittest.TestCase):
    def test_demo_national_three_categories_through_finish(self):
        with tempfile.TemporaryDirectory() as directory, ExitStack() as stack:
            app=create_app(directory,demo=True,testing=True)
            chief=stack.enter_context(TestClient(app))
            response=chief.post('/api/v1/demo')
            self.assertEqual(response.status_code,200,response.text)
            seeded=response.json();state=seeded['state']
            self.assertEqual(len(state['categories']),3)
            self.assertEqual(len(state['entries']),24)
            clients={state['me']['id']:chief}
            for uid,access in seeded['codes'].items():
                if set(access['roles'])&{'judge','trainee'}:
                    client=TestClient(app);stack.callback(client.close)
                    login=client.post('/api/v1/auth/login',json={'code':access['code']})
                    self.assertEqual(login.status_code,200,login.text)
                    clients[uid]=client

            def read():
                response=chief.get('/api/v1/state')
                self.assertEqual(response.status_code,200,response.text)
                return response.json()
            def command(kind,payload=None,client=None,status=200):
                response=(client or chief).post('/api/v1/command',json={'id':str(uuid.uuid4()),'version':read()['version'],'type':kind,'payload':payload or {}})
                self.assertEqual(response.status_code,status,response.text)
                return response.json().get('state')
            command('event.update',{'settings':{'collective_tiebreak':'Décision motivée chef et directeur après égalité des places'}})
            planned=command('programme.generate')
            trainee=next(u['id'] for u in planned['users'] if 'trainee' in u['roles'])
            command('exam.program',{'user_id':trainee,'round_ids':[r['id'] for r in planned['rounds'] if r['phase']!='elimination']})
            state=command('event.start')
            sequence=[]

            def judge_active():
                state=read();r=next(r for r in state['rounds'] if r['id']==state['active_round_id'])
                sequence.append((r['discipline'],r['phase']))
                people={p['id']:p for p in state['people']};entries={e['id']:e for e in state['entries']}
                # Le concurrent HC gagne le classement commun ; il doit être absent du national.
                ranking=sorted(r['participant_ids'],key=lambda eid:('CI' in people[entries[eid]['person_id']]['nationalities'],entries[eid]['bib']))
                for user in r['panel']+r['trainees']:
                    command('ballot.submit',{'round_id':r['id'],'restore_id':state['restore_id'],'ranking':ranking},clients[user])
                before=read();closed=next(x for x in before['rounds'] if x['id']==r['id'])
                self.assertEqual(closed['status'],'awaiting_validation')
                self.assertEqual(chief.get('/api/v1/public/main').json()['scene']['kind'],'idle')
                after=command('round.validate',{'round_id':r['id']})
                result=next(x for x in after['rounds'] if x['id']==r['id'])['result']
                self.assertEqual([x['entry_id'] for x in result['common']],ranking)
                nationals=[eid for eid in ranking if 'CI' in people[entries[eid]['person_id']]['nationalities']]
                self.assertEqual([x['entry_id'] for x in result['official']],nationals)
                self.assertEqual([x['total'] for x in result['official']],[3*(i+1) for i in range(len(nationals))])
                if r['phase']=='semi':
                    self.assertEqual(result['qualified'],ranking[:6])
                    self.assertIn(ranking[0],result['qualified'])
                return after

            def deliver(phase):
                for reward in read()['rewards']:
                    if reward.get('kind')==phase and not reward['delivered']:
                        command('reward.update',{'reward_id':reward['id'],'prepared':True,'delivered':True})

            # Les deux demi-finales Men’s Physique précèdent chacune des finales.
            state=judge_active()
            self.assertTrue(all(r['status']=='pending' for r in state['rounds'] if r['phase']=='final'))
            self.assertEqual(next(r for r in state['rounds'] if r['id']==state['active_round_id'])['phase'],'semi')
            judge_active();judge_active();state=judge_active()
            self.assertEqual(sequence,[('mens_physique','semi')]*2+[('mens_physique','final')]*2)
            self.assertIsNone(state['active_round_id'])
            command('discipline.advance',{'discipline':'mens_physique'},status=422)
            deliver('final')
            command('rewards.complete',{'discipline':'mens_physique','kind':'category'})
            state=command('overall.create',{'discipline':'mens_physique','section':'amateur','exam_user_ids':[trainee]})
            overall=state['rounds'][-1]
            self.assertEqual(len(overall['participant_ids']),2)
            self.assertIn(overall['id'],next(p for p in state['exam_programs'] if p['user_id']==trainee)['round_ids'])
            self.assertEqual(overall['status'],'open')
            judge_active();deliver('overall')
            command('rewards.complete',{'discipline':'mens_physique','kind':'overall'})
            state=command('discipline.advance',{'discipline':'mens_physique'})
            self.assertEqual(next(r for r in state['rounds'] if r['id']==state['active_round_id'])['discipline'],'bikini')
            judge_active();judge_active();deliver('final')
            command('rewards.complete',{'discipline':'bikini','kind':'category'})
            state=command('overall.create',{'discipline':'bikini','section':'amateur','exam_user_ids':[trainee]})
            overall=state['rounds'][-1]
            self.assertEqual(len(overall['participant_ids']),1)
            self.assertEqual(overall['status'],'pending')
            command('overall.confirm',{'round_id':overall['id']});deliver('overall')
            command('rewards.complete',{'discipline':'bikini','kind':'overall'})
            command('discipline.advance',{'discipline':'bikini'})
            state=command('event.finish')
            self.assertEqual(state['status'],'finished')
            self.assertEqual(len(state['rounds']),8)
            self.assertTrue(all(r['status']=='validated' for r in state['rounds']))
            self.assertEqual(len([r for r in state['rewards'] if r['kind']=='final']),9)
            self.assertEqual(len([r for r in state['rewards'] if r['kind']=='overall']),2)
            self.assertTrue(all(r['delivered'] for r in state['rewards'] if r['kind'] in {'final','overall'}))
