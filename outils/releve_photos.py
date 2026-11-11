#!/usr/bin/env python3
"""Relevé automatique des photos publiées (20 ans sur la Seine et De Casablanca au cochonnet).

Lit les deux applications Web publiques (les mêmes que les sites), télécharge une vignette de chaque photo
dont la publication est autorisée et range le tout dans le dossier donné (branche « releve » du dépôt).
Aucune donnée privée : ni e-mail, ni téléphone, ni réponse détaillée. Prénom et initiale seulement.
"""
import json, os, re, sys, unicodedata, urllib.request

S20 = 'https://script.google.com/macros/s/AKfycbxjaGQ052N2GCbuNTWya7bgRKs0fUXOK5NubatUm2C6dcphM-uMsP1EWfXLh_LKhL7K/exec'
C60 = 'https://script.google.com/macros/s/AKfycbwQDL-PFspsg7rDw2DOaBLAxYGfSlllPCx__I4PM2E1zd9b4-PnovGeCX2jKmpCDwNmFw/exec?action=public'
UA = {'User-Agent': 'Mozilla/5.0 (releve-photos)'}


def lire(url, binaire=False):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90) as r:
        d = r.read()
        return (d, r.headers.get('Content-Type', '')) if binaire else d.decode('utf-8')


def slug(t):
    t = unicodedata.normalize('NFD', str(t or ''))
    t = ''.join(c for c in t if unicodedata.category(c) != 'Mn').lower()
    return re.sub(r'[^a-z0-9]+', '-', t).strip('-')


def id_drive(url):
    m = re.search(r'(?:/d/|id=)([-\w]{20,})', str(url or ''))
    return m.group(1) if m else ''


def vignette(ident, chemin):
    """Télécharge une vignette JPEG (320 px) de la photo Drive ; renvoie True si le fichier est écrit."""
    for u in ('https://lh3.googleusercontent.com/d/%s=w320-rj' % ident,
              'https://lh3.googleusercontent.com/d/%s=w320' % ident,
              'https://drive.google.com/thumbnail?id=%s&sz=w320' % ident):
        try:
            d, ct = lire(u, True)
            if ct.startswith('image/') and len(d) > 500:
                os.makedirs(os.path.dirname(chemin), exist_ok=True)
                ancien = open(chemin, 'rb').read() if os.path.exists(chemin) else b''
                if d != ancien:
                    open(chemin, 'wb').write(d)
                return True
        except Exception as e:  # noqa
            print('  échec', u.split('=')[0][:60], e)
    return False


def main(dossier):
    etat = {'seine20': [], 'casa60': []}
    # ---- 20 ans sur la Seine
    d = json.loads(lire(S20 + '?t=1'))
    for o in d.get('invites', []):
        ligne = {'cle': slug(o.get('cle')), 'statut': o.get('statut', 'attente')}
        for champ, suffixe in (('photo', ''), ('photoDuo', '-duo'), ('photoAvec', '-avec')):
            ident = id_drive(o.get(champ))
            if ident:
                f = 'seine20/%s%s.jpg' % (ligne['cle'], suffixe)
                if vignette(ident, os.path.join(dossier, f)):
                    ligne[champ] = f
        etat['seine20'].append(ligne)
    # ---- De Casablanca au cochonnet
    d = json.loads(lire(C60 + '&t=1'))
    vus = set()
    for p in d.get('photos', []):
        cle = slug('%s %s' % (p[0], p[1]))
        ident = id_drive(p[2])
        if not ident or cle in vus:
            continue
        vus.add(cle)
        f = 'casa60/%s.jpg' % cle
        if vignette(ident, os.path.join(dossier, f)):
            etat['casa60'].append({'cle': cle, 'photo': f})
    # ---- ménage : on retire les vignettes qui ne sont plus publiées
    gardes = {l[c] for l in etat['seine20'] for c in ('photo', 'photoDuo', 'photoAvec') if c in l} | {l['photo'] for l in etat['casa60']}
    for sous in ('seine20', 'casa60'):
        rep = os.path.join(dossier, sous)
        for nom in (os.listdir(rep) if os.path.isdir(rep) else []):
            if '%s/%s' % (sous, nom) not in gardes:
                os.remove(os.path.join(rep, nom))
    json.dump(etat, open(os.path.join(dossier, 'photos.json'), 'w'), ensure_ascii=False, indent=1, sort_keys=True)
    print('20 ans : %d photos · Casablanca : %d photos' % (sum(1 for l in etat['seine20'] if len(l) > 2), len(etat['casa60'])))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '_releve')
