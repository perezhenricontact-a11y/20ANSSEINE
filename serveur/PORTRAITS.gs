
/* ===================================================================================================
   PORTRAITS FESTIFS — Stéphanie & Henri (v3.0, 10/11/2026)
   Application « Je transforme ma photo » pour les deux fêtes. Le script sert de serveur :
   - la clé de génération d'images (OpenAI) reste dans les propriétés du script (OPENAI_API_KEY), jamais dans le navigateur ;
   - chaque invité a un identifiant (S20-… ou C60-…) et un jeton imprévisible (HMAC-SHA256 avec PF_SECRET), vérifié ici ;
   - les portraits ne sont enregistrés (Drive privé « Portraits festifs ») qu'avec le consentement de l'invité ;
   - la publication au trombinoscope est une autorisation séparée et facultative ;
   - tableau de bord administrateur : …/exec?admin=<PF_ADMIN> (portraits autorisés, favoris, archive ZIP).
   Mise en route (une fois) : installerPortraits() ; puis Henri colle sa clé dans Paramètres du projet › Propriétés du script › OPENAI_API_KEY.
   =================================================================================================== */
const PF = {
  dossier: 'Portraits festifs — Stéphanie & Henri',
  modele: () => PropertiesService.getScriptProperties().getProperty('IMAGE_MODEL') || 'gpt-image-1.5',
  limite: () => Number(PropertiesService.getScriptProperties().getProperty('PF_LIMITE') || 6),            // générations par invité
  conservationJours: () => Number(PropertiesService.getScriptProperties().getProperty('PF_CONSERVATION_JOURS') || 120),
  pageInvites: 'https://perezhenricontact-a11y.github.io/20ANSSEINE/portraits.html',
  casablanca: [
  ["Christophe", "B", "Madame"],
  ["Noura", "B", ""],
  ["Michel", "B", "Madame"],
  ["Oceanne", "B", ""],
  ["Joël ?", "B", "Madame"],
  ["Thanh", "B", ""],
  ["Bastien", "C", "Jenny"],
  ["Yohan", "C", "Madame"],
  ["Sonia", "D", "Hervé"],
  ["Brandon", "F", ""],
  ["Philippe", "F", "Madame"],
  ["Romain", "F", "Madame"],
  ["Philippe", "G", "Dominique"],
  ["Serge", "G", "Madame"],
  ["Antonio", "H", "Véronique"],
  ["Franck", "J", "Véronique"],
  ["Céline", "L", ""],
  ["Cyrille", "L", "Madame"],
  ["Bruno", "L", ""],
  ["Cédric", "L", ""],
  ["Vincent", "L", "Samia"],
  ["Kevin", "M", "Madame"],
  ["Mayade", "D", ""],
  ["Stéphane", "N", "Madame"],
  ["Hervé", "P", ""],
  ["Bruno", "R", "Madame"],
  ["Christophe", "S", "Véronique"],
  ["Julien", "S", "Cindy"],
  ["Jean", "A", "Véronique"],
  ["Reda", "?", ""],
  ["Romain", "B", ""],
  ["Yann", "L", "Camille"],
  ["Mendy", "R", "Madame"],
  ["André", "L", "Françoise"],
  ["André", "P", "Isabelle"],
  ["Philippe", "D", "Véronique"],
  ["Stéphane", "D", "Madame"],
  ["Hugo", "M", ""],
  ["Sophie", "P", ""],
  ["Nicolas", "E", "Madame"],
  ["Laurent", "O", ""],
  ["Steve", "D", ""],
  ["Philippe", "A", ""],
  ["Laurine", "R", ""],
  ["Christophe", "M", "Sylvie"],
  ["Laura", "D", "Louis"],
  ["Yvon", "C", ""],
  ["Christophe", "L", "Houda"],
  ["Didier", "H", "Nathalie"],
  ["Serge", "D", "Marie"],
  ["Maxime", "F", ""],
  ["Jérémy", "S", "Madame"],
  ["Yves", "B", ""],
  ["Jean-François", "F", ""],
  ["Kevin", "L", "Tiphanie"],
  ["Caroline", "B", "Florent"],
  ["Michel", "L", "Line"],
  ["Florent", "N", "Chloé"],
  ["Jordan", "C", ""],
  ["Clément", "D", "Charlène"],
  ["Maryan", "B", ""],
  ["Marina", "B", ""],
  ["Charlotte", "L", "Franck"],
  ["Thierry", "H", "Sabine"],
  ["Éric", "C", ""],
  ["Jean-Pierre", "M", "Sophie"],
  ["Jean-Pierre", "L", ""],
  ["Franck", "B", "Clémentine"],
  ["Arnaud", "V", "Alexandra"],
  ["Sehaile", "E", "Medina"],
  ["Philippe", "Q", "Marie"],
  ["Jean-Luc", "R", ""],
  ["Kevin", "M", ""],
  ["Bernard", "K", "Nathalie"],
  ["Eliane", "P", ""],
  ["Geneviève", "R", ""],
  ["Sébastien", "N", "Karona"],
  ["Romain", "A", "Madame"],
  ["Taïeb", "A", "Jamila"],
  ["Thibault", "S", ""]
  ]
};
const PF_THEMES = {
  marin: 'Transforme la personne de la photo en portrait photographique de marin des années 1950, sur le pont d\'un bateau sur la Seine à Paris. Marinière rayée bleu marine et blanc, foulard rouge, casquette de capitaine ou béret marin à pompon rouge, bois verni, cordages, Tour Eiffel ou pont parisien en arrière-plan, lumière chaleureuse, ambiance rétro, cadrage portrait vertical.',
  maroc: 'Transforme la personne de la photo en portrait photographique festif à Casablanca, sur un terrain de pétanque avec un cochonnet. Djellaba ou caftan coloré et élégant, tarbouche rouge ou foulard élégant, babouches visibles si le cadrage le permet, une boule de pétanque tenue naturellement à la main, lanternes, mosaïques (zelliges), palmiers, architecture casablancaise, cadrage portrait vertical.'
};
const PF_AMBIANCES = { classique: 'Ambiance classique et élégante.', retro: 'Ambiance rétro et humoristique, avec une touche d\'humour joyeuse.', festive: 'Ambiance très festive et décalée, pleine de gaieté.' };
const PF_VISAGE = 'Exigence absolue : préserve exactement le visage de la personne, son âge apparent, ses yeux, ses cheveux, son sourire, sa couleur de peau et ses traits caractéristiques ; ne remplace jamais son visage par un visage générique. Photoréalisme. Portrait individuel d\'une seule personne. Aucun texte ajouté.';

