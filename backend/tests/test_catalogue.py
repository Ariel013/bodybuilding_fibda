import unittest
from decimal import Decimal
from fibda.catalogue import *

class CatalogueTests(unittest.TestCase):
    def test_catalogue_complete(self):
        c=load_catalogue()
        self.assertEqual(len(c['disciplines']),9)
        self.assertEqual(len({r['id'] for r in c['rules']}),len(c['rules']))
        self.assertEqual(len([r for r in c['rules'] if r['discipline']=='bodybuilding' and r['division']=='masters']),14)
        self.assertFalse(any(r['division']=='junior' and r['discipline'] in ('muscular','womens_physique') for r in c['rules']))

    def test_exact_tenth_and_limits(self):
        self.assertEqual(measure('175,1'),Decimal('175.1'))
        for v in ('175.11','NaN','Infinity',0,True):
            with self.assertRaises(DomainError): measure(v)
        self.assertEqual(weight_limit('classic_bodybuilding','senior','175.0'),Decimal('79.0'))
        self.assertEqual(weight_limit('classic_bodybuilding','senior','175.1'),Decimal('82.1'))
        for d,division,expected in [('classic_bodybuilding','junior','82'),('classic_bodybuilding','senior','85'),('classic_physique','junior','84'),('classic_physique','masters','89')]:
            self.assertEqual(weight_limit(d,division,'178'),Decimal(expected))

    def test_annual_age_and_fifteen_uncertainty(self):
        p={'birth_date':'1976-12-31','sex':'F','height_cm':'163','weight_kg':'60','measurements_confirmed':True}
        result=eligibility(p,2026,division='masters',discipline='bikini')
        self.assertEqual(len(result),1); self.assertEqual(result[0]['age'],50)
        p.update(birth_date='2011-12-31',sex='M')
        for d in ('bodybuilding','classic_bodybuilding','mens_physique'):
            result=eligibility(p,2026,division='junior',discipline=d)
            self.assertEqual(len(result),1); self.assertEqual(result[0]['status'],'confirmation_required')
        self.assertEqual(eligibility(p,2026,division='junior',discipline='muscular'),[])

    def test_versioned_coefficients_and_rule_provenance(self):
        c=load_catalogue()
        self.assertEqual(c['version'],'FIBDA-2026-09-22.2')
        expected={('classic_bodybuilding','junior'):[0,1,2,4,5,6,7],
                  ('classic_bodybuilding','senior'):[0,2,4,7,9,11,13],
                  ('classic_physique','junior'):[2,3,4,6,7,8,9],
                  ('classic_physique','senior'):[4,6,8,11,13,15,17]}
        for (discipline,division),coefficients in expected.items():
            self.assertEqual(c['classic_limits']['coefficients'][discipline][division],coefficients)
            for h,k in zip(['168','171','175','180','188','196','196.1'],coefficients):
                self.assertEqual(weight_limit(discipline,division,h),Decimal(h)-100+k)
                if division=='senior':self.assertEqual(weight_limit(discipline,'masters',h),Decimal(h)-100+k)
        self.assertEqual(len(c['sources']),9)
        for source in c['sources'].values():
            self.assertRegex(source['sha256'],r'^[a-f0-9]{64}$')
            self.assertGreater(source['bytes'],0)
            self.assertTrue(source['archive_path'].endswith('.pdf'))
        for rule in c['rules']:
            self.assertIn(rule['source_id'],c['sources'])
            self.assertTrue(rule['source_pages'])
            self.assertTrue(rule['normalization_ids'])
            for identifier in rule['normalization_ids']:
                self.assertIn(identifier,c['normalizations'])

    def test_explicit_snapshot_drives_limit_and_eligibility(self):
        snapshot=load_catalogue()
        snapshot['classic_limits']['coefficients']['classic_physique']['junior'][0]=10
        self.assertEqual(weight_limit('classic_physique','junior','168',snapshot),Decimal('78'))
        person={'birth_date':'2006-01-01','sex':'M','height_cm':'168','weight_kg':'77','measurements_confirmed':True}
        self.assertEqual(eligibility(person,2026,division='junior',discipline='classic_physique'),[])
        self.assertEqual(len(eligibility(person,2026,division='junior',discipline='classic_physique',catalogue=snapshot)),1)
