#!/usr/bin/env python3
"""Prépare la mise à jour automatique de la page « Gestion des invités » (artefact Claude) à partir du relevé public.

Usage : python3 gestion_public.py <dossier où la base de la page a été exportée> <dossier de sortie>

Lit la branche « releve » de ce dépôt (statuts publics et photos publiées des deux fêtes), puis écrit :
  <sortie>/direct/public.json            le document « direct/public » : statuts publics, date du relevé, date de la vérification
  <sortie>/vignettes/<fête>-<clé>.json   un document par photo nouvelle ou changée (inutile si la page ou la base l'a déjà)
  <sortie>/plan.json                     la liste des documents à écrire dans la base de la page
Aucune donnée privée : ni e-mail, ni téléphone, ni réponse détaillée. Rien n'est envoyé : ce script ne fait que préparer des fichiers.
"""
import base64, datetime, glob, hashlib, io, json, os, re, sys, urllib.request

DEPOT = 'perezhenricontact-a11y/20ANSSEINE'
BRUT = 'https://raw.githubusercontent.com/' + DEPOT + '/releve/'


def lire(url, binaire=False):
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'gestion-public'}), timeout=60) as r:
        d = r.read()
        return d if binaire else d.decode('utf-8')


def date_du_releve():
    """Date du dernier changement constaté par le relevé automatique (dernier enregistrement de la branche « releve »)."""
    try:
        return json.loads(lire('https://api.github.com/repos/' + DEPOT + '/commits/releve'))['commit']['committer']['date']
    except Exception:  # noqa
        m = re.search(r'<updated>([^<]+)</updated>', lire('https://github.com/' + DEPOT + '/commits/releve.atom'))
        return m.group(1)


def vignette(octets):
    """Vignette de 240 px en JPEG (si Pillow est disponible), sinon l'image telle quelle."""
    try:
        from PIL import Image
        im = Image.open(io.BytesIO(octets)).convert('RGB')
        im.thumbnail((240, 480))
        s = io.BytesIO(); im.save(s, 'JPEG', quality=80, optimize=True); octets = s.getvalue()
    except Exception:  # noqa
        pass
    return 'data:image/jpeg;base64,' + base64.b64encode(octets).decode('ascii')


def charger(chemin):
    try:
        return json.load(open(chemin, encoding='utf-8'))
    except Exception:  # noqa
        return None


def main(base, sortie):
    etat = json.loads(lire(BRUT + 'photos.json'))
    releve = date_du_releve()
    maintenant = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
    pub = {'seine20': {}, 'casa60': {}}
    photos = []
    for l in etat.get('seine20', []):
        o = {'st': l.get('statut') or 'attente'}
        if 'avecVient' in l:
            o['av'] = 1 if l['avecVient'] else 0
        if l.get('recu'):
            o['r'] = l['recu']
        f = l.get('photoDuo') or l.get('photo')
        if f:
            o['ph'] = 1; photos.append(('seine20-' + l['cle'], f))
        pub['seine20'][l['cle']] = o
    for l in etat.get('casa60_reponses', []):
        o = {'st': l.get('statut') or 'attente', 'av': 1 if l.get('acc') else 0}
        if l.get('recu'):
            o['r'] = l['recu']
        pub['casa60'][l['cle']] = o
    for l in etat.get('casa60', []):
        pub['casa60'].setdefault(l['cle'], {})['ph'] = 1; photos.append(('casa60-' + l['cle'], l['photo']))

    deja = (charger(os.path.join(base, 'config', 'photos-page.json')) or {}).get('h') or {}   # photos déjà dans la page publiée
    for f in glob.glob(os.path.join(base, 'vignettes', '*.json')):                          # vignettes déjà dans la base
        d = charger(f) or {}
        if d.get('h'):
            deja.setdefault(os.path.basename(f)[:-5] + '#base', d['h'])
    plan = []
    os.makedirs(os.path.join(sortie, 'direct'), exist_ok=True); os.makedirs(os.path.join(sortie, 'vignettes'), exist_ok=True)
    texte = json.dumps(pub, ensure_ascii=False, sort_keys=True)
    ancien = charger(os.path.join(base, 'direct', 'public.json'))
    change = not ancien or ancien.get('json') != texte
    chemin = os.path.join(sortie, 'direct', 'public.json')
    json.dump({'maj': releve, 'verifie': maintenant, 'json': texte}, open(chemin, 'w', encoding='utf-8'), ensure_ascii=False)
    plan.append({'collection': 'direct', 'doc_id': 'public', 'file_path': os.path.abspath(chemin), 'existe': bool(ancien)})
    for ident, f in photos:
        try:
            octets = lire(BRUT + f, True)
        except Exception as e:  # noqa
            print('photo illisible', f, e); continue
        h = hashlib.sha1(octets).hexdigest()[:10]
        if deja.get(ident) == h or deja.get(ident + '#base') == h:
            continue   # la page ou la base a déjà cette photo
        chemin = os.path.join(sortie, 'vignettes', ident + '.json')
        json.dump({'u': vignette(octets), 'h': h, 'maj': maintenant}, open(chemin, 'w', encoding='utf-8'))
        plan.append({'collection': 'vignettes', 'doc_id': ident, 'file_path': os.path.abspath(chemin), 'existe': (ident + '#base') in deja})
    json.dump(plan, open(os.path.join(sortie, 'plan.json'), 'w', encoding='utf-8'), indent=1)
    n20 = sum(1 for o in pub['seine20'].values() if o.get('st') == 'oui'); n60 = sum(1 for o in pub['casa60'].values() if o.get('st') == 'oui')
    print('Relevé public du %s : 20 ans %d oui · Casablanca %d oui · %d photos publiées' % (releve, n20, n60, len(photos)))
    print('Statuts : %s' % ('CHANGEMENT depuis la dernière écriture' if change else 'inchangés'))
    print('Documents à écrire : %d' % len(plan))
    for p in plan:
        print('  %s/%s  (%s)  ←  %s' % (p['collection'], p['doc_id'], 'existe déjà : écrire avec sa version' if p['existe'] else 'nouveau', p['file_path']))


if __name__ == '__main__':
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
