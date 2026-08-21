/* ============================================================================
   PHAR Cost — ca-pos.js
   Import des rapports de CA des systèmes de caisse et ventilation du chiffre
   d'affaires par catégorie, en miroir du split de consommation du Flash Cost.

   Trois systèmes couverts, cinq formats de rapport :
     Simphony    · Sales Mix                      (HT natif)
     Simphony    · Menu Item Sales by Definition  (HT natif, détail article)
     Lightspeed  · Export comptable               (HT natif, TVA ventilée)
     Lightspeed  · Répartition produits           (TTC seul + offerts/pertes)
     TCPOS       · Analyse articles               (TTC seul, taux dans le libellé)

   RÈGLE CARDINALE — le HT n'est jamais deviné.
   Si le rapport ne donne ni montant HT ni taux de TVA exploitable, le montant
   HT vaut null et la ligne porte une anomalie « taux inconnu ». Un chiffre
   marqué « à vérifier » vaut mieux qu'un ratio faux.
   ============================================================================ */

/* ─── Constantes ─────────────────────────────────────────────── */

const CA_POS_LS_MAPPING = 'phar_ca_mapping_v1';
const CA_POS_LS_IMPORT  = 'phar_ca_import_v1';

/** Taux de TVA suisses en vigueur (spec §2.6). Jamais codés en dur ailleurs. */
const CA_TVA_CH = { restauration: 8.1, emporter: 2.6, hebergement: 3.8 };

/** Tolérance de contrôle sur les totaux, en CHF (spec §6.3). */
const CA_TOLERANCE = 0.02;

/**
 * Libellés à exclure du chiffre d'affaires.
 * Les pourboires ne sont pas du CA : chez TCPOS ils pèsent jusqu'à 2,4% du
 * total du rapport. Les lignes « message » de Lightspeed ne portent aucun
 * montant, seulement un compteur d'envois en cuisine.
 */
