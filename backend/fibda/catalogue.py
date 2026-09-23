"""Catalogue versionné et contrôles morphologiques exacts au dixième."""
import json
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path
from .domain import DomainError


def load_catalogue():
    return json.loads(Path(__file__).with_name('catalogue.json').read_text())


def measure(value):
    if isinstance(value, bool):
        raise DomainError('Mesure positive au dixième requise.')
    try:
        number = Decimal(str(value).replace(',', '.'))
    except (InvalidOperation, ValueError):
        raise DomainError('Mesure invalide.') from None
    if not number.is_finite() or number <= 0 or number * 10 != (number * 10).to_integral_value():
        raise DomainError('Mesure positive au dixième requise, sans arrondi.')
    return number


def weight_limit(discipline, division, height, catalogue=None):
    if division not in ('junior', 'senior', 'masters'):
        raise DomainError('Division inconnue.')
    limits = (catalogue if catalogue is not None else load_catalogue())['classic_limits']
    coefficients = limits['coefficients']
    if discipline not in coefficients:
        return None
    h = measure(height)
    band = next(i for i, maximum in enumerate(limits['upper_inclusive_cm'])
                if maximum is None or h <= Decimal(maximum))
    return h - 100 + Decimal(str(coefficients[discipline][division][band]))



def eligibility(person, event_year, section=None, division=None, discipline=None, catalogue=None):
    catalogue = catalogue if catalogue is not None else load_catalogue()
    try:
        birth = date.fromisoformat(person.get('birth_date', ''))
        year = int(str(event_year)[:4])
        age = year - birth.year
    except (ValueError, TypeError):
        raise DomainError('Date complète et année de compétition requises.') from None
    if age < 0:
        raise DomainError('Naissance postérieure à la compétition.')
    section = section or person.get('section', 'amateur')
    if section not in ('amateur', 'pro'):
        raise DomainError('Section inconnue.')
    proposals = []
    for rule in catalogue['rules']:
        if rule['sex'] != person.get('sex') or (division and rule['division'] != division) or (discipline and rule['discipline'] != discipline):
            continue
        uncertain = age == 15 and rule['discipline'] in ('bodybuilding','classic_bodybuilding','mens_physique')
        if rule['age_min'] is not None and age < rule['age_min'] and not (uncertain and rule['division'] == 'junior' and rule['age_min'] == 16):
            continue
        if rule['age_max'] is not None and age > rule['age_max']:
            continue
        reasons = []
        if uncertain:
            reasons.append('Admissibilité à confirmer — contradiction IFBB à 15 ans.')
        if rule['division'] == 'senior':
            reasons.append('Conditions Senior et autorisation de crossover à contrôler ; aucune borne d’âge Senior inventée.')
        raw = person.get(rule['metric'])
        value = measure(raw) if raw not in (None, '') else None
        if value is not None:
            if rule['lower_exclusive'] is not None and value <= Decimal(rule['lower_exclusive']):
                continue
            if rule['upper_inclusive'] is not None and value > Decimal(rule['upper_inclusive']):
                continue
        else:
            reasons.append('Mesure manquante.')
        limit = None
        if rule['classic_limit'] and person.get('height_cm') not in (None, ''):
            limit = weight_limit(rule['discipline'], rule['division'], person['height_cm'], catalogue)
            if person.get('weight_kg') in (None, ''):
                reasons.append('Poids manquant pour le plafond classique.')
            elif measure(person['weight_kg']) > limit:
                continue
        if not person.get('measurements_confirmed'):
            reasons.append('Mesures à confirmer.')
        proposals.append({'rule_id': rule['id'], 'discipline': rule['discipline'], 'name': rule['name'], 'division': rule['division'], 'section': section, 'age': age,
                          'status': 'confirmation_required' if reasons else 'eligible_measurements_age',
                          'reasons': reasons, 'weight_limit': str(limit) if limit is not None else None,
                          'catalogue_version': catalogue['version'], 'source_id': rule['source_id']})
    return proposals
