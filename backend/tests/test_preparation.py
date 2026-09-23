import unittest
from copy import deepcopy
from fibda.store import new_state
from fibda.preparation import apply_preparation
from fibda.auth import Problem
from fibda.catalogue import load_catalogue

class PreparationTests(unittest.TestCase):
    def setUp(self):
        self.state=new_state(); self.state['date']='2026-09-22'
        self.chief={'id':'chief','roles':['chief']}
        self.sec={'id':'secretary','roles':['secretariat']}
        self.responsable={'id':'r','roles':['responsable']}
    def run_command(self,kind,payload,actor=None):
        return apply_preparation(None,None,self.state,actor or self.chief,kind,payload)
    def category(self,upper='70'):
        rule=next(r for r in load_catalogue()['rules'] if r['discipline']=='bodybuilding' and r['division']=='senior' and r['upper_inclusive']==upper)
        return self.run_command('category.save',{'category':{'rule_id':rule['id'],'section':'amateur'}})
    def person(self,id='p',weight='69'):
        return self.run_command('person.save',{'person':{'id':id,'first_name':'Jean','last_name':'Test','birth_date':'1990-01-01','sex':'M','section':'amateur','country':'FR','nationalities':['FR'],'height_cm':'170','weight_kg':weight,'measurements_confirmed':True,'status_approved':True,'licence_ok':True,'payment_ok':True}})
    def entry(self,p,c,actor=None):
        return self.run_command('entry.save',{'entry':{'person_id':p['id'],'category_id':c['id'],'confirmed':True}},actor)
    def test_national_hc_and_bibs_per_entry_in_programme_order(self):
        a=self.category(); b=self.category(); p=self.person()
        e1=self.entry(p,a); e2=self.entry(p,b)
        self.run_command('programme.reorder',{'category_ids':[b['id'],a['id']]})
        self.run_command('bibs.assign',{})
        self.assertEqual([e['bib'] for e in self.state['entries']],[2,1])
    def test_cumulation_chief_and_drafts(self):
        a=self.category(); b=self.category(); p=self.person()
        self.entry(p,a,self.sec)
        with self.assertRaises(Problem): self.entry(p,b,self.sec)
        p=self.person('q','80')
        draft=self.run_command('entry.save',{'entry':{'person_id':p['id'],'category_id':a['id'],'confirmed':False}},self.sec)
        self.assertFalse(draft['confirmed'])
        with self.assertRaises(Problem): self.entry(p,b,self.sec)
    def test_derogation_and_atomic_failure(self):
        a=self.category(); p=self.person(weight='80'); before=deepcopy(self.state)
        with self.assertRaises(Problem): self.entry(p,a)
        self.assertEqual(self.state,before)
        result=self.run_command('entry.save',{'entry':{'person_id':p['id'],'category_id':a['id'],'confirmed':True,'derogation':{'reason':'Décision sportive documentée'}}})
        self.assertEqual(result['derogation']['signed_by'],'chief')
    def test_fusion_and_age_mismatch(self):
        a=self.category(); b=self.category('75'); p=self.person(); q=self.person('q','74')
        self.entry(p,a); self.entry(q,b)
        merged=self.run_command('category.fuse',{'category_ids':[a['id'],b['id']],'name':'Fusion'})
        self.assertEqual(len(merged['entry_ids']),2)
        self.assertEqual({e['category_id'] for e in self.state['entries']},{merged['id']})
        self.assertTrue(all(c['archived'] for c in self.state['categories'][:2]))
    def test_late_max_plus_one_and_started_block(self):
        a=self.category(); self.entry(self.person(),a); self.run_command('bibs.assign',{})
        q=self.person('q')
        late=self.run_command('entry.late',{'person':q,'category_id':a['id'],'reason':'Transport retardé'},self.responsable)
        self.assertEqual(late['bib'],2)
        self.state['rounds']=[{'id':'r','category_id':a['id'],'status':'open','ballots':{}}]
        with self.assertRaises(Problem): self.run_command('entry.late',{'person':{**q,'id':'z'},'category_id':a['id'],'reason':'Retard'})
    def test_sex_section_and_international_flags(self):
        a=self.category(); p=self.person(); self.state['mode']='international'
        with self.assertRaises(Problem): self.entry(p,a)
        self.state['mode']='national'; self.state['people'][0]['section']='pro'
        with self.assertRaises(Problem): self.entry(p,a)

    def test_collective_criterion_frozen_after_start(self):
        self.state['settings']['collective_tiebreak']='Critère publié'; self.state['status']='running'
        before=deepcopy(self.state)
        with self.assertRaises(Problem): self.run_command('event.update',{'name':'Autre','settings':{'collective_tiebreak':'Nouveau critère'}})
        self.assertEqual(self.state,before)
        self.run_command('event.update',{'settings':{'collective_tiebreak':'Critère publié'}})

    def test_reorder_preserves_engaged_positions_including_indirect_shifts(self):
        cats=[self.category() for _ in range(4)]
        ids=[c['id'] for c in cats]
        self.state['rounds']=[{'id':'started','category_id':ids[1],'status':'validated','opened_at':10,'ballots':{}}]
        before=deepcopy(self.state)
        with self.assertRaises(Problem): self.run_command('programme.reorder',{'category_ids':[ids[2],ids[0],ids[1],ids[3]]})
        self.assertEqual(self.state,before)
        self.run_command('programme.reorder',{'category_ids':[ids[0],ids[1],ids[3],ids[2]]})
        self.assertEqual(next(c['order'] for c in self.state['categories'] if c['id']==ids[1]),1)

    def test_bibs_refuse_zero_confirmations_and_leave_state_intact(self):
        before=deepcopy(self.state)
        with self.assertRaises(Problem): self.run_command('bibs.assign',{})
        self.assertEqual(self.state,before)

    def test_mode_change_rechecks_confirmed_entries(self):
        cat=self.category(); self.entry(self.person(),cat)
        before=deepcopy(self.state)
        with self.assertRaises(Problem): self.run_command('event.update',{'mode':'international'})
        self.assertEqual(self.state,before)
        self.state['people'][0].update(delegation_approved=True,organizer_approved=True)
        self.run_command('event.update',{'mode':'international'})
        self.assertEqual(self.state['mode'],'international')

    def test_date_change_rechecks_junior_age(self):
        rule=next(r for r in load_catalogue()['rules'] if r['discipline']=='bodybuilding' and r['division']=='junior' and r['age_min']==21 and r['upper_inclusive']=='75')
        cat=self.run_command('category.save',{'category':{'rule_id':rule['id'],'section':'amateur'}})
        person=self.person(); self.state['people'][0]['birth_date']='2003-12-31'
        self.entry(self.state['people'][0],cat)
        before=deepcopy(self.state)
        with self.assertRaises(Problem): self.run_command('event.update',{'date':'2027-01-01'})
        self.assertEqual(self.state,before)

    def test_start_helper_honours_only_signed_existing_derogation_issues(self):
        from fibda.preparation import validate_confirmed_entries
        cat=self.category(); person=self.person(weight='80')
        self.run_command('entry.save',{'entry':{'person_id':person['id'],'category_id':cat['id'],'confirmed':True,'derogation':{'reason':'Décision sportive documentée'}}})
        self.assertTrue(validate_confirmed_entries(self.state))
        self.state['people'][0]['payment_ok']=False
        with self.assertRaises(Problem): validate_confirmed_entries(self.state)
