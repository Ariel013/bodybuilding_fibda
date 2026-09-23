"""Régressions du workflow et tests de revue indépendants du transport HTTP."""
import unittest
from copy import deepcopy
from fibda.auth import Problem
from fibda.store import new_state
from fibda.workflow import make_round, apply_sport, tick, calculate
from fibda.commands import apply_command
from fibda.projections import project_state, public_state, collective

class FakeStore:
    def __init__(self, users): self.users=users; self.now=100
    def all_users(self, conn): return self.users
    def clock(self): return self.now

class WorkflowTests(unittest.TestCase):
    def setUp(self):
        self.users=[{'id':str(i),'roles':['chief' if i==0 else 'judge'],'approved':True,'active':True} for i in range(5)]
        self.users += [{'id':'t','roles':['trainee'],'approved':True,'active':True}, {'id':'d','roles':['director'],'approved':True,'active':True}]
        self.chief=self.users[0]; self.store=FakeStore(self.users)
        self.s=new_state(); self.s['status']='running'; self.s['jury']={'panel':[str(i) for i in range(5)],'trainees':['t'],'withdrawal_order':['4','3','2','1']}
        self.cat={'id':'cat','name':'Catégorie','discipline':'bodybuilding','section':'amateur','order':0,'archived':False}
        self.s['categories']=[self.cat]
        self.s['people']=[{'id':x,'first_name':x,'last_name':'Test','nationalities':['CI'],'country':'CI','club':'Club','private_contact':'secret','birth_date':'1990-01-01','photo_portrait':'secret-photo','photo_approved':False,'photo_consent':False} for x in 'abc']
        self.s['entries']=[{'id':x,'person_id':x,'category_id':'cat','bib':i+1,'confirmed':True} for i,x in enumerate('abc')]
        self.r=make_round(self.s,self.cat,'final',list('abc'))
        self.r.update(status='open',opened_at=0)
        self.s['rounds']=[self.r]; self.s['active_round_id']=self.r['id']
    def submit(self,j,ranking=None,now=100):
        actor=next(u for u in self.users if u['id']==j)
        return apply_sport(self.s,actor,'ballot.submit',{'round_id':self.r['id'],'restore_id':self.s['restore_id'],'ranking':ranking or list('abc')},self.users,now)
    def official_ballots(self, now=100):
        for i in range(5): self.submit(str(i),now=now+i)
    def validate(self):
        return apply_sport(self.s,self.chief,'round.validate',{'round_id':self.r['id']},self.users,200)
    def completed(self):
        self.official_ballots(); self.submit('t',now=105); self.validate()
    def test_deadline_starts_only_after_last_official_and_closes_exactly_60(self):
        for i in range(4): self.submit(str(i),now=100+i)
        self.assertIsNone(self.r['trainee_deadline'])
        tick(self.s,self.users,1000); self.assertEqual(self.r['status'],'open')
        self.submit('4',now=1001)
        self.assertEqual(self.r['trainee_deadline'],1061)
        tick(self.s,self.users,1060.999); self.assertEqual(self.r['status'],'open')
        tick(self.s,self.users,1061); self.assertEqual(self.r['status'],'awaiting_validation')
        self.assertEqual(self.r['expired_trainees'],['t'])
        version=self.r['version']; alerts=len(self.s['alerts'])
        tick(self.s,self.users,1100)
        self.assertEqual(self.r['version'],version); self.assertEqual(len(self.s['alerts']),alerts)
        with self.assertRaises(Problem): self.submit('t',now=1100)
    def test_all_trainees_advance_early_without_reveal(self):
        self.submit('t',now=10); self.official_ballots()
        self.assertEqual(self.r['status'],'awaiting_validation')
        self.assertTrue(self.r['transitioned'])
        self.assertEqual(self.s['public']['main'],{'kind':'idle'})
    def test_manual_next_same_guard_as_automatic(self):
        with self.assertRaises(Problem): apply_sport(self.s,self.chief,'round.next',{},self.users,100)
        self.official_ballots()
        with self.assertRaises(Problem): apply_sport(self.s,self.chief,'round.next',{},self.users,150)
    def test_qualification_waits_validation(self):
        self.r['phase']='semi'; self.r['quota']=2
        following=make_round(self.s,self.cat,'final',[],dependency=self.r['id']); self.s['rounds'].append(following)
        self.official_ballots(); self.submit('t',now=105)
        self.assertEqual(following['status'],'pending'); self.assertEqual(following['participant_ids'],[])
        self.validate()
        self.assertEqual(following['status'],'open'); self.assertEqual(following['participant_ids'],list('ab'))
    def test_national_filters_nationality_not_country_and_renumbers(self):
        self.s['people'][0]['nationalities']=['FR']; self.s['people'][0]['country']='CI'
        self.s['people'][1]['country']='FR'
        self.completed()
        self.assertEqual([r['entry_id'] for r in self.r['result']['official']],list('bc'))
        self.assertEqual([r['total'] for r in self.r['result']['official']],[3,6])
        self.assertEqual([r['entry_id'] for r in self.r['result']['common']],list('abc'))
    def test_final_zero_no_semifinal_carry(self):
        self.r['result']={'version':99,'common':[{'entry_id':'a','total':99999}],'official':[]}
        self.official_ballots(); self.submit('t',now=105); self.validate()
        self.assertEqual(self.r['result']['common'][0]['total'],3)
    def test_director_and_wrong_restore_cannot_vote(self):
        with self.assertRaises(Problem): self.submit('d')
        with self.assertRaises(Problem): apply_sport(self.s,self.chief,'ballot.submit',{'round_id':self.r['id'],'restore_id':'old','ranking':list('abc')},self.users,100)
        self.assertEqual(self.r['ballots'],{})
    def test_published_correction_requires_distinct_director_and_preserves_original(self):
        self.completed(); self.r['status']='published'
        self.s['public']['main']={'kind':'ranking','round_id':self.r['id']}
        result=apply_sport(self.s,self.chief,'round.correct',{'round_id':self.r['id'],'judge_id':'1','ranking':list('cba'),'reason':'Erreur signée'},self.users,220)
        self.assertTrue(result['pending_signatures']); self.assertEqual(self.r['ballots']['1']['ranking'],list('abc'))
        apply_command(self.store,None,self.s,self.chief,'correction.sign',{'round_id':self.r['id']})
        self.assertIsNotNone(self.r['correction'])
        apply_command(self.store,None,self.s,self.users[-1],'correction.sign',{'round_id':self.r['id']})
        self.assertIsNone(self.r['correction']); self.assertEqual(self.r['ballots']['1']['ranking'],list('cba'))
        self.assertEqual(self.r['ballots']['1']['original']['ranking'],list('abc'))
        self.assertEqual(self.s['public']['main']['kind'],'idle')
    def test_confidentiality_projection_and_public_consent(self):
        self.completed()
        out=project_state(self.s,self.users[1],self.users,100)
        self.assertEqual(set(out['rounds'][0]['ballots']),{'1'})
        self.assertIsNone(out['rounds'][0]['result']); self.assertNotIn('private_contact',out['people'][0])
        self.s['public']['main']={'kind':'reveal','round_id':self.r['id'],'revealed_count':1}
        public=public_state(self.s,'main')
        self.assertNotIn('ballots',public['rounds'][0]); self.assertNotIn('photo_portrait',public['people'][0])
        self.assertEqual(public['rounds'][0]['result']['official'],[{'entry_id':'c','rank':3}])
    def test_overall_cycle_requires_rewards_and_explicit_single_confirmation(self):
        self.completed()
        with self.assertRaises(Problem): apply_sport(self.s,self.chief,'overall.create',{'discipline':'bodybuilding','section':'amateur'},self.users,210)
        apply_sport(self.s,self.chief,'rewards.complete',{'discipline':'bodybuilding','kind':'category'},self.users,210)
        created=apply_sport(self.s,self.chief,'overall.create',{'discipline':'bodybuilding','section':'amateur'},self.users,211)
        overall=self.s['rounds'][-1]; self.assertEqual(overall['status'],'pending')
        with self.assertRaises(Problem): apply_sport(self.s,self.chief,'discipline.advance',{'discipline':'bodybuilding'},self.users,212)
        apply_sport(self.s,self.chief,'overall.confirm',{'round_id':created['round_id']},self.users,213)
        apply_sport(self.s,self.chief,'rewards.complete',{'discipline':'bodybuilding','kind':'overall'},self.users,214)
        apply_sport(self.s,self.chief,'discipline.advance',{'discipline':'bodybuilding'},self.users,215)
        self.assertTrue(self.s['discipline_progress']['bodybuilding']['completed'])

    def test_collective_place_counts_precede_custom_criterion(self):
        # 10 points chacun : une victoire contre une 2e et une 3e place.
        self.s['people'][0]['club']='A'; self.s['people'][1]['club']='B'; self.s['people'][2]['club']='B'
        self.r['status']='validated'; self.r['result']={'official':[{'entry_id':'a','rank':1},{'entry_id':'b','rank':2},{'entry_id':'c','rank':3}]}
        self.s['settings']['collective_tiebreak']='Décision motivée chef et directeur'
        rows=collective(self.s)['club']
        self.assertEqual([r['rank'] for r in rows],[1,2])

    def test_repeated_incident_cannot_destroy_resume_status(self):
        apply_sport(self.s,self.chief,'round.incident',{'round_id':self.r['id'],'reason':'Incident initial'},self.users,100)
        with self.assertRaises(Problem): apply_sport(self.s,self.chief,'round.incident',{'round_id':self.r['id'],'reason':'Double clic'},self.users,101)

    def test_corrected_result_requires_new_reveal_before_podium(self):
        self.completed(); self.r['status']='published'; self.r['reveals']={'main':3}
        self.s['public']['main']={'kind':'ranking','round_id':self.r['id']}
        apply_sport(self.s,self.chief,'round.correct',{'round_id':self.r['id'],'judge_id':'1','ranking':list('cba'),'reason':'Erreur'},self.users,220)
        apply_command(self.store,None,self.s,self.users[-1],'correction.sign',{'round_id':self.r['id']})
        with self.assertRaises(Problem):
            apply_command(self.store,None,self.s,self.chief,'scene.set',{'screen':'main','scene':{'kind':'podium','round_id':self.r['id']}})

    def test_elimination_unknown_qualification_blocks_dependent_round(self):
        self.r['phase']='elimination'; self.r['quota']=1; self.r['trainees']=[]
        following=make_round(self.s,self.cat,'semi',[],quota=1,dependency=self.r['id']); self.s['rounds'].append(following)
        for i,selection in enumerate(['a','a','b','b','c']):
            apply_sport(self.s,self.users[i],'ballot.submit',{'round_id':self.r['id'],'restore_id':self.s['restore_id'],'selected':[selection]},self.users,100+i)
        self.assertEqual(self.r['status'],'awaiting_validation')
        with self.assertRaises(Problem): self.validate()
        self.assertEqual(following['status'],'pending')
        apply_sport(self.s,self.chief,'round.validate',{'round_id':self.r['id'],'qualified_ids':['a','b']},self.users,200)
        self.assertEqual(following['participant_ids'],['a','b'])
        self.assertEqual(following['status'],'open')

    def test_late_entry_is_included_in_already_generated_pending_first_round(self):
        from fibda.catalogue import load_catalogue
        self.s['status']='preparation'; self.s['active_round_id']=None; self.s['bibs_distributed']=True
        self.r['status']='pending'; self.r['opened_at']=None
        rule=next(r for r in load_catalogue()['rules'] if r['discipline']=='bodybuilding' and r['division']=='senior' and r['upper_inclusive']=='70')
        self.cat.update(rule_id=rule['id'],sex='M',division='senior',age_min=None,age_max=None,entry_ids=list('abc'))
        person={'first_name':'Nouveau','last_name':'Concurrent','birth_date':'1990-01-01','sex':'M','section':'amateur','country':'CI','nationalities':['CI'],'height_cm':'170','weight_kg':'69','measurements_confirmed':True,'status_approved':True,'licence_ok':True,'payment_ok':True}
        result=apply_command(self.store,None,self.s,self.chief,'entry.late',{'person':person,'category_id':'cat','reason':'Transport retardé'})
        first=self.s['rounds'][0]
        self.assertIn(result['id'],first['participant_ids'])

    def test_late_thresholds_insert_phases_preserving_ids_bibs_and_other_categories(self):
        from fibda.catalogue import load_catalogue
        rule=next(r for r in load_catalogue()['rules'] if r['discipline']=='bodybuilding' and r['division']=='senior' and r['upper_inclusive']=='70')
        for initial_count, expected_phases in [(6,['semi','final']), (15,['elimination','semi','final'])]:
            with self.subTest(initial_count=initial_count):
                self.setUp()
                self.s['status']='preparation'; self.s['active_round_id']=None; self.s['bibs_distributed']=True
                self.cat.update(rule_id=rule['id'],sex='M',division='senior',age_min=None,age_max=None,entry_ids=[],quota=6,elimination_quota=15)
                self.s['people']=[]; self.s['entries']=[]
                for i in range(initial_count):
                    self.s['people'].append({'id':str(i),'nationalities':['CI']})
                    self.s['entries'].append({'id':str(i),'person_id':str(i),'category_id':'cat','confirmed':True,'bib':i+1})
                first_phase='final' if initial_count==6 else 'semi'
                first=make_round(self.s,self.cat,first_phase,[str(i) for i in range(initial_count)],quota=None if first_phase=='final' else 6)
                existing=[first]
                if first_phase=='semi': existing.append(make_round(self.s,self.cat,'final',[],dependency=first['id']))
                other=make_round(self.s,{**self.cat,'id':'other'},'final',['other-entry'])
                other_snapshot=deepcopy(other); self.s['rounds']=existing+[other]
                old_ids={r['phase']:r['id'] for r in existing}
                person={'first_name':'Nouveau','last_name':'Concurrent','birth_date':'1990-01-01','sex':'M','section':'amateur','country':'CI','nationalities':['CI'],'height_cm':'170','weight_kg':'69','measurements_confirmed':True,'status_approved':True,'licence_ok':True,'payment_ok':True}
                result=apply_command(self.store,None,self.s,self.chief,'entry.late',{'person':person,'category_id':'cat','reason':'Transport retardé'})
                rounds={r['phase']:r for r in self.s['rounds'] if r['category_id']=='cat'}
                self.assertEqual(set(rounds),set(expected_phases))
                self.assertEqual(result['bib'],initial_count+1)
                self.assertEqual([e['bib'] for e in self.s['entries'][:-1]],list(range(1,initial_count+1)))
                self.assertEqual(len(rounds[expected_phases[0]]['participant_ids']),initial_count+1)
                for phase,identifier in old_ids.items(): self.assertEqual(rounds[phase]['id'],identifier)
                for previous,next_phase in zip(expected_phases,expected_phases[1:]):
                    self.assertEqual(rounds[next_phase]['dependency_id'],rounds[previous]['id'])
                    self.assertEqual(rounds[next_phase]['participant_ids'],[])
                self.assertEqual(next(r for r in self.s['rounds'] if r['id']==other['id']),other_snapshot)
