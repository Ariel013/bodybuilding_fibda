import unittest
from fibda.domain import *

class DomainTests(unittest.TestCase):
    def ballots(self, rankings):
        return {str(i): {'ranking': r} for i, r in enumerate(rankings)}

    def test_panel_and_permutation(self):
        users = [{'id': str(i), 'approved': True, 'roles': ['chief' if i == 0 else 'judge']} for i in range(5)]
        self.assertTrue(validate_panel([str(i) for i in range(5)], users, '0'))
        users[2]['roles'].append('director')
        with self.assertRaises(DomainError): validate_panel([str(i) for i in range(5)], users, '0')
        with self.assertRaises(DomainError): validate_ranking(['a','a'], ['a','b'])

    def test_single_minmax_all_panels(self):
        for count in (5,7,9,11):
            result = rank_ballots(self.ballots([['a','b','c']]*count), chief_id='0')
            self.assertEqual(result[0]['total'], count-2)
            self.assertEqual(result[2]['total'], 3*(count-2))

    def test_national_renumbers_each_ballot(self):
        ballots = self.ballots([list('axb'),list('abx'),list('xab'),list('bxa'),list('xba')])
        result = rank_ballots(ballots,chief_id='0',eligible_ids=['a','b'])
        self.assertEqual({r['entry_id']:r['total'] for r in result},{'a':4,'b':5})

    def test_majority_cycle_uses_chief(self):
        self.assertEqual(majority_order(list('abc'),[list('abc'),list('bca'),list('cab')],list('bca')),list('bca'))
        self.assertEqual(majority_order(list('abcd'),[list('dabc'),list('dbca'),list('dcab')],list('dbca')),list('dbca'))

    def test_elimination_boundary_is_unresolved(self):
        r = elimination_result({'0':['a'],'1':['a'],'2':['b'],'3':['b'],'4':['c']},list('abc'),1)
        self.assertTrue(r['pending']); self.assertEqual(r['tied'],list('ab')); self.assertEqual(r['qualified'],[])

    def test_overall_dedup_and_collective(self):
        entries = [{'id':'a','person_id':'p'},{'id':'b','person_id':'p'},{'id':'c','person_id':'q'}]
        rows = [{'entry_id':'a','rank':1},{'entry_id':'b','rank':1},{'entry_id':'c','rank':2}]
        self.assertEqual(overall_candidates(rows,entries),['a'])
        groups = collective_results(rows,entries,[{'id':'p','club':'A'},{'id':'q','club':'A'}])
        self.assertEqual(groups[0]['points'],16); self.assertEqual(groups[0]['counts'],[1,1,0,0,0,0])

    def test_exam_original_exact_mean_and_requirements(self):
        rounds=[]
        for i in range(4):
            rounds.append({'id':str(i),'category_id':str(i),'phase':'final','status':'validated','ballots':{'t':{'ranking':list('fedcba'),'original':{'ranking':list('abcdef')}}},'result':{'reference_ranking':list('abcdef'),'reference_version':2}})
        result=exam_report({'round_ids':[str(i) for i in range(4)]},rounds,'t')
        self.assertTrue(result['passed']); self.assertEqual(result['pairs'],60); self.assertEqual(result['mean']['numerator'],100)
        rounds[0]['ballots']={}
        result=exam_report({'round_ids':[str(i) for i in range(4)]},rounds,'t')
        self.assertFalse(result['passed']); self.assertEqual(result['mean']['numerator'],100); self.assertEqual(result['missing'],['0'])
        self.assertEqual(pair_concordance(list('bacdef'),list('abcdef'))[0],Fraction(280,3))

    def test_mean_not_rounded_for_pass(self):
        reference = [str(i) for i in range(100)]
        remaining, ranking, inversions = reference[:], [], 2971
        while remaining:
            index = min(inversions, len(remaining) - 1)
            ranking.append(remaining.pop(index)); inversions -= index
        rounds = [{'id': str(i), 'category_id': str(i), 'phase': 'final', 'status': 'validated',
                   'ballots': {'t': {'original': {'ranking': ranking if i == 0 else reference}}},
                   'result': {'reference_ranking': reference, 'reference_version': 1}} for i in range(4)]
        report = exam_report({'round_ids': [str(i) for i in range(4)]}, rounds, 't')
        self.assertTrue(report['sufficient'])
        self.assertFalse(report['passed'])
        self.assertGreater(float(Fraction(report['mean']['numerator'], report['mean']['denominator'])), 84.99)
        with self.assertRaises(DomainError): pair_concordance(['a'],['a'])

    def test_responsable_sits_and_non_evaluable_rounds_excluded(self):
        users = [{'id': str(i), 'approved': True, 'roles': ['chief' if i == 0 else 'responsable' if i == 1 else 'judge']} for i in range(5)]
        self.assertTrue(validate_panel([str(i) for i in range(5)], users, '0'))
        rounds = [{'id': str(i), 'category_id': str(i), 'participant_ids': list('abcdef'), 'phase': 'final', 'status': 'validated',
                   'ballots': {'t': {'original': {'ranking': list('abcdef')}}},
                   'result': {'reference_ranking': list('abcdef'), 'reference_version': 1}} for i in range(4)]
        rounds += [{'id': 'elim', 'phase': 'elimination', 'participant_ids': list('abcdef'), 'result': None},
                   {'id': 'alone', 'phase': 'final', 'participant_ids': ['a'], 'result': None}]
        report = exam_report({'round_ids': [r['id'] for r in rounds]}, rounds, 't')
        self.assertTrue(report['passed']); self.assertEqual(report['missing'], [])

    def test_exam_resolved_single_qualifier_is_excluded_but_unknown_is_missing(self):
        rounds = [{'id': str(i), 'category_id': str(i), 'phase': 'final', 'status': 'validated',
                   'participant_ids': list('abcdef'), 'ballots': {'t': {'ranking': list('abcdef')}},
                   'result': {'reference_ranking': list('abcdef'), 'reference_version': 1}} for i in range(4)]
        source = {'id': 'source', 'phase': 'elimination', 'status': 'pending', 'result': None}
        future = {'id': 'future', 'category_id': 'fifth', 'phase': 'final', 'status': 'pending',
                  'dependency_id': 'source', 'participant_ids': [], 'ballots': {}, 'result': None}
        rounds += [source, future]
        program = {'round_ids': [str(i) for i in range(4)] + ['future']}
        self.assertEqual(exam_report(program, rounds, 't')['missing'], ['future'])
        source.update(status='validated', result={'qualified': ['a']})
        self.assertTrue(exam_report(program, rounds, 't')['passed'])
        source['result']['qualified'] = ['a', 'b']
        self.assertEqual(exam_report(program, rounds, 't')['missing'], ['future'])
