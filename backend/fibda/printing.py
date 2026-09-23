"""Printable and downloadable documents. Authorization belongs to the API caller."""
import csv
import io
import json
from html import escape

KINDS = {'blank','ballot','recap','registrations','programme','measures','results','rewards','diploma','exams','officials'}
TITLES = dict(blank='Bulletin vierge', ballot='Bulletin individuel', recap='Récapitulatif des bulletins', registrations='Inscriptions', programme='Programme', measures='Mesures', results='Résultats', rewards='Récompenses', diploma='Diplôme', exams='Examens des stagiaires', officials='Officiels')


def document_sections(state, kind, category_id=None, round_id=None, judge_id=None):
    if kind not in KINDS:
        raise ValueError('Document inconnu')
    people = {p['id']: p for p in state.get('people', [])}
    entries = {e['id']: e for e in state.get('entries', [])}
    users = {u['id']: u.get('name', u['id']) for u in state.get('users', [])}
    def judge_name(uid): return users.get(uid, uid)
    def identity(entry_id):
        entry = entries.get(entry_id, {})
        person = people.get(entry.get('person_id'), {})
        return [entry.get('bib', ''), (person.get('first_name', '') + ' ' + person.get('last_name', '')).strip()]
    categories = sorted([c for c in state.get('categories', []) if not category_id or c['id'] == category_id], key=lambda c: c.get('order', 0))
    rounds = [r for r in state.get('rounds', []) if (not round_id or r['id'] == round_id) and (not category_id or r['category_id'] == category_id)]
    sections = []
    if kind in ('blank','ballot','recap','results','diploma'):
        for rnd in rounds:
            cat = next((c for c in state.get('categories', []) if c['id'] == rnd['category_id']), {})
            title = f"{cat.get('name', rnd['category_id'])} - {rnd.get('phase','')} - {rnd.get('status','')}"
            if kind in ('blank', 'ballot', 'recap'):
                panel = rnd.get('panel', list(rnd.get('ballots', {})))
                trainees = rnd.get('trainees', [])
                judges = list(dict.fromkeys(panel + trainees))
                if kind == 'ballot' and not judge_id:
                    continue
                for uid in judges:
                    if judge_id and uid != judge_id:
                        continue
                    role = 'stagiaire' if uid in trainees else 'officiel'
                    label = title + f" - juge {judge_name(uid)} ({role}) - tour version {rnd.get('version', 1)}"
                    if kind == 'blank':
                        selection = rnd.get('phase') == 'elimination'
                        participants = rnd.get('participant_ids', [])
                        rows = [identity(e) + ['[ ]' if selection else '______'] for e in participants]
                        if not participants:
                            label += ' - participants à confirmer'
                            rows = [['______','________________________','[ ]' if selection else '______'] for _ in range(6)]
                        sections.append((label + (f" - sélectionner {rnd.get('quota','')} athlètes" if selection else ' - rangs uniques'), ['Dossard','Athlète','Sélection' if selection else 'Rang'], rows))
                        continue
                    ballot = rnd.get('ballots', {}).get(uid)
                    if not ballot:
                        status = 'Expiré' if uid in rnd.get('expired_trainees', []) else 'Manquant'
                        sections.append((label + ' - ' + status, ['Dossard','Athlète','Vote'], [['','',status]]))
                        continue
                    ordered = ballot.get('ranking', ballot.get('selected', []))
                    rows = [identity(e) + [i + 1 if 'ranking' in ballot else 'Sélectionné'] for i, e in enumerate(ordered)]
                    status = 'Rectifié' if ballot.get('corrections') else 'Reçu'
                    label += f" - {status} - bulletin version {ballot.get('version',1)} - {ballot.get('source','digital')} - reçu {ballot.get('received_at','')}"
                    sections.append((label, ['Dossard','Athlète','Vote'], rows))
            else:
                result = rnd.get('result') or {}
                rows = []
                for i, item in enumerate(result.get('official', [])):
                    eid = item if isinstance(item, str) else item.get('entry_id', item.get('id'))
                    rank = i + 1 if isinstance(item, str) else item.get('rank', i + 1)
                    rows.append([rank] + identity(eid) + ['' if isinstance(item, str) else item.get('score', item.get('total', ''))])
                if kind == 'diploma':
                    if rnd.get('status') not in ('validated', 'published'):
                        continue
                    for row in rows:
                        sections.append(('Diplôme - ' + str(row[2]), ['Compétition', 'Catégorie', 'Classement', 'Dossard'], [[state.get('name',''), cat.get('name',''), row[0], row[1]]]))
                else:
                    sections.append((title + f" - résultat version {result.get('version','-')}", ['Rang','Dossard','Athlète','Points'], rows))
    elif kind in ('registrations', 'measures', 'programme'):
        for category in categories:
            if kind == 'programme':
                rows = [[r.get('phase'),r.get('status'),len(r.get('participant_ids', []))] for r in rounds if r['category_id'] == category['id']]
                sections.append((category['name'], ['Phase','État','Effectif'],rows))
                continue
            rows = []
            for entry in entries.values():
                if entry.get('category_id') != category['id']:
                    continue
                person = people.get(entry['person_id'], {})
                base = identity(entry['id'])
                rows.append(base + ([person.get('height_cm',''),person.get('weight_kg',''),'Oui' if person.get('measurements_confirmed') else 'À contrôler'] if kind == 'measures' else [person.get('club',''),person.get('country',''),'Oui' if entry.get('confirmed') else 'Non']))
            sections.append((category['name'], ['Dossard','Athlète'] + (['Taille cm','Poids kg','Contrôle'] if kind == 'measures' else ['Club','Pays','Confirmé']), rows))
    elif kind == 'officials':
        sections.append(('Officiels', ['Nom','Fonction','Organisation','Pays','Parcours'], [[(p.get('first_name','')+' '+p.get('last_name','')).strip(),p.get('post',''),p.get('organization',''),p.get('country',''),p.get('pedigree','')] for p in state.get('officials',[])]))
    elif kind == 'rewards':
        grouped = {}
        for reward in state.get('rewards', []):
            if category_id and reward.get('category_id') != category_id:
                continue
            if round_id and reward.get('round_id') != round_id:
                continue
            category = next((c for c in categories if c['id'] == reward.get('category_id')), {})
            group = ('Overall - ' if reward.get('kind') == 'overall' else '') + category.get('name', 'Récompenses collectives')
            bib, name = identity(reward.get('entry_id'))
            name = reward.get('collective_name') or name
            row = [reward.get('title',''),bib,name,reward.get('trophy',''),reward.get('medal',''),reward.get('lot',''),str(reward.get('prize',''))+' '+reward.get('currency',''), 'Oui' if reward.get('prepared') else 'Non', 'Oui' if reward.get('delivered') else 'Non']
            grouped.setdefault(group, []).append(row)
        for group, rows in grouped.items():
            sections.append((group, ['Titre','Dossard','Lauréat','Trophée','Médaille','Lot','Prime','Préparé','Remis'], rows))
    elif kind == 'exams':
        from .domain import exam_report
        for program in state.get('exam_programs', []):
            uid = program.get('user_id', '')
            if judge_id and uid != judge_id:
                continue
            report = exam_report(program, state.get('rounds', []), uid)
            mean = (report.get('mean') or {}).get('display', 'N/D')
            title = f"Stagiaire {judge_name(uid)} - moyenne {mean} % - {report['categories']} catégories - {report['pairs']} paires - décision {program.get('decision', 'En attente')}"
            rows = [[d['round_id'], d['score']['display'], d['pairs'], d.get('reference_version','')] for d in report['details']]
            rows += [[rid, 'Manquant ou non comparable', '', ''] for rid in report['missing']]
            sections.append((title, ['Manche','Concordance %','Paires','Version référence'], rows))
    return sections