const CA_EXCLUSIONS = [
  { motif: /^(tips?|pourboires?|service)$/i,        raison: 'pourboire' },
  { motif: /\(message\)$/i,                          raison: 'message cuisine/bar' },
  { motif: /^message/i,                             raison: 'message cuisine/bar' },
  { motif: /^-{2,}\s*system\s*-{2,}$/i,              raison: 'ligne système' },
  { motif: /^#+\s*system\s*#+$/i,                    raison: 'ligne système' }
];

/* ─── Utilitaires ────────────────────────────────────────────── */

/** Normalise une cellule en nombre, ou null si non numérique. */
function caNum(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const s = String(v).replace(/[\s'’]/g, '').replace(',', '.').replace(/[^\d.\-]/g, '');
  if (s === '' || s === '-' || s === '.') return null;
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}

/** Texte d'une cellule, trimé, '' si vide. */
function caTxt(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

/** Une cellule Simphony vaut « - » quand le niveau hiérarchique ne s'applique pas. */
function caTiret(v) {
  const s = caTxt(v);
  return s === '' || s === '-';
}

/** Index de la première colonne dont l'en-tête correspond à l'un des libellés. */
function caCol(ligne, libelles) {
  for (let j = 0; j < ligne.length; j++) {
    const t = caTxt(ligne[j]).toLowerCase();
    if (!t) continue;
    for (const lib of libelles) {
      if (t === lib.toLowerCase()) return j;
    }
  }
  return -1;
}

/** Cherche la ligne dont la première cellule vaut l'un des libellés, retourne la valeur suivante non vide. */
function caChercheEtiquette(rows, libelles, maxLigne) {
  const fin = Math.min(maxLigne || 30, rows.length);
  for (let i = 0; i < fin; i++) {
    const r = rows[i] || [];
    for (let j = 0; j < r.length; j++) {
      const t = caTxt(r[j]).replace(/\s*:\s*$/, '').toLowerCase();
      if (!t) continue;
      if (libelles.some(l => t === l.toLowerCase())) {
        for (let k = j + 1; k < r.length; k++) {
          const v = caTxt(r[k]);
          if (v) return v;
        }
      }
    }
  }
  return '';
}

/** Cette ligne doit-elle être écartée du CA ? Retourne la raison, ou null. */
function caExclusion(libelle) {
  const l = caTxt(libelle);
  for (const ex of CA_EXCLUSIONS) {
    if (ex.motif.test(l)) return ex.raison;
  }
  return null;
}

/**
 * Extrait un taux de TVA d'un libellé (« Nourriture 8.1% », « PDJ 3.8% »).
 * Retourne null si le libellé n'en porte pas — on ne suppose jamais.
 */
function caTauxDepuisLibelle(libelle) {
  const m = caTxt(libelle).match(/(\d{1,2})[.,](\d)\s*%/);
  if (!m) return null;
  const taux = parseFloat(`${m[1]}.${m[2]}`);
  return taux > 0 && taux < 30 ? taux : null;
}

/** HT à partir d'un TTC et d'un taux. Retourne null si le taux est inconnu. */
function caHtDepuisTtc(ttc, taux) {
  if (ttc === null || taux === null || taux === undefined) return null;
  return ttc / (1 + taux / 100);
}

/** Taux implicite déduit d'un couple (TTC, HT) — sert de contrôle, pas de conversion. */
function caTauxImplicite(ttc, ht) {
  if (!ttc || !ht) return null;
  return (ttc / ht - 1) * 100;
}

/* ─── Périodes ───────────────────────────────────────────────── */

/**
 * Analyse les intervalles de dates rencontrés dans les rapports.
 * Simphony  : « 7/1/2026 - 7/31/2026 »   (M/J/AAAA — format américain)
 * TCPOS     : « 01.07.2026 - 31.07.2026 » ou « 01/05/2026 - 31/05/2026 » (J/M/AAAA)
 * Le format américain de Simphony est un piège : 7/1/2026 est le 1er juillet,
 * pas le 7 janvier. On le distingue par la position du mois > 12.
 */
function caParsePeriode(texte, systeme) {
  const t = caTxt(texte);
  const m = t.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})\s*[-–]\s*(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (!m) return { texte: t, debut: null, fin: null };

  const usa = systeme === 'simphony';
  const lire = (a, b, an) => {
    const jour = usa ? parseInt(b, 10) : parseInt(a, 10);
    const mois = usa ? parseInt(a, 10) : parseInt(b, 10);
    if (mois < 1 || mois > 12 || jour < 1 || jour > 31) return null;
    return `${String(jour).padStart(2, '0')}.${String(mois).padStart(2, '0')}.${an}`;
  };
  return { texte: t, debut: lire(m[1], m[2], m[3]), fin: lire(m[4], m[5], m[6]) };
}

/* ─── Adaptateur · Simphony Sales Mix ────────────────────────── */

function caDetecteSimphonySalesMix(rows) {
  for (let i = 0; i < Math.min(120, rows.length); i++) {
    const r = rows[i] || [];
    if (caTxt(r[0]) === 'Name' && r.some(c => caTxt(c) === 'Sales Net VAT')) return i;
  }
  return -1;
}

function caParseSimphonySalesMix(rows) {
  const hdr = caDetecteSimphonySalesMix(rows);
  const h = rows[hdr];
  const cTTC = caCol(h, ['Gross Sales After Discounts Total']);
  const cHT  = caCol(h, ['Sales Net VAT']);
  const cQte = caCol(h, ['Quantity Sold']);
  const cMG  = caCol(h, ['Percent of Major Group Sales']);
  const cFG  = caCol(h, ['Percent of Family Group Sales']);

  const res = {
    systeme: 'simphony',
    rapport: 'Sales Mix',
    base: 'HT',
    perimetre: caChercheEtiquette(rows, ['Revenue Centers'], 20) || '—',
    periode: caParsePeriode(caChercheEtiquette(rows, ['Business Dates'], 20), 'simphony'),
    groupes: [], total: null, anomalies: []
  };

  let courant = null;
  for (let i = hdr + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const nom = caTxt(r[0]);
    if (!nom) continue;

    const ttc = caNum(r[cTTC]), ht = caNum(r[cHT]), qte = caNum(r[cQte]);
    const niveauHaut = caTiret(r[cMG]) && caTiret(r[cFG]);
    const niveauFamille = !caTiret(r[cMG]) && caTiret(r[cFG]);

    if (niveauHaut) {
      if (nom.toLowerCase() === 'total') { res.total = { ca_ht: ht, ca_ttc: ttc, qte }; continue; }
      courant = {
        code: null, libelle: nom, ca_ht: ht, ca_ttc: ttc, qte,
        taux_tva: caTauxImplicite(ttc, ht), taux_source: 'implicite',
        sous_groupes: [], exclu: caExclusion(nom)
      };
      res.groupes.push(courant);
    } else if (niveauFamille && courant) {
      courant.sous_groupes.push({ libelle: nom, ca_ht: ht, ca_ttc: ttc, qte });
    }
  }
  return res;
}

/* ─── Adaptateur · Simphony Menu Item Sales by Definition ────── */

function caDetecteSimphonyMenuItem(rows) {
  for (let i = 0; i < Math.min(120, rows.length); i++) {
    const r = rows[i] || [];
    if (caTxt(r[0]) === 'Menu Item Name' && r.some(c => /net vat after disc/i.test(caTxt(c)))) return i;
  }
  return -1;
}

function caParseSimphonyMenuItem(rows) {
  const hdr = caDetecteSimphonyMenuItem(rows);
  const h = rows[hdr];
  const cHT  = caCol(h, ['Net VAT After Disc.']);
  const cTTC = caCol(h, ['Gross After Disc.']);
  const cQte = caCol(h, ['Qty Sold']);
  const cRef = caCol(h, ['Menu Item #']);

  const res = {
    systeme: 'simphony',
    rapport: 'Menu Item Sales by Definition',
    base: 'HT',
    perimetre: caChercheEtiquette(rows, ['Revenue Centers'], 20) || '—',
    periode: caParsePeriode(caChercheEtiquette(rows, ['Business Dates'], 20), 'simphony'),
    groupes: [], total: null, anomalies: [],
    // Ce rapport descend directement à l'article : aucun regroupement natif.
    granularite: 'article'
  };

  for (let i = hdr + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const nom = caTxt(r[0]);
    if (!nom) continue;
    const ttc = caNum(r[cTTC]), ht = caNum(r[cHT]), qte = caNum(r[cQte]);
    if (/^total(s|aux)?\s*:?$/i.test(nom)) { res.total = { ca_ht: ht, ca_ttc: ttc, qte }; continue; }
    res.groupes.push({
      code: caTxt(r[cRef]).replace(/\.0$/, ''), libelle: nom,
      ca_ht: ht, ca_ttc: ttc, qte,
      taux_tva: caTauxImplicite(ttc, ht), taux_source: 'implicite',
      sous_groupes: [], exclu: caExclusion(nom)
    });
  }
  res.anomalies.push({
    niveau: 'info',
    message: 'Rapport au niveau article : la correspondance se fait article par article. ' +
             'Le Sales Mix, qui porte les Major Groups, est préférable pour ventiler le CA.'
  });
  return res;
}

/* ─── Adaptateur · Lightspeed export comptable ───────────────── */

function caDetecteLightspeedCompta(rows) {
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const r = rows[i] || [];
    if (/^références? comptables?$/i.test(caTxt(r[0]))) return i;
  }
  return -1;
}

function caParseLightspeedCompta(rows) {
  const hdr = caDetecteLightspeedCompta(rows);
  const h = rows[hdr];
  const cQte    = caCol(h, ['Quantité']);
  const cBrut   = caCol(h, ['Total']);
  const cRabais = caCol(h, ['Rabais']);
  const cTTC    = caCol(h, ['Total TTC Moins les rabais']);
  const cHT     = caCol(h, ['Total HT']);

  // Les trois taux suisses ont chacun leur couple (montant taxé, TVA).
  const taux = [];
  for (let j = 0; j < h.length; j++) {
    const m = caTxt(h[j]).match(/^TVA\s+(\d{1,2}[.,]\d)\s*%$/i);
    if (m) taux.push({ colMontant: j - 1, colTva: j, valeur: parseFloat(m[1].replace(',', '.')) });
  }

  const res = {
    systeme: 'lightspeed',
    rapport: 'Export comptable',
    base: 'HT',
    perimetre: '—',
    periode: { texte: '', debut: null, fin: null },
    groupes: [], total: null, anomalies: []
  };

  for (let i = hdr + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const nom = caTxt(r[0]);
    if (!nom) continue;
    if (/^total\s+chf$/i.test(nom)) {
      res.total = { ca_ht: caNum(r[cHT]), ca_ttc: caNum(r[cTTC]), qte: caNum(r[cQte]) };
      break; // au-delà commence la section des modes de paiement
    }

    // « Cafeterie (30100) » → libellé + code comptable, qui est la clé stable.
    const mc = nom.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    const libelle = mc ? mc[1].trim() : nom;
    const code    = mc ? mc[2].trim() : null;

    // Taux réellement appliqué : celui dont la colonne « montant taxé » est servie.
    let tauxLigne = null, mixte = false;
    for (const t of taux) {
      if (caNum(r[t.colMontant]) !== null) {
        if (tauxLigne !== null) mixte = true;
        tauxLigne = mixte ? null : t.valeur;
      }
    }

    res.groupes.push({
      code, libelle,
      ca_ht:  caNum(r[cHT]),
      ca_ttc: caNum(r[cTTC]),
      brut:   caNum(r[cBrut]),
      rabais: caNum(r[cRabais]),
      qte:    caNum(r[cQte]),
      taux_tva: tauxLigne, taux_source: mixte ? 'mixte' : 'declare',
      sous_groupes: [], exclu: caExclusion(nom)
    });
  }

  res.anomalies.push({
    niveau: 'info',
    message: 'La colonne « Rabais » de cet export agrège rabais et offerts. ' +
             'Pour isoler les offerts, importer en complément la Répartition produits.'
  });
  return res;
}

/* ─── Adaptateur · Lightspeed répartition produits ───────────── */

function caDetecteLightspeedProduits(rows) {
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const r = rows[i] || [];
    if (r.some(c => caTxt(c) === 'SKU') && r.some(c => caTxt(c) === 'Total Montant')) return i;
  }
  return -1;
}

function caParseLightspeedProduits(rows) {
  const hdr = caDetecteLightspeedProduits(rows);
  const h = rows[hdr];
  const cSku    = caCol(h, ['SKU']);
  const cBrut   = caCol(h, ['Total Montant']);
  const cQte    = caCol(h, ['Total Quantité']);
  const cRabais = caCol(h, ['Rabais Montant']);
  const cOffert = caCol(h, ['Offert Montant']);
  const cPerte  = caCol(h, ['Perte Montant']);
  const cRetour = caCol(h, ['Retour Montant']);
  const cNet    = caCol(h, ['Transaction Montant']);

  const res = {
    systeme: 'lightspeed',
    rapport: 'Répartition produits',
    base: 'TTC',
    perimetre: '—',
    periode: { texte: '', debut: null, fin: null },
    groupes: [], total: null, anomalies: []
  };

  let courant = null, premiere = true;
  for (let i = hdr + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const brut0 = r[0];
    const nom = caTxt(brut0);
    if (!nom) continue;

    // Les articles sont indentés sous leur catégorie et portent un SKU.
    const estArticle = /^\s{2,}/.test(String(brut0)) || caTxt(r[cSku]) !== '';
    const ligne = {
      libelle: nom, ca_ttc: caNum(r[cNet]), brut: caNum(r[cBrut]), qte: caNum(r[cQte]),
      rabais: caNum(r[cRabais]), offert: caNum(r[cOffert]),
      perte: caNum(r[cPerte]), retour: caNum(r[cRetour])
    };

    if (estArticle) {
      if (courant) courant.sous_groupes.push(ligne);
    } else if (premiere) {
      res.total = { ca_ht: null, ca_ttc: ligne.ca_ttc, qte: ligne.qte, offert: ligne.offert, rabais: ligne.rabais };
      premiere = false;
    } else {
      courant = Object.assign({
        code: null, ca_ht: null, taux_tva: null, taux_source: 'absent',
        sous_groupes: [], exclu: caExclusion(nom)
      }, ligne);
      res.groupes.push(courant);
    }
  }

  res.anomalies.push({
    niveau: 'bloquant',
    message: 'Ce rapport n\'est qu\'en TTC et ne porte aucun taux de TVA. Le CA HT ne peut pas ' +
             'en être déduit : renseigner un taux par catégorie, ou utiliser l\'export comptable.'
  });
  return res;
}

/* ─── Adaptateur · TCPOS Analyse articles ────────────────────── */

function caDetecteTcpos(rows) {
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    if (/^analyse\s+articles?$/i.test(caTxt((rows[i] || [])[0]))) return i;
  }
  return -1;
}