function pfCle(p, i) { return String(p + ' ' + i).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function pfInvites() {   // liste fermée des deux fêtes : id → {id, fete, prenom, initiale, avec}
  const L = {};
  CFG.invites.forEach(i => { const id = 'S20-' + pfCle(i[0], i[1]); L[id] = { id, fete: 'seine20', prenom: i[0], initiale: i[1], avec: i[3] || '' }; });
  PF.casablanca.forEach(i => { const id = 'C60-' + pfCle(i[0], i[1]); L[id] = { id, fete: 'casa60', prenom: i[0], initiale: i[1], avec: i[2] || '' }; });
  return L;
}
function pfJeton(id) {
  const secret = PropertiesService.getScriptProperties().getProperty('PF_SECRET');
  const h = Utilities.computeHmacSha256Signature(id, secret);
  return h.slice(0, 12).map(b => ((b + 256) % 256).toString(16).padStart(2, '0')).join('');   // 24 caractères hexadécimaux, imprévisibles sans le secret
}
function pfVerifier(id, jeton) {
  const inv = pfInvites()[String(id || '')];
  if (!inv || !jeton) return null;
  const attendu = pfJeton(inv.id), recu = String(jeton).toLowerCase();
  if (attendu.length !== recu.length) return null;
  let d = 0; for (let k = 0; k < attendu.length; k++) d |= attendu.charCodeAt(k) ^ recu.charCodeAt(k);   // comparaison à temps constant
  return d === 0 ? inv : null;
}
function pfCodeManuel(id) { return id + '-' + pfJeton(id).slice(0, 8); }   // affiché sous le QR code
function pfDepuisCode(code) {   // « S20-sophie-p-1a2b3c4d » → id + début de jeton (8 car.)
  const m = String(code || '').trim().toLowerCase().match(/^((?:s20|c60)-[a-z0-9-]+)-([0-9a-f]{8})$/);
  if (!m) return null;
  const vrai = m[1].replace(/^s20/, 'S20').replace(/^c60/, 'C60');
  const inv = pfInvites()[vrai];
  return inv && pfJeton(vrai).slice(0, 8) === m[2] ? { inv, jeton: pfJeton(vrai) } : null;
}

/* ---------- installation (une fois) ---------- */
function installerPortraits() {
  const p = PropertiesService.getScriptProperties();
  if (!p.getProperty('PF_SECRET')) p.setProperty('PF_SECRET', Utilities.getUuid() + Utilities.getUuid());
  if (!p.getProperty('PF_ADMIN')) p.setProperty('PF_ADMIN', Utilities.getUuid().replace(/-/g, ''));
  if (!p.getProperty('PF_LIMITE')) p.setProperty('PF_LIMITE', '6');
  if (!p.getProperty('PF_CONSERVATION_JOURS')) p.setProperty('PF_CONSERVATION_JOURS', '120');
  pfDossier();
  genererCodesPortraits();
  Logger.log('Portraits festifs installés. Tableau de bord : ' + ScriptApp.getService().getUrl() + '?admin=' + p.getProperty('PF_ADMIN'));
  Logger.log('Clé OpenAI : ' + (p.getProperty('OPENAI_API_KEY') ? 'présente' : 'À AJOUTER par Henri dans Paramètres du projet › Propriétés du script (OPENAI_API_KEY)'));
}
function pfDossier(sous) {
  const it = DriveApp.getFoldersByName(PF.dossier);
  const racine = it.hasNext() ? it.next() : DriveApp.createFolder(PF.dossier);   // dossier privé (non partagé)
  if (!sous) return racine;
  const s = racine.getFoldersByName(sous);
  return s.hasNext() ? s.next() : racine.createFolder(sous);
}
function genererCodesPortraits() {   // onglet privé de la feuille : identifiant, invité, lien personnel (QR), code manuel
  const ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SS_ID'));
  const sh = ss.getSheetByName('Portraits — codes') || ss.insertSheet('Portraits — codes');
  const rows = [['Fête', 'Identifiant', 'Invitation', 'Lien personnel (QR code)', 'Code manuel', 'Générations', 'Portraits enregistrés', 'Publication autorisée']];
  Object.values(pfInvites()).forEach(i => rows.push([i.fete === 'seine20' ? '20 ans sur la Seine' : 'Casablanca', i.id, i.prenom + ' ' + i.initiale + '.' + (i.avec ? ' & ' + i.avec : ''),
    PF.pageInvites + '?invite=' + i.id + '&token=' + pfJeton(i.id), pfCodeManuel(i.id), '', '', '']));
  sh.clear(); sh.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  sh.getRange(1, 1, 1, rows[0].length).setFontWeight('bold').setBackground('#13294b').setFontColor('#fff3df');
  sh.setFrozenRows(1); sh.autoResizeColumns(1, 3);
  Logger.log('Codes portraits : ' + (rows.length - 1) + ' invitations.');
}

/* ---------- compteurs et journal (propriétés du script, sans donnée personnelle) ---------- */
function pfCompteur(id, delta) {
  const p = PropertiesService.getScriptProperties(), k = 'PF_N_' + id, n = Number(p.getProperty(k) || 0) + (delta || 0);
  if (delta) p.setProperty(k, String(n));
  return n;
}

/* ---------- API appelée par la page invités (POST, corps JSON en texte) ---------- */
function doPost(e) {
  let r;
  try {
    const q = JSON.parse(e.postData.contents || '{}');
    if (q.action === 'code') { const t = pfDepuisCode(q.code); r = t ? { ok: true, invite: t.inv.id, token: t.jeton } : { ok: false, erreur: 'Code inconnu. Vérifiez-le ou utilisez votre QR code.' }; }
    else {
      const inv = pfVerifier(q.invite, q.token);
      if (!inv) r = { ok: false, erreur: 'Lien personnel non valide. Scannez de nouveau votre QR code ou saisissez votre code.' };
      else if (q.action === 'bonjour') r = { ok: true, prenom: inv.prenom, initiale: inv.initiale, fete: inv.fete, restant: Math.max(0, PF.limite() - pfCompteur(inv.id)), configure: !!PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY') };
      else if (q.action === 'generer') r = pfGenerer(inv, q);
      else if (q.action === 'mes-portraits') r = pfMesPortraits(inv);
      else if (q.action === 'effacer') r = pfEffacer(inv);
      else r = { ok: false, erreur: 'Action inconnue.' };
    }
  } catch (err) { r = { ok: false, erreur: 'Demande illisible.' }; }
  return ContentService.createTextOutput(JSON.stringify(r)).setMimeType(ContentService.MimeType.JSON);
}
function pfGenerer(inv, q) {
  const p = PropertiesService.getScriptProperties(), cle = p.getProperty('OPENAI_API_KEY');
  if (!q.consentTraitement) return { ok: false, erreur: 'Merci de cocher le consentement au traitement de votre photo.' };
  if (!PF_THEMES[q.theme]) return { ok: false, erreur: 'Thème inconnu.' };
  if (!cle) return { ok: false, erreur: 'La génération n\'est pas encore activée par Stéphanie et Henri. Revenez un peu plus tard.' };
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  let n; try { n = pfCompteur(inv.id); if (n >= PF.limite()) return { ok: false, erreur: 'Vous avez utilisé toutes vos créations (' + PF.limite() + '). Demandez-en d\'autres à Stéphanie et Henri.' }; pfCompteur(inv.id, 1); } finally { lock.releaseLock(); }
  const m = String(q.photo || '').match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!m) { pfCompteur(inv.id, -1); return { ok: false, erreur: 'Photo illisible : choisissez un fichier JPG ou PNG.' }; }
  const photo = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], 'photo.' + (m[1] === 'image/png' ? 'png' : 'jpg'));
  const droite = q.droite !== false ? 'Si la photographie montre plusieurs personnes, conserve uniquement la personne située tout à droite et retire toutes les autres. ' : '';
  const prompt = PF_THEMES[q.theme] + ' ' + (PF_AMBIANCES[q.ambiance] || PF_AMBIANCES.classique) + ' ' + droite + PF_VISAGE + (q.variante ? ' Propose une variante différente de la précédente (pose, cadrage ou accessoires).' : '');
  const payload = { model: PF.modele(), prompt, image: photo, size: '1024x1536', quality: PropertiesService.getScriptProperties().getProperty('PF_QUALITE') || 'medium', output_format: 'jpeg', n: '1' };
  if (/^gpt-image-1/.test(PF.modele())) payload.input_fidelity = 'high';
  let rep;
  try { rep = UrlFetchApp.fetch('https://api.openai.com/v1/images/edits', { method: 'post', headers: { Authorization: 'Bearer ' + cle }, payload, muteHttpExceptions: true }); }
  catch (err) { pfCompteur(inv.id, -1); return { ok: false, erreur: 'Le service d\'images n\'a pas répondu à temps. Réessayez dans un instant.' }; }
  let data = {}; try { data = JSON.parse(rep.getContentText()); } catch (err) {}
  const b64 = data && data.data && data.data[0] && data.data[0].b64_json;
  if (rep.getResponseCode() !== 200 || !b64) {
    pfCompteur(inv.id, -1);
    Logger.log('Portrait ' + inv.id + ' : échec ' + rep.getResponseCode() + ' ' + (data.error && data.error.message || ''));
    const refus = data.error && /safety|moderation|policy/i.test(data.error.code + ' ' + data.error.message);
    return { ok: false, erreur: refus ? 'Le service a refusé cette photo. Essayez une autre photo, de face et bien éclairée.' : 'La création n\'a pas abouti. Réessayez ; si cela recommence, prévenez Stéphanie et Henri.' };
  }
  let enregistre = false;
  if (q.consentConservation) {   // enregistrement privé seulement avec l'accord de l'invité
    const f = pfDossier(inv.id).createFile(Utilities.newBlob(Utilities.base64Decode(b64), 'image/jpeg', inv.id + '_' + q.theme + '_' + Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyyMMdd-HHmmss') + '.jpg'));
    f.setDescription(JSON.stringify({ theme: q.theme, ambiance: q.ambiance || 'classique', publication: !!q.consentPublication, favori: false, date: new Date().toISOString() }));
    enregistre = true;
  }
  return { ok: true, theme: q.theme, image: 'data:image/jpeg;base64,' + b64, enregistre, restant: Math.max(0, PF.limite() - pfCompteur(inv.id)) };
}
function pfMesPortraits(inv) {   // l'invité ne voit que son propre dossier
  const it = pfDossier().getFoldersByName(inv.id); if (!it.hasNext()) return { ok: true, portraits: [] };
  const L = []; const f = it.next().getFiles();
  while (f.hasNext()) { const x = f.next(); if (x.isTrashed()) continue; const d = JSON.parse(x.getDescription() || '{}'); L.push({ theme: d.theme, date: d.date, publication: d.publication, image: 'data:image/jpeg;base64,' + Utilities.base64Encode(x.getBlob().getBytes()) }); if (L.length >= 6) break; }
  return { ok: true, portraits: L };
}
function pfEffacer(inv) {   // demande d'effacement : tout le dossier de l'invité part à la corbeille
  const it = pfDossier().getFoldersByName(inv.id); let n = 0;
  if (it.hasNext()) { const d = it.next(); const f = d.getFiles(); while (f.hasNext()) { f.next().setTrashed(true); n++; } d.setTrashed(true); }
  Logger.log('Effacement demandé par ' + inv.id + ' : ' + n + ' fichier(s).');
  return { ok: true, efface: n };
}
function purgerPortraits() {   // à lancer ou à programmer : supprime les portraits plus vieux que la durée de conservation
  const limite = Date.now() - PF.conservationJours() * 86400000, d = pfDossier().getFolders(); let n = 0;
  while (d.hasNext()) { const f = d.next().getFiles(); while (f.hasNext()) { const x = f.next(); if (x.getDateCreated().getTime() < limite) { x.setTrashed(true); n++; } } }
  Logger.log('Portraits purgés : ' + n);
}

/* ---------- tableau de bord administrateur (…/exec?admin=<PF_ADMIN>) ---------- */
function pfAdmin(e) {
  const p = PropertiesService.getScriptProperties();
  if (!e.parameter.admin || e.parameter.admin !== p.getProperty('PF_ADMIN')) return HtmlService.createHtmlOutput('<p style="font-family:sans-serif">Accès refusé.</p>');
  if (e.parameter.favori) { const f = DriveApp.getFileById(e.parameter.favori); const d = JSON.parse(f.getDescription() || '{}'); d.favori = !d.favori; f.setDescription(JSON.stringify(d)); }
  const fete = e.parameter.fete || '', theme = e.parameter.theme || '', inv = pfInvites(), lignes = [];
  const d = pfDossier().getFolders();
  while (d.hasNext()) { const dos = d.next(), i = inv[dos.getName()]; if (!i || (fete && i.fete !== fete)) continue; const f = dos.getFiles();
    while (f.hasNext()) { const x = f.next(); if (x.isTrashed()) continue; const m = JSON.parse(x.getDescription() || '{}'); if (!m.publication || (theme && m.theme !== theme)) continue; lignes.push({ i, x, m }); } }
  lignes.sort((a, b) => (b.m.favori - a.m.favori) || a.i.id.localeCompare(b.i.id));
  if (e.parameter.zip) {
    const z = Utilities.zip(lignes.filter(l => e.parameter.zip !== 'favoris' || l.m.favori).map(l => l.x.getBlob().setName(l.i.prenom + '-' + l.i.initiale + '_' + l.m.theme + '_' + l.x.getName())), 'portraits-festifs.zip');
    const fz = pfDossier('_exports').createFile(z);
    return HtmlService.createHtmlOutput('<p style="font-family:sans-serif">Archive prête : <a href="' + fz.getUrl() + '" target="_blank">ouvrir dans Drive et télécharger</a> (' + lignes.length + ' portraits).</p>');
  }
  const base = ScriptApp.getService().getUrl() + '?admin=' + encodeURIComponent(e.parameter.admin);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cartes = lignes.map(l => '<figure' + (l.m.favori ? ' class="fav"' : '') + '><img src="data:image/jpeg;base64,' + Utilities.base64Encode(l.x.getBlob().getBytes()) + '"><figcaption><b>' + esc(l.i.prenom + ' ' + l.i.initiale + '.') + '</b> · ' + (l.m.theme === 'marin' ? 'Marin' : 'Maroc') + '<br><a target="_top" href="' + base + '&fete=' + fete + '&theme=' + theme + '&favori=' + l.x.getId() + '">' + (l.m.favori ? '★ Retirer des favoris' : '☆ Favori') + '</a></figcaption></figure>').join('');
  const lien = (f, t, lib) => '<a target="_top" class="' + (f === fete && t === theme ? 'on' : '') + '" href="' + base + '&fete=' + f + '&theme=' + t + '">' + lib + '</a>';
  return HtmlService.createHtmlOutput('<style>body{font-family:system-ui,sans-serif;color:#13294b;margin:16px}nav a{margin-right:8px;padding:5px 10px;border:1px solid #ccd;border-radius:99px;text-decoration:none;color:#13294b}nav a.on{background:#13294b;color:#fff}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px;margin-top:14px}figure{margin:0;border:1px solid #dde;border-radius:10px;padding:6px}figure.fav{border:3px solid #c69b3b}img{width:100%;border-radius:6px}figcaption{font-size:13px;padding:4px}</style>' +
    '<h2>Portraits festifs — portraits autorisés (' + lignes.length + ')</h2><nav>' + lien('', '', 'Tous') + lien('seine20', '', '20 ans') + lien('casa60', '', 'Casablanca') + lien(fete, 'marin', 'Marin') + lien(fete, 'maroc', 'Maroc') + '</nav>' +
    '<p><a target="_top" href="' + base + '&fete=' + fete + '&theme=' + theme + '&zip=tous">Archive ZIP de cette sélection</a> · <a target="_top" href="' + base + '&fete=' + fete + '&theme=' + theme + '&zip=favoris">ZIP des favoris (trombinoscope)</a></p><div class="g">' + (cartes || '<p>Aucun portrait autorisé pour l\'instant.</p>') + '</div>').setTitle('Portraits festifs — administration');
}