def render_print(state, kind, category_id=None, round_id=None, judge_id=None):
    sections = document_sections(state, kind, category_id, round_id, judge_id)
    esc = lambda value: escape(str(value if value is not None else ''))
    parts = ['<!doctype html><html lang="fr"><meta charset="utf-8"><title>'+esc(TITLES[kind])+'</title><style>body{font:12pt Arial;color:#142e28;margin:24px}img{height:60px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #879e96;padding:7px;text-align:left}thead{display:table-header-group}tr{break-inside:avoid}section{break-before:page}section:first-of-type{break-before:auto}footer{margin-top:20px;font-size:10pt}@media print{button{display:none}@page{size:A4;margin:15mm}}</style><button onclick="window.print()">Imprimer</button><header><img src="/assets/fibda-logo.jpg" alt="FIBDA"><h1>'+esc(TITLES[kind])+'</h1><p>'+esc(state.get('name',''))+' - '+esc(state.get('date',''))+' - version événement '+esc(state.get('version',''))+'</p></header>']
    if kind == 'diploma':
        parts.append('<style>@page{size:A4 landscape}.diploma{text-align:center;padding:18mm 12mm}.diploma h2{font-size:32pt}.diploma p{font-size:20pt}</style>')
    for title, headers, rows in sections:
        if kind == 'diploma':
            row = rows[0]
            parts.append('<section class="diploma"><h2>'+esc(title)+'</h2><p>'+esc(row[0])+'</p><p>'+esc(row[1])+' - classement '+esc(row[2])+'</p><p>Dossard '+esc(row[3])+'</p><footer>Version événement '+esc(state.get('version',''))+' - Date : __________ Signature : __________________</footer></section>')
            continue
        parts.append('<section><table><thead><tr><th colspan="'+str(len(headers))+'">'+esc(title)+' - version événement '+esc(state.get('version',''))+'</th></tr><tr>'+''.join('<th>'+esc(h)+'</th>' for h in headers)+'</tr></thead><tbody>')
        for row in rows:
            parts.append('<tr>'+''.join('<td>'+esc(c)+'</td>' for c in row)+'</tr>')
        parts.append('</tbody></table><footer>Date : __________ Nom et signature : ____________________</footer></section>')
    if not sections:
        parts.append('<p>Aucune donnée correspondant à cette sélection.</p>')
    parts.append('</html>')
    return ''.join(parts)