function caParseTcpos(rows) {
  const res = {
    systeme: 'tcpos',
    rapport: 'Analyse articles',
    base: 'TTC',
    perimetre: caChercheEtiquette(rows, ['Etablissements', 'Établissements'], 25) || '—',
    periode: caParsePeriode(caChercheEtiquette(rows, ['Intervalle date'], 25), 'tcpos'),
    groupes: [], total: null, anomalies: []
  };

  const tvaIncluse = caChercheEtiquette(rows, ['La TVA est inclue dans les montants'], 25);
  if (!/^oui$/i.test(tvaIncluse)) {
    res.anomalies.push({
      niveau: 'attention',
      message: `Mention « TVA incluse » absente ou différente de Oui (lu : « ${tvaIncluse || '—'} »). Base des montants à vérifier.`
    });
  }

  let courant = null, cBrut = -1, cNet = -1, cQte = -1;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || [];
    const c0 = caTxt(r[0]);
    if (!c0) continue;

    // « Groupe | 1 | | | Nourriture 8.1% »
    if (/^groupe\s*$/i.test(c0)) {
      const suite = r.slice(1).map(caTxt).filter(v => v !== '');
      const code = suite.length > 1 ? suite[0] : null;
      const libelle = suite.length > 1 ? suite.slice(1).join(' ').trim() : (suite[0] || '');
      const taux = caTauxDepuisLibelle(libelle);
      courant = {
        code, libelle: libelle.replace(/^[*#\s]+|[*#\s]+$/g, '') || libelle,
        ca_ht: null, ca_ttc: 0, qte: 0,
        taux_tva: taux, taux_source: taux !== null ? 'libelle' : 'absent',
        sous_groupes: [], exclu: caExclusion(libelle.replace(/^[*#\s]+|[*#\s]+$/g, '')),
        controle: null
      };
      res.groupes.push(courant);
      continue;
    }

    // En-tête de colonnes, réémis à chaque groupe et libellé de façon variable.
    if (/^article\s*$/i.test(c0)) {
      cBrut = caCol(r, ['Brut', 'Montant brut']);
      cNet  = caCol(r, ['Montant Net', 'Montant net']);
      cQte  = caCol(r, ['Pièces vendues', 'Pièces Vendues']);
      continue;
    }

    // Totaux — servent de contrôle, jamais de source.
    if (/^total\s+(du\s+)?groupe/i.test(c0)) {
      if (courant) {
        const vals = r.slice(1).map(caNum).filter(v => v !== null);
        courant.controle = vals.length ? { brut: vals[0], net: vals[1] } : null;
      }
      continue;
    }
    if (/^(grand\s+total|total)\s*$/i.test(c0)) {
      const vals = r.slice(1).map(caNum).filter(v => v !== null);
      if (vals.length) res.total = { ca_ht: null, ca_ttc: vals[1], brut: vals[0], qte: vals[2] };
      continue;
    }

    // Ligne d'article : on somme, le total du rapport ne sert qu'à vérifier.
    if (courant && cNet >= 0) {
      const net = caNum(r[cNet]);
      if (net === null) continue;
      const lib = caTxt(r[1]) || c0;
      courant.sous_groupes.push({ code: c0, libelle: lib, ca_ttc: net, brut: caNum(r[cBrut]), qte: caNum(r[cQte]) });
      courant.ca_ttc += net;
      courant.qte += caNum(r[cQte]) || 0;
    }
  }

  // Contrôle somme des articles vs total annoncé par le rapport.
  for (const g of res.groupes) {
    if (g.controle && g.controle.net !== null && g.controle.net !== undefined) {
      const ecart = g.ca_ttc - g.controle.net;
      if (Math.abs(ecart) > CA_TOLERANCE) {
        res.anomalies.push({
          niveau: 'attention',
          message: `Groupe « ${g.libelle} » : somme des articles ${g.ca_ttc.toFixed(2)} ≠ total du rapport ${g.controle.net.toFixed(2)} (écart ${ecart.toFixed(2)} CHF).`
        });
      }
    }
    if (g.taux_tva === null && !g.exclu) {
      res.anomalies.push({
        niveau: 'bloquant',
        message: `Groupe « ${g.libelle} » : aucun taux de TVA dans le libellé. Le CA HT ne peut pas être calculé sans que le taux soit renseigné.`
      });
    }
  }
  return res;
}

/* ─── Détection et dispatch ──────────────────────────────────── */

const CA_ADAPTATEURS = [
  { id: 'simphony_salesmix',   systeme: 'simphony',   nom: 'Simphony · Sales Mix',                    detecte: caDetecteSimphonySalesMix,   parse: caParseSimphonySalesMix },
  { id: 'simphony_menuitem',   systeme: 'simphony',   nom: 'Simphony · Menu Item Sales',              detecte: caDetecteSimphonyMenuItem,   parse: caParseSimphonyMenuItem },
  { id: 'lightspeed_compta',   systeme: 'lightspeed', nom: 'Lightspeed · Export comptable',           detecte: caDetecteLightspeedCompta,   parse: caParseLightspeedCompta },
  { id: 'lightspeed_produits', systeme: 'lightspeed', nom: 'Lightspeed · Répartition produits',       detecte: caDetecteLightspeedProduits, parse: caParseLightspeedProduits },
  { id: 'tcpos_analyse',       systeme: 'tcpos',      nom: 'TCPOS · Analyse articles',                detecte: caDetecteTcpos,              parse: caParseTcpos }
];

/**
 * Identifie le format d'un rapport. `systemeAttendu` restreint la recherche
 * au système choisi par l'utilisateur : si le fichier ne correspond pas, on
 * le dit plutôt que de tenter une lecture au hasard.
 */
function caIdentifie(rows, systemeAttendu) {
  const candidats = systemeAttendu
    ? CA_ADAPTATEURS.filter(a => a.systeme === systemeAttendu)
    : CA_ADAPTATEURS;
  for (const a of candidats) {
    if (a.detecte(rows) >= 0) return a;
  }
  return null;
}

/**
 * Période déduite du nom de fichier, en dernier recours.
 * Lightspeed ne date pas ses exports dans le contenu mais dans le nom :
 * « ..._20260701_20260801.xls ». La borne haute y est exclusive (1er août pour
 * un export de juillet), on la ramène donc au dernier jour inclus.
 */
function caPeriodeDepuisNom(nom) {
  const m = caTxt(nom).match(/(\d{4})(\d{2})(\d{2})[_-](\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  const fin = new Date(Date.UTC(+m[4], +m[5] - 1, +m[6]));
  fin.setUTCDate(fin.getUTCDate() - 1);
  const fmt = d => `${String(d.getUTCDate()).padStart(2,'0')}.${String(d.getUTCMonth()+1).padStart(2,'0')}.${d.getUTCFullYear()}`;
  return { texte: `${m[1]}${m[2]}${m[3]} → ${m[4]}${m[5]}${m[6]} (nom de fichier)`,
           debut: `${m[3]}.${m[2]}.${m[1]}`, fin: fmt(fin), source: 'nom_fichier' };
}

/** Point d'entrée : lignes brutes → rapport normalisé. Lève une erreur explicite. */
function caPosParse(rows, systemeAttendu, nomFichier) {
  const ad = caIdentifie(rows, systemeAttendu);
  if (!ad) {
    const err = systemeAttendu
      ? `Ce fichier ne correspond à aucun rapport connu pour ${systemeAttendu}.`
      : 'Format de rapport non reconnu (Simphony, Lightspeed et TCPOS sont pris en charge).';
    throw new Error(err);
  }
  const res = ad.parse(rows);
  res.adaptateur = ad.id;
  res.adaptateur_nom = ad.nom;
  if ((!res.periode || !res.periode.debut) && nomFichier) {
    const p = caPeriodeDepuisNom(nomFichier);
    if (p) res.periode = p;
  }
  if (!res.periode || !res.periode.debut) {
    res.anomalies.push({ niveau: 'attention',
      message: 'Période non déterminée : ni le contenu ni le nom du fichier ne la portent. À saisir manuellement.' });
  }
  return caPosControle(res);
}

/* ─── Contrôles et consolidation ─────────────────────────────── */

/**
 * Complète le HT quand c'est légitime, et vérifie la cohérence des totaux.
 * Le HT n'est calculé à partir du TTC que si le rapport fournit lui-même le
 * taux — jamais sur une hypothèse.
 */
function caPosControle(res) {
  for (const g of res.groupes) {
    if (g.ca_ht === null && g.ca_ttc !== null && g.taux_tva !== null) {
      g.ca_ht = caHtDepuisTtc(g.ca_ttc, g.taux_tva);
      g.ht_source = 'converti';
    } else if (g.ca_ht !== null) {
      // Un montant obtenu par conversion le reste : ne jamais le repromouvoir
      // en « natif » à un second passage de contrôle.
      if (g.ht_source !== 'converti') g.ht_source = 'natif';
    } else {
      g.ht_source = 'inconnu';
      g.a_verifier = true;
    }
  }

  const retenus = res.groupes.filter(g => !g.exclu);
  const sommeHT  = retenus.reduce((s, g) => s + (g.ca_ht  || 0), 0);
  const sommeTTC = retenus.reduce((s, g) => s + (g.ca_ttc || 0), 0);
  const exclus   = res.groupes.filter(g => g.exclu);

  res.synthese = {
    ca_ht: sommeHT,
    ca_ttc: sommeTTC,
    nb_groupes: retenus.length,
    groupes_sans_ht: retenus.filter(g => g.ca_ht === null).map(g => g.libelle),
    exclus: exclus.map(g => ({ libelle: g.libelle, raison: g.exclu, ca_ttc: g.ca_ttc }))
  };

  // Contrôle vs le total annoncé par le rapport lui-même.
  if (res.total && res.total.ca_ht !== null && res.total.ca_ht !== undefined) {
    const attendu = res.total.ca_ht - exclus.reduce((s, g) => s + (g.ca_ht || 0), 0);
    const ecart = sommeHT - attendu;
    if (Math.abs(ecart) > CA_TOLERANCE) {
      res.anomalies.push({
        niveau: 'attention',
        message: `Somme des groupes ${sommeHT.toFixed(2)} ≠ total du rapport hors exclusions ${attendu.toFixed(2)} (écart ${ecart.toFixed(2)} CHF).`
      });
    }
  }

  if (res.synthese.groupes_sans_ht.length) {
    res.anomalies.push({
      niveau: 'bloquant',
      message: `${res.synthese.groupes_sans_ht.length} groupe(s) sans CA HT exploitable : ${res.synthese.groupes_sans_ht.join(', ')}. ` +
               'Renseigner leur taux de TVA avant de valider.'
    });
  }
  return res;
}

/* ─── Correspondance groupe POS → catégorie PHAR ─────────────── */

/**
 * Le libellé de groupe n'est pas une clé stable : Simphony fusionne les
 * variantes multilingues d'un même Major Group en retenant un libellé
 * arbitraire (« Raummiete » plutôt que « Room rental »), et la taxonomie
 * TCPOS est propre à chaque installation. La correspondance est donc
 * mémorisée par client et par système, et reste éditable.
 */
function caMappingCharge(clientId, systeme) {
  try {
    const tout = JSON.parse(localStorage.getItem(CA_POS_LS_MAPPING)) || {};
    return (tout[`${clientId}::${systeme}`]) || {};
  } catch (e) { return {}; }
}

function caMappingEnregistre(clientId, systeme, mapping) {
  try {
    const tout = JSON.parse(localStorage.getItem(CA_POS_LS_MAPPING)) || {};
    tout[`${clientId}::${systeme}`] = mapping;
    localStorage.setItem(CA_POS_LS_MAPPING, JSON.stringify(tout));
  } catch (e) {}
}

/**
 * Suggestion d'affectation pour un libellé de groupe.
 *
 * Deux axes, volontairement distincts :
 *  - `axe`       food | beverage | autre — c'est le seul découpage dont le food
 *                cost a besoin (spec §2.3) et le seul qu'on puisse déduire de
 *                façon fiable d'un libellé de caisse.
 *  - `categorie` catégorie PHAR fine (Vins, Bières…), purement indicative.
 *                Les catégories du Flash Cost décrivent ce qu'on ACHÈTE
 *                (Viande, Poisson, Épicerie) ; les groupes de caisse décrivent
 *                ce qu'on VEND. Les deux ne se recouvrent que du côté boissons,
 *                où un groupe « Wine » correspond bien à la catégorie « Vins ».
 *                Côté food, un groupe « Food » n'est ventilable en aucune
 *                catégorie d'achat : la suggestion reste nulle.
 *
 * Toute suggestion est à valider par l'utilisateur ; rien n'est enregistré tant
 * qu'il n'a pas confirmé.
 */
const CA_SUGGESTIONS = [
  { axe: 'beverage', cat: 'Champagnes & Mousseux', kw: ['champagne', 'sparkling', 'prosecco', 'mousseux', 'cava', 'sekt'] },
  { axe: 'beverage', cat: 'Vins',                  kw: ['wine', 'vin', 'vins', 'wein', 'rotwein', 'weisswein'] },
  { axe: 'beverage', cat: 'Bières',                kw: ['beer', 'biere', 'bière', 'bier'] },
  { axe: 'beverage', cat: 'Spiritueux',            kw: ['spirits', 'spiritueux', 'alcool', 'alkohol', 'liqueur', 'likör', 'digestif', 'aperitif', 'apéritif', 'cocktail', 'cocktails', 'whisky', 'gin', 'vodka', 'rum', 'rhum', 'grappa', 'tequila', 'vermouths'] },
  { axe: 'beverage', cat: 'Café & Thé',            kw: ['coffee', 'café', 'cafe', 'cafeterie', 'caféterie', 'tea', 'thé', 'hot beverages', 'heissgetränke'] },
  { axe: 'beverage', cat: 'Boissons sans alcool',  kw: ['non alcoholic beverages', 'alkoholfreie getränke', 'minerales', 'minérales', 'mineralwater', 'softdrinks', 'juices', 'jus', 'drinks', 'boissons'] },
  { axe: 'autre',    cat: 'Autres',                kw: ['room rental', 'raummiete', 'location de salle', 'laundry', 'av equipment', 'flowers', 'tobacco', 'tabac', 'cigare', 'cigars', 'miscellaneous', 'divers', 'non food', 'tips', 'pourboire'] },
  { axe: 'food',     cat: null,                    kw: ['food', 'nourriture', 'cuisine', 'menu', 'plat', 'plat chaud', 'entrée', 'entree', 'starters', 'breakfast', 'pdj', 'petit dejeuner', 'petit déjeuner', 'buffet', 'snacks', 'grignotage', 'dessert', 'desserts', 'glace', 'glaces', 'eis', 'viennoiserie', 'garniture', 'traiteur', 'banquet', 'cheese', 'kids'] }
];

/** Le libellé contient-il ce mot-clé en tant que mot, et non en sous-chaîne ? */
function caContientMot(libelle, motcle) {
  // Les mots-clés sont des mots ordinaires : on compare par découpage du
  // libellé plutôt qu'en construisant une expression régulière à échapper.
  const lettre = c => /[a-zà-ÿ0-9]/i.test(c);
  const l = String(libelle).toLowerCase();
  const m = String(motcle).toLowerCase();
  let i = l.indexOf(m);
  while (i >= 0) {
    const avant = i === 0 || !lettre(l[i - 1]);
    const apres = i + m.length >= l.length || !lettre(l[i + m.length]);
    if (avant && apres) return true;
    i = l.indexOf(m, i + 1);
  }
  return false;
}

function caSuggere(libelle) {
  const l = caTxt(libelle).toLowerCase().replace(/[*#]+/g, ' ').trim();
  if (!l) return { axe: null, categorie: null };
  // « non food » doit l'emporter sur « food » : l'ordre du tableau fait foi,
  // et l'axe « autre » y est placé avant l'axe « food ».
  for (const s of CA_SUGGESTIONS) {
    for (const k of s.kw) {
      if (caContientMot(l, k)) return { axe: s.axe, categorie: s.cat };
    }
  }
  return { axe: null, categorie: null };
}

/** Compatibilité : suggestion de catégorie fine seule. */
function caSuggereCategorie(libelle) { return caSuggere(libelle).categorie; }

/**
 * Ventile le CA d'un rapport normalisé selon la table de correspondance.
 * Les groupes non affectés ne sont jamais répartis d'office : ils ressortent
 * en « non affecté », visibles et à traiter (INV-4, aucune ligne ne disparaît).
 *
 * `mapping` : { "<libellé de groupe>": { axe, categorie } }
 */
function caVentile(res, mapping) {
  const parAxe = { food: 0, beverage: 0, autre: 0 };
  const parCategorie = {};
  const nonAffectes = [];
  let totalFB = 0;

  for (const g of res.groupes) {
    if (g.exclu) continue;
    const m = mapping[g.libelle];
    if (!m || !m.axe) { nonAffectes.push({ libelle: g.libelle, ca_ht: g.ca_ht, ca_ttc: g.ca_ttc, raison: 'non affecté' }); continue; }
    if (g.ca_ht === null) { nonAffectes.push({ libelle: g.libelle, ca_ht: null, ca_ttc: g.ca_ttc, raison: 'HT inconnu' }); continue; }

    parAxe[m.axe] = (parAxe[m.axe] || 0) + g.ca_ht;
    if (m.categorie) parCategorie[m.categorie] = (parCategorie[m.categorie] || 0) + g.ca_ht;
    if (m.axe === 'food' || m.axe === 'beverage') totalFB += g.ca_ht;
  }

  return {
    par_axe: parAxe,
    par_categorie: parCategorie,
    // Le CA de référence du food cost exclut le hors-F&B (location de salle,
    // blanchisserie, AV, fleurs…), sans quoi le ratio est mécaniquement dilué.
    ca_ht_fb: totalFB,
    ca_ht_food: parAxe.food || 0,
    ca_ht_beverage: parAxe.beverage || 0,
    ca_ht_autre: parAxe.autre || 0,
    non_affectes: nonAffectes
  };
}

/* ─── Interface — import du rapport de CA dans le Flash Cost ─── */

let _caRapport = null;   // dernier rapport analysé
let _caMapping = {};     // { "<groupe>": { axe, categorie, taux } }

const CA_SYSTEMES = [
  { id: 'simphony',   nom: 'Oracle Simphony',  aide: 'Sales Mix (recommandé) ou Menu Item Sales by Definition' },
  { id: 'lightspeed', nom: 'Lightspeed',       aide: 'Export comptable (recommandé) ou Répartition produits' },
  { id: 'tcpos',      nom: 'TCPOS',            aide: 'Analyse articles' }
];

function caFmt(n, dec) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return n.toLocaleString('fr-CH', { minimumFractionDigits: dec === undefined ? 2 : dec,
                                     maximumFractionDigits: dec === undefined ? 2 : dec });
}

function caPosAide() {
  const sys = document.getElementById('ca-pos-systeme');
  const el  = document.getElementById('ca-pos-aide');
  if (!sys || !el) return;
  const s = CA_SYSTEMES.find(x => x.id === sys.value);
  el.textContent = s ? s.aide : '';
}

/** Lecture du fichier déposé, analyse, puis rendu. Aucune erreur n'est avalée. */
function caPosFichier(input) {
  const f = input.files && input.files[0];
  if (!f) return;
  const systeme = document.getElementById('ca-pos-systeme').value || null;
  const zone = document.getElementById('ca-pos-resultat');
  zone.innerHTML = '<div class="alert alert-info">Lecture de ' + f.name + '…</div>';

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true });
      _caRapport = caPosParse(rows, systeme, f.name);
      _caMapping = caMappingCharge(getActiveClient().id, _caRapport.systeme);
      // Pré-remplissage par suggestion, sans rien enregistrer.
      for (const g of _caRapport.groupes) {
        if (!_caMapping[g.libelle]) {
          const s = caSuggere(g.libelle);
          _caMapping[g.libelle] = { axe: s.axe, categorie: s.categorie, taux: null, suggere: true };
        }
      }
      caPosRender();
    } catch (err) {
      zone.innerHTML = '<div class="alert alert-danger"><strong>Import impossible.</strong><br>' +
                       String(err.message || err) + '</div>';
      _caRapport = null;
    }
  };
  reader.onerror = () => {
    zone.innerHTML = '<div class="alert alert-danger">Le fichier n\'a pas pu être lu.</div>';
  };
  reader.readAsArrayBuffer(f);
}

function caPosRender() {
  const r = _caRapport;
  const zone = document.getElementById('ca-pos-resultat');
  if (!r) { zone.innerHTML = ''; return; }

  const v = caVentile(r, _caMapping);
  const cats = (typeof getAllCategories === 'function' ? getAllCategories() : []);

  const bandeau = `
    <div class="card" style="margin-top:12px;">
      <div class="card-body">
        <div style="display:flex;flex-wrap:wrap;gap:24px;align-items:baseline;">
          <div><strong>${r.adaptateur_nom}</strong></div>
          <div>Période : <strong>${r.periode.debut || '?'} → ${r.periode.fin || '?'}</strong></div>
          <div>Périmètre : <strong>${r.perimetre}</strong></div>
          <div>Montants du rapport : <strong>${r.base}</strong></div>
        </div>
      </div>
    </div>`;

  const anomalies = r.anomalies.map(a => {
    const cls = a.niveau === 'bloquant' ? 'alert-danger' : (a.niveau === 'attention' ? 'alert-warning' : 'alert-info');
    return `<div class="alert ${cls}" style="margin-top:8px;">${a.message}</div>`;
  }).join('');

  const exclus = r.synthese.exclus.length
    ? `<div class="alert alert-info" style="margin-top:8px;">Écarté du CA : ` +
      r.synthese.exclus.map(e => `${e.libelle} (${e.raison}, ${caFmt(e.ca_ttc)} CHF TTC)`).join(' · ') + `</div>`
    : '';

  const lignes = r.groupes.map((g, i) => {
    const m = _caMapping[g.libelle] || {};
    const axes = ['food', 'beverage', 'autre'].map(a =>
      `<option value="${a}"${m.axe === a ? ' selected' : ''}>${a}</option>`).join('');
    const opts = ['<option value="">—</option>'].concat(cats.map(c =>
      `<option value="${c}"${m.categorie === c ? ' selected' : ''}>${c}</option>`)).join('');
    const besoinTaux = g.ca_ht === null;
    const champTaux = besoinTaux
      ? `<input type="number" step="0.1" min="0" max="30" placeholder="taux %" value="${m.taux || ''}"
                onchange="caPosSetTaux(${i}, this.value)" style="width:80px;">`
      : `${caFmt(g.taux_tva, 2)}%`;
    const ht = g.ca_ht === null
      ? `<span class="badge badge-warning">à vérifier</span>`
      : caFmt(g.ca_ht);
    return `<tr${g.exclu ? ' style="opacity:.45;"' : ''}>
      <td>${g.libelle}${g.exclu ? ` <span class="badge">${g.exclu}</span>` : ''}</td>
      <td class="num">${caFmt(g.ca_ttc)}</td>
      <td class="num">${ht}</td>
      <td class="num">${champTaux}</td>
      <td><select onchange="caPosSetAxe(${i}, this.value)"${g.exclu ? ' disabled' : ''}>
            <option value="">—</option>${axes}</select></td>
      <td><select onchange="caPosSetCategorie(${i}, this.value)"${g.exclu ? ' disabled' : ''}>${opts}</select></td>
    </tr>`;
  }).join('');

  const nonAff = v.non_affectes.length
    ? `<div class="alert alert-warning" style="margin-top:8px;"><strong>${v.non_affectes.length} groupe(s) non repris dans le CA</strong> : ` +
      v.non_affectes.map(n => `${n.libelle} (${n.raison})`).join(' · ') + `</div>`
    : '';

  zone.innerHTML = bandeau + anomalies + exclus + `
    <div class="card" style="margin-top:12px;">
      <div class="card-body" style="overflow-x:auto;">
        <table class="table">
          <thead><tr>
            <th>Groupe du rapport</th><th class="num">CA TTC</th><th class="num">CA HT</th>
            <th class="num">TVA</th><th>Axe</th><th>Catégorie PHAR</th>
          </tr></thead>
          <tbody>${lignes}</tbody>
        </table>
      </div>
    </div>
    ${nonAff}
    <div class="card" style="margin-top:12px;">
      <div class="card-body">
        <div class="form-grid form-grid-3">
          <div><div class="field-label">CA food HT</div><div style="font-size:18px;font-weight:700;">${caFmt(v.ca_ht_food)} CHF</div></div>
          <div><div class="field-label">CA beverage HT</div><div style="font-size:18px;font-weight:700;">${caFmt(v.ca_ht_beverage)} CHF</div></div>
          <div><div class="field-label">Hors F&amp;B (exclu du ratio)</div><div style="font-size:18px;font-weight:700;">${caFmt(v.ca_ht_autre)} CHF</div></div>
        </div>
        <div style="margin-top:12px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
          <div>CA F&amp;B retenu : <strong style="font-size:20px;">${caFmt(v.ca_ht_fb)} CHF HT</strong></div>
          <button class="btn btn-primary btn-sm" onclick="caPosAppliquer()">Reporter dans le Flash Cost</button>
          <button class="btn btn-outline btn-sm" onclick="caPosEnregistrerMapping()">Mémoriser la correspondance</button>
        </div>
      </div>
    </div>`;
}

function caPosSetAxe(i, val) {
  const g = _caRapport.groupes[i];
  _caMapping[g.libelle] = Object.assign({}, _caMapping[g.libelle], { axe: val || null, suggere: false });
  caPosRender();
}

function caPosSetCategorie(i, val) {
  const g = _caRapport.groupes[i];
  _caMapping[g.libelle] = Object.assign({}, _caMapping[g.libelle], { categorie: val || null, suggere: false });
  caPosRender();
}

/**
 * Saisie manuelle du taux de TVA d'un groupe, quand le rapport ne le porte pas
 * (TCPOS hors libellé, Lightspeed répartition produits). Le HT devient alors
 * calculable — mais il reste marqué comme converti, pas natif.
 */
function caPosSetTaux(i, val) {
  const g = _caRapport.groupes[i];
  const taux = parseFloat(String(val).replace(',', '.'));
  if (!isFinite(taux) || taux < 0 || taux > 30) { g.taux_tva = null; g.ca_ht = null; }
  else {
    g.taux_tva = taux;
    g.taux_source = 'saisi';
    g.ca_ht = caHtDepuisTtc(g.ca_ttc, taux);
    g.ht_source = 'converti';
  }
  _caMapping[g.libelle] = Object.assign({}, _caMapping[g.libelle], { taux: isFinite(taux) ? taux : null });
  // Les anomalies « HT manquant » sont recalculées sur l'état courant : celle
  // du groupe qu'on vient de renseigner, et la synthèse qui les compte.
  _caRapport.anomalies = _caRapport.anomalies.filter(a =>
    !/sans CA HT exploitable/.test(a.message) &&
    !(a.message.indexOf(`« ${g.libelle} »`) >= 0 && /aucun taux de TVA/.test(a.message)));
  caPosControle(_caRapport);
  caPosRender();
}

/**
 * Libellé de période pour la ligne d'historique du Flash Cost.
 * Le rapport étant exporté sur la période voulue, le libellé doit la refléter
 * plutôt que d'afficher un numéro de semaine ISO qui serait faux dès que la
 * période n'est pas un lundi→dimanche.
 *   semaine complète  → « 2026-W27 »
 *   mois complet      → « 2026-07 »
 *   toute autre plage → « 01.07.2026 → 12.07.2026 »
 */
function caLibellePeriode(debut, fin) {
  const lire = s => {
    const m = caTxt(s).match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null;
  };
  const d = lire(debut), f = lire(fin);
  if (!d || !f) return null;

  const jours = Math.round((f - d) / 86400000) + 1;
  if (jours === 7 && d.getDay() === 1) {
    // Même calcul que le Flash Cost quand il est chargé ; sinon, calcul local,
    // pour que le module reste utilisable et testable seul.
    const iso = (typeof _fcISOWeek === 'function') ? _fcISOWeek(d) : (() => {
      const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
      const debutAn = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
      return { year: t.getUTCFullYear(), week: Math.ceil(((t - debutAn) / 86400000 + 1) / 7) };
    })();
    return `${iso.year}-W${String(iso.week).padStart(2, '0')}`;
  }
  const finDuMois = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  if (d.getDate() === 1 && f.getTime() === finDuMois.getTime()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  return `${debut} → ${fin}`;
}

function caPosEnregistrerMapping() {
  if (!_caRapport) return;
  caMappingEnregistre(getActiveClient().id, _caRapport.systeme, _caMapping);
  alert('Correspondance mémorisée pour ce client et ce système de caisse.');
}

/**
 * Report dans la semaine de Flash Cost en cours.
 * Le CA retenu est celui du périmètre F&B : le hors-F&B (location de salle,
 * blanchisserie, AV, fleurs) n'entre pas au dénominateur d'un ratio matière.
 */
function caPosAppliquer() {
  if (!_caRapport) return;
  const v = caVentile(_caRapport, _caMapping);

  if (v.non_affectes.length) {
    const liste = v.non_affectes.map(n => `• ${n.libelle} — ${n.raison}`).join('\n');
    if (!confirm(`${v.non_affectes.length} groupe(s) ne seront pas comptés dans le CA :\n\n${liste}\n\nReporter quand même ?`)) return;
  }

  fcSemaine.ca_ht = Math.round(v.ca_ht_fb * 100) / 100;
  fcSemaine.ca_source = {
    systeme: _caRapport.systeme,
    rapport: _caRapport.adaptateur_nom,
    periode: _caRapport.periode,
    perimetre: _caRapport.perimetre,
    par_axe: v.par_axe,
    par_categorie: v.par_categorie,
    non_affectes: v.non_affectes,
    importe_le: new Date().toISOString()
  };

  // La période du rapport fait foi : le rapport est exporté sur la période
  // voulue, c'est donc elle qui date la ligne, libellé compris.
  if (_caRapport.periode.debut) fcSemaine.debut = _caRapport.periode.debut;
  if (_caRapport.periode.fin)   fcSemaine.fin   = _caRapport.periode.fin;
  const lib = caLibellePeriode(_caRapport.periode.debut, _caRapport.periode.fin);
  if (lib) fcSemaine.semaine = lib;

  // Mêmes appels que la saisie manuelle du CA (fcUpdateCA) : persistance puis
  // rendu. Pas de garde silencieuse — si ces fonctions manquent, le report
  // n'aurait pas eu lieu et il faut le savoir.
  fcSaveAll();
  renderFC4();
  caPosEnregistrerMapping();

  const zone = document.getElementById('ca-pos-resultat');
  zone.insertAdjacentHTML('afterbegin',
    `<div class="alert alert-success"><strong>CA reporté : ${caFmt(v.ca_ht_fb)} CHF HT</strong>
     sur la période ${_caRapport.periode.debut || '?'} → ${_caRapport.periode.fin || '?'}.
     Vérifier que cette période correspond bien à celle des stocks et des achats saisis.</div>`);
}

/* ─── Export Node pour les tests ─────────────────────────────── */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    caPosParse, caIdentifie, caVentile, caSuggere, caSuggereCategorie, caParsePeriode,
    caNum, caTauxDepuisLibelle, caHtDepuisTtc, caPeriodeDepuisNom, caContientMot, caLibellePeriode,
    CA_ADAPTATEURS, CA_TVA_CH, CA_EXCLUSIONS
  };
}
