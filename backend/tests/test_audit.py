"""Audit indépendant : invariants entre correction, dépendances et examen."""
import unittest
from fibda.auth import Problem
from fibda.commands import apply_command
from fibda.domain import exam_report
from fibda.workflow import apply_sport, make_round
import test_workflow as fixtures


class AuditTests(unittest.TestCase):
    setUp = fixtures.WorkflowTests.setUp
    submit = fixtures.WorkflowTests.submit
    official_ballots = fixtures.WorkflowTests.official_ballots
    validate = fixtures.WorkflowTests.validate
    completed = fixtures.WorkflowTests.completed

    def test_exam_future_dependency_is_missing_not_excluded_as_zero_participants(self):
        ids=list('abcdef')
        rounds=[{'id':str(i),'phase':'final','category_id':str(i),'status':'validated',
                 'participant_ids':ids,'ballots':{'t':{'original':{'ranking':ids}}},
                 'result':{'reference_ranking':ids,'reference_version':1}} for i in range(4)]
        rounds.append({'id':'future','phase':'final','category_id':'future','status':'pending',
                       'participant_ids':[],'dependency_id':'semi-future','ballots':{},'result':None})
        report=exam_report({'round_ids':[r['id'] for r in rounds]},rounds,'t')
        self.assertFalse(report['passed'], 'Un tour futur non constitué ne vaut pas une exclusion connue à zéro participant.')
        self.assertIn('future',report['missing'])

    def test_director_signature_rechecks_dependency_opened_since_proposal(self):
        self.r['phase']='semi';self.r['quota']=2
        self.completed();self.r['status']='published'
        following=make_round(self.s,self.cat,'final',[],dependency=self.r['id'])
        self.s['rounds'].append(following)
        apply_sport(self.s,self.chief,'round.correct',{'round_id':self.r['id'],'judge_id':'1','ranking':list('cba'),'reason':'Erreur'},self.users,220)
        apply_sport(self.s,self.chief,'round.open',{'round_id':following['id']},self.users,221)
        self.assertEqual(following['status'],'open')
        with self.assertRaises(Problem):
            apply_command(self.store,None,self.s,self.users[-1],'correction.sign',{'round_id':self.r['id']})

    def test_final_correction_cannot_leave_an_engaged_overall_with_wrong_champion(self):
        self.completed()
        apply_sport(self.s,self.chief,'rewards.complete',{'discipline':'bodybuilding','kind':'category'},self.users,210)
        result=apply_sport(self.s,self.chief,'overall.create',{'discipline':'bodybuilding','section':'amateur'},self.users,211)
        overall=self.s['rounds'][-1]
        apply_sport(self.s,self.chief,'overall.confirm',{'round_id':result['round_id']},self.users,212)
        for judge in ['0','1','2']:
            try:
                apply_sport(self.s,self.chief,'round.correct',{'round_id':self.r['id'],'judge_id':judge,'ranking':list('cba'),'reason':'Erreur documentée'},self.users,220)
            except Problem:
                return  # Le refus explicite protège la dépendance sportive engagée.
        champion=self.r['result']['official'][0]['entry_id']
        self.assertEqual(overall['participant_ids'],[champion])

    def test_signature_does_not_silently_resolve_a_later_incident(self):
        self.completed();self.r['status']='published'
        apply_sport(self.s,self.chief,'round.correct',{'round_id':self.r['id'],'judge_id':'1','ranking':list('cba'),'reason':'Erreur'},self.users,220)
        apply_sport(self.s,self.chief,'round.incident',{'round_id':self.r['id'],'reason':'Nouvel incident à examiner'},self.users,221)
        with self.assertRaises(Problem):
            apply_command(self.store,None,self.s,self.users[-1],'correction.sign',{'round_id':self.r['id']})
        self.assertEqual(self.r['status'],'suspended')