def export_document(state, kind, format, **filters):
    sections = document_sections(state, kind, **filters)
    def safe(value):
        text = str(value if value is not None else '')
        return "'" + text if text.lstrip().startswith(('=','+','-','@')) else text
    if format == 'csv':
        output = io.StringIO()
        writer = csv.writer(output)
        for title, headers, rows in sections:
            writer.writerow([safe(title)])
            writer.writerow(headers)
            writer.writerows([[safe(c) for c in row] for row in rows])
        return b'\xef\xbb\xbf'+output.getvalue().encode(), 'text/csv; charset=utf-8', kind+'.csv'
    if format == 'xlsx':
        from openpyxl import Workbook
        wb = Workbook()
        ws = wb.active
        ws.title = TITLES[kind][:31]
        for title, headers, rows in sections:
            ws.append([safe(title)])
            ws.append(headers)
            for row in rows:
                ws.append([safe(c) for c in row])
            ws.append([])
        ws.freeze_panes = 'A3'
        output = io.BytesIO()
        wb.save(output)
        return output.getvalue(), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', kind+'.xlsx'
    if format == 'pdf':
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4, landscape
        output = io.BytesIO()
        page = landscape(A4) if kind == 'diploma' else A4
        styles = getSampleStyleSheet()
        styles['Normal'].fontSize = 8
        styles['Normal'].leading = 11
        centered = ParagraphStyle('Certificate', parent=styles['Title'], fontSize=25, leading=32, alignment=1, spaceAfter=24)
        story = []
        for index, (title, headers, rows) in enumerate(sections):
            if index:
                story.append(PageBreak())
            if kind == 'diploma':
                row = rows[0]
                story += [Spacer(1,40), Paragraph('DIPLÔME',centered), Paragraph(escape(title.removeprefix('Diplôme - ')),centered), Paragraph(escape(str(row[0])),centered), Paragraph(escape(str(row[1]))+' - Classement '+escape(str(row[2])),centered), Paragraph('Dossard '+escape(str(row[3])),styles['Title'])]
                continue
            heading = TITLES[kind] + ' - ' + str(state.get('name','')) + ' - ' + title
            content = [[heading]+['']*(len(headers)-1), headers] + rows
            values = [[Paragraph(escape(str(c if c is not None else '')),styles['Normal']) for c in row] for row in content]
            table = Table(values, repeatRows=2, colWidths=[(page[0]-72)/len(headers)]*len(headers))
            table.setStyle(TableStyle([('SPAN',(0,0),(-1,0)),('GRID',(0,1),(-1,-1),.5,colors.grey),('BACKGROUND',(0,0),(-1,1),colors.HexColor('#d9eee5')),('VALIGN',(0,0),(-1,-1),'TOP')]))
            story.append(table)
        if not story:
            story.append(Paragraph('Aucune donnée correspondant à cette sélection.',styles['Normal']))
        def footer(canvas, doc):
            canvas.setFont('Helvetica',8)
            canvas.drawString(36,32,'Date : __________ Nom et signature : ____________________')
            canvas.drawRightString(page[0]-36,32,'Version événement '+str(state.get('version',''))+' - page '+str(doc.page))
        SimpleDocTemplate(output,pagesize=page,rightMargin=36,leftMargin=36,topMargin=36,bottomMargin=56).build(story,onFirstPage=footer,onLaterPages=footer)
        return output.getvalue(), 'application/pdf', kind+'.pdf'
    raise ValueError('Format attendu csv, xlsx ou pdf')
