/* ============================================================
   FLASH COST — PHAR Cost v1.0
   5 sous-modules : Articles leaders · BL · Stock clôture ·
                    Calcul · Historique
   Préfixe localStorage : phar_fc_
   ============================================================ */

/* ─── Constants ─────────────────────────────────────────────── */
const FC_LS = {
  articles:   'phar_fc_articles_v1',
  semaine:    'phar_fc_semaine_v1',
  historique: 'phar_fc_historique_v1'
};

const FC_FAMILLES = ['Viande', 'Poisson', 'Épicerie', 'Boulangerie-BOF', 'Boissons'];

/* ─── Catégories & TVA ───────────────────────────────────────── */
const FC_CATEGORIES = [
  'Viande', 'Poisson & Fruits de mer', 'Légumes & Fruits',
  'Épicerie sèche', 'Laitier & BOF', 'Boulangerie & Pâtisserie',
  'Vins', 'Champagnes & Mousseux', 'Spiritueux', 'Bières',
  'Boissons sans alcool', 'Café & Thé',
  'Condiments & Sauces', 'Nettoyage', 'Autres'
];

// Catégories alcool → TVA 8.1%
const FC_CAT_ALCOOL = new Set(['Vins','Champagnes & Mousseux','Spiritueux','Bières']);

// Mots-clés par catégorie (normalisés sans accents)
const FC_CAT_KW = {
  'Vins':                  ['vin ','vins','wine','rouge','blanc','rose','rosé','chasselas','pinot','merlot','syrah','gamay','chardonnay','sauvignon','riesling','fendant','dole','dôle','viognier','gewurz','cepage','aigle','calamin','chardonne','obrist'],
  'Champagnes & Mousseux': ['champagne','prosecco','cava','mousseux','petillant','cremant','crémant','spumante','sekt'],
  'Spiritueux':            ['whisky','whiskey','vodka',' gin ','rhum','rum','cognac','armagnac','liqueur','aperol','campari','amaretto','baileys','cointreau','kirsch','brandy','grappa','marc','porto','eaude vie','eau-de-vie','absinthe','pastis','mezcal','tequila','calvados'],
  'Bières':                ['biere','bière','beer',' ale ',' ipa ','lager','stout','pils','blanche','craft','ambrée','ambree','hefeweizen','radler','weizen'],
  'Boissons sans alcool':  ['coca','cola','pepsi','fanta','sprite','limonade','jus d','sirop','minerale','mineralé','thé glacé','ice tea','redbull','energy','tonic','soda','bitter','crodino','schweppes','grenadine','capri','elka'],
  'Café & Thé':            ['cafe','café','coffee','nespresso','expresso','espresso','the ','thé ','tea','infusion','tisane','matcha','lungo','ristretto','nescafe'],
  'Viande':                ['boeuf','bœuf','veau','porc','agneau','mouton','volaille','poulet','canard','foie','filet','entrecote','cote de','jambon','bacon','lardons','saucisse','charcuterie','dinde','lapin','gibier','cerf','sanglier','magret','confit','pigeon'],
  'Poisson & Fruits de mer':['saumon','thon','cabillaud','sole','bar ','daurade','truite','crevette','langoustine','homard','crabe','moule','huitre','huître','coquille','saint-jacques','poulpe','pieuvre','seiche','anguille','fumé','fumee'],
  'Légumes & Fruits':      ['tomate','salade','laitue','epinard','courgette','aubergine','carotte','pomme de terre','oignon','echalote','ail ','poireau','brocoli','chou','champignon','poivron','asperge','artichaut','pomme','poire','fraise','framboise','citron','orange','melon','raisin','figue','banane','mangue','avocat','truffe','bolet'],
  'Laitier & BOF':         ['fromage','beurre','creme','crème','lait','yaourt','yogourt','mozzarella','parmesan','gruyere','gruyère','emmental','roquefort','camembert','brie','ricotta','mascarpone','burrata','feta','raclette','comte','comté','epoisses','marechal'],
  'Boulangerie & Pâtisserie':['pain','baguette','brioche','croissant','madeleine','gateau','tarte','farine','levure','feuilletage','chocolat','cacao','vanille','praline'],
  'Épicerie sèche':        ['pates','pâtes',' riz ','lentille','haricot','quinoa','semoule','huile','vinaigre',' sel ','poivre','epice','epices','herbe','bouillon','fond ','fonds','sauce ','concasse','cornichon','moutarde','mayonnaise','huile d'],
  'Condiments & Sauces':   ['ketchup','tabasco','worcester','soja','nuoc','pesto','tapenade'],
  'Nettoyage':             ['detergent','nettoyant','desinfectant','savon','lessive','eponge','torchon']
};

/* ─── Catégories personnalisées ──────────────────────────────── */
const FC_CUSTOM_CATS_KEY = 'phar_custom_categories_v1';

function loadCustomCategories() {
  try { return JSON.parse(localStorage.getItem(FC_CUSTOM_CATS_KEY)) || []; }
  catch(e) { return []; }
}
function saveCustomCategories(cats) {
  try { localStorage.setItem(FC_CUSTOM_CATS_KEY, JSON.stringify(cats)); } catch(e) {}
}

/** Toutes les catégories (système + personnalisées) */
function getAllCategories() {
  const custom = loadCustomCategories();
  return [...FC_CATEGORIES, ...custom].filter((v,i,a) => a.indexOf(v) === i);
}

/** Ajouter une catégorie personnalisée */
function addCustomCategory(name) {
  name = name.trim();
  if (!name) return;
  const custom = loadCustomCategories();
  if (getAllCategories().map(c=>c.toLowerCase()).includes(name.toLowerCase())) {
    if (typeof showToast === 'function') showToast('Cette catégorie existe déjà.', 'error');
    return false;
  }
  custom.push(name);
  saveCustomCategories(custom);
  if (typeof showToast === 'function') showToast(`✓ Catégorie "${name}" créée`, 'success');
  return true;
}

function deleteCustomCategory(name) {
  let custom = loadCustomCategories();
  custom = custom.filter(c => c !== name);
  saveCustomCategories(custom);
}

/** Détecte automatiquement la catégorie d'un article */
function fcAutoCategory(text) {
  if (!text) return 'Autres';
  const t = (' ' + text.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') + ' ');
  for (const [cat, kws] of Object.entries(FC_CAT_KW)) {
    if (kws.some(kw => t.includes(kw))) return cat;
  }
  return 'Autres';
}

/**
 * Retourne le taux TVA applicable à un achat F&B :
 *   8.1% → alcool (vins, spiritueux, bières, mousseux)
 *   2.6% → tout le reste (food, boissons sans alcool, etc.)
 * Note : 3.8% s'applique UNIQUEMENT aux ventes (PDJ / chambres hotel) — pas aux achats.
 */
function fcAutoTVA(text, categorie) {
  if (categorie && FC_CAT_ALCOOL.has(categorie)) return 8.1;
  const cat = fcAutoCategory(text);
  if (FC_CAT_ALCOOL.has(cat)) return 8.1;
  return 2.6;
}

const FC_TARGET_RATIO = 30; // %

/* ─── Demo fixtures ──────────────────────────────────────────── */
const FC_DEMO_ARTICLES = [
  { id:'fca_1', nom:'Filet de bœuf CH', famille:'Viande',          fournisseur:'Merat',      unite:'kg',     prix_cible:34.90, seuil_alerte:10 },
  { id:'fca_2', nom:'Veau faux-filet',  famille:'Viande',          fournisseur:'Fideco',     unite:'kg',     prix_cible:43.10, seuil_alerte:8  },
  { id:'fca_3', nom:'Saumon fumé Ecosse', famille:'Poisson',       fournisseur:'Fideco',     unite:'kg',     prix_cible:37.34, seuil_alerte:8  },
  { id:'fca_4', nom:'Bolets frais',     famille:'Épicerie',        fournisseur:'Culture',    unite:'kg',     prix_cible:38.00, seuil_alerte:15 },
  { id:'fca_5', nom:'Champignons mélange', famille:'Épicerie',     fournisseur:'Culture',    unite:'kg',     prix_cible:13.75, seuil_alerte:15 },
  { id:'fca_6', nom:'Parmesan AOP 24m', famille:'Boulangerie-BOF', fournisseur:'Fideco',     unite:'kg',     prix_cible:42.00, seuil_alerte:10 },
  { id:'fca_7', nom:'Beurre AOP',       famille:'Boulangerie-BOF', fournisseur:'Stettler',   unite:'kg',     prix_cible:14.00, seuil_alerte:12 },
  { id:'fca_8', nom:'Champagne Beatrice Baron', famille:'Boissons',fournisseur:'MonDrink',   unite:'btl',    prix_cible:14.90, seuil_alerte:10 },
  { id:'fca_9', nom:'Chasselas Romand Obrist',  famille:'Boissons',fournisseur:'Obrist',     unite:'btl',    prix_cible: 5.43, seuil_alerte:10 },
  { id:'fca_10',nom:'Aperol 100cl',     famille:'Boissons',        fournisseur:'MonDrink',   unite:'btl',    prix_cible:18.04, seuil_alerte:10 }
];

function _fcDemoSemaine() {
  return {
    semaine: '2026-W23',
    debut: '01.06.2026',
    fin: '07.06.2026',
    ca_ht: 28000,
    stock_ouverture: { fca_1:8.5, fca_2:4.0, fca_3:2.1, fca_4:1.5, fca_5:3.2, fca_6:1.2, fca_7:2.0, fca_8:12, fca_9:36, fca_10:3 },
    achats:          { fca_1:12.0,fca_2:5.0, fca_3:3.5, fca_4:2.0, fca_5:6.0, fca_6:2.0, fca_7:3.0, fca_8:24, fca_9:48, fca_10:6 },
    stock_fermeture: {},
    bls: []
  };
}

const FC_DEMO_HISTORIQUE = [
  { id:'fch_1', semaine:'2026-W22', debut:'25.05.2026', fin:'31.05.2026', ca_ht:26500, cout_total:7800,  ratio:29.4, detail:[] },
  { id:'fch_2', semaine:'2026-W21', debut:'18.05.2026', fin:'24.05.2026', ca_ht:24800, cout_total:7688,  ratio:31.0, detail:[] },
  { id:'fch_3', semaine:'2026-W20', debut:'11.05.2026', fin:'17.05.2026', ca_ht:27200, cout_total:7888,  ratio:29.0, detail:[] },
  { id:'fch_4', semaine:'2026-W19', debut:'04.05.2026', fin:'10.05.2026', ca_ht:25600, cout_total:8140,  ratio:31.8, detail:[] },
  { id:'fch_5', semaine:'2026-W18', debut:'27.04.2026', fin:'03.05.2026', ca_ht:29100, cout_total:8118,  ratio:27.9, detail:[] },
  { id:'fch_6', semaine:'2026-W17', debut:'20.04.2026', fin:'26.04.2026', ca_ht:23400, cout_total:7254,  ratio:31.0, detail:[] }
];

/* ─── State ──────────────────────────────────────────────────── */
let fcArticles    = [];
let fcSemaine     = null;
let fcHistorique  = [];
let _fcEditId     = null; // article being edited

/* ─── Persistence ────────────────────────────────────────────── */
function fcLoad() {
  try {
    const ra = localStorage.getItem(FC_LS.articles);
    fcArticles = ra ? JSON.parse(ra) : null;
    if (!fcArticles || !fcArticles.length) {
      fcArticles = JSON.parse(JSON.stringify(FC_DEMO_ARTICLES));
    }
    const rs = localStorage.getItem(FC_LS.semaine);
    fcSemaine = rs ? JSON.parse(rs) : _fcDemoSemaine();
    if (!fcSemaine.stock_fermeture) fcSemaine.stock_fermeture = {};
    if (!fcSemaine.achats) fcSemaine.achats = {};

    const rh = localStorage.getItem(FC_LS.historique);
    fcHistorique = rh ? JSON.parse(rh) : JSON.parse(JSON.stringify(FC_DEMO_HISTORIQUE));
  } catch (e) {
    fcArticles   = JSON.parse(JSON.stringify(FC_DEMO_ARTICLES));
    fcSemaine    = _fcDemoSemaine();
    fcHistorique = JSON.parse(JSON.stringify(FC_DEMO_HISTORIQUE));
  }
}

function fcSaveAll() {
  try {
    localStorage.setItem(FC_LS.articles,   JSON.stringify(fcArticles));
    localStorage.setItem(FC_LS.semaine,    JSON.stringify(fcSemaine));
    localStorage.setItem(FC_LS.historique, JSON.stringify(fcHistorique));
  } catch (e) {
    console.error('FC save failed', e);
  }
}

/* ─── Utilities ──────────────────────────────────────────────── */
function fcFmt(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

function fcFmtPct(n) {
  if (n === null || isNaN(n)) return '—';
  return n.toFixed(1) + '%';
}

function fcNorm(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function fcMatchArticle(designation) {
  const nd = fcNorm(designation);
  let best = null, bestScore = 0;
  fcArticles.forEach(a => {
    const na = fcNorm(a.nom);
    if (na === nd) { best = a; bestScore = 2; return; }
    if (nd.length >= 4 && na.length >= 4 && bestScore < 1) {
      if (na.includes(nd) || nd.includes(na)) { best = a; bestScore = 1; }
    }
  });
  return best;
}

/* ─── BL → FC Integration ────────────────────────────────────── */
function fcIntegrateBLAchats(bl) {
  if (!fcSemaine) return [];
  const alerts = [];
  (bl.articles || []).forEach(line => {
    const article = fcMatchArticle(line.designation);
    if (!article) return;
    const id  = article.id;
    const qte = parseFloat(line.quantite) || 0;
    const pu  = parseFloat(line.prix_unitaire_ht) || 0;
    fcSemaine.achats[id] = (fcSemaine.achats[id] || 0) + qte;
    const seuilMax = article.prix_cible * (1 + article.seuil_alerte / 100);
    if (pu > 0 && pu > seuilMax) {
      alerts.push({
        article:    article.nom,
        pu_bl:      pu,
        prix_cible: article.prix_cible,
        ecart_pct:  ((pu - article.prix_cible) / article.prix_cible * 100).toFixed(1)
      });
    }
  });
  fcSaveAll();
  return alerts;
}

/* Hook into persistScannedBL (defined in index.html) */
(function() {
  function _hookPersist() {
    if (typeof window.persistScannedBL !== 'function') return;
    const orig = window.persistScannedBL;
    window.persistScannedBL = function(parsed, fichier) {
      const bl = orig(parsed, fichier);
      const alerts = fcIntegrateBLAchats(bl);
      if (alerts.length) {
        alerts.forEach(al => {
          if (typeof showToast === 'function') {
            showToast(`⚠ Prix anormal : ${al.article} · ${al.pu_bl.toFixed(2)} CHF vs cible ${al.prix_cible.toFixed(2)} (+${al.ecart_pct}%)`, 'error');
          }
        });
      }
      renderFC2BLRapprochement();
      renderFC3();
      renderFC4();
      return bl;
    };
  }
  // Try immediately, also after short delay in case index.html defines it after us
  _hookPersist();
  setTimeout(_hookPersist, 200);
})();

/* ─── MODULE FC-1 : Articles leaders ────────────────────────── */
function renderFC1() {
  const tbody = document.getElementById('fc-articles-tbody');
  const hint  = document.getElementById('fc-art-count');
  if (!tbody) return;
  if (hint) hint.textContent = `${fcArticles.length} article(s) · ${fcArticles.length} leaders actifs`;

  if (!fcArticles.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:48px;color:var(--gray-400);">
      Aucun article leader — cliquez « Ajouter un article ».</td></tr>`;
    return;
  }

  tbody.innerHTML = fcArticles.map(a => `
    <tr>
      <td style="font-weight:600;max-width:220px;">${a.nom}</td>
      <td><span class="badge badge-info">${a.famille}</span></td>
      <td style="font-size:12px;color:var(--gray-500);">${a.fournisseur || '—'}</td>
      <td style="text-align:center;color:var(--gray-500);">${a.unite}</td>
      <td class="num" style="font-weight:700;">${fcFmt(a.prix_cible)} CHF</td>
      <td style="text-align:center;">
        <span style="font-size:12px;font-weight:600;color:${a.seuil_alerte <= 8 ? 'var(--danger)' : a.seuil_alerte <= 12 ? 'var(--warning)' : 'var(--success)'};">
          ${a.seuil_alerte}%
        </span>
      </td>
      <td style="text-align:right;white-space:nowrap;">
        <button class="btn btn-ghost btn-sm" onclick="fcEditArticle('${a.id}')">Modifier</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--danger);" onclick="fcDeleteArticle('${a.id}')">✕</button>
      </td>
    </tr>`).join('');
}

function fcNewArticle() {
  _fcEditId = null;
  document.getElementById('fc-art-nom').value = '';
  document.getElementById('fc-art-famille').value = FC_FAMILLES[0];
  document.getElementById('fc-art-fournisseur').value = '';
  document.getElementById('fc-art-unite').value = 'kg';
  document.getElementById('fc-art-prix').value = '';
  document.getElementById('fc-art-seuil').value = '10';
  document.getElementById('fc-art-modal-title').textContent = 'Ajouter un article leader';
  document.getElementById('fc-art-modal').classList.add('visible');
  setTimeout(() => document.getElementById('fc-art-nom').focus(), 80);
}

function fcEditArticle(id) {
  const a = fcArticles.find(x => x.id === id);
  if (!a) return;
  _fcEditId = id;
  document.getElementById('fc-art-nom').value = a.nom;
  document.getElementById('fc-art-famille').value = a.famille;
  document.getElementById('fc-art-fournisseur').value = a.fournisseur;
  document.getElementById('fc-art-unite').value = a.unite;
  document.getElementById('fc-art-prix').value = a.prix_cible;
  document.getElementById('fc-art-seuil').value = a.seuil_alerte;
  document.getElementById('fc-art-modal-title').textContent = 'Modifier l\'article leader';
  document.getElementById('fc-art-modal').classList.add('visible');
}

function fcSaveArticle() {
  const nom = document.getElementById('fc-art-nom').value.trim();
  if (!nom) { if (typeof showToast === 'function') showToast('Le nom est requis.', 'error'); return; }
  const art = {
    id: _fcEditId || ('fca_' + Math.random().toString(36).slice(2, 10)),
    nom,
    famille:       document.getElementById('fc-art-famille').value,
    fournisseur:   document.getElementById('fc-art-fournisseur').value.trim(),
    unite:         document.getElementById('fc-art-unite').value.trim() || 'kg',
    prix_cible:    parseFloat(document.getElementById('fc-art-prix').value) || 0,
    seuil_alerte:  parseFloat(document.getElementById('fc-art-seuil').value) || 10
  };
  if (_fcEditId) {
    const idx = fcArticles.findIndex(a => a.id === _fcEditId);
    if (idx >= 0) fcArticles[idx] = art;
  } else {
    if (fcSemaine) {
      if (fcSemaine.stock_ouverture[art.id] === undefined) fcSemaine.stock_ouverture[art.id] = 0;
      if (fcSemaine.achats[art.id] === undefined)          fcSemaine.achats[art.id] = 0;
    }
    fcArticles.push(art);
  }
  fcSaveAll();
  document.getElementById('fc-art-modal').classList.remove('visible');
  renderFC1(); renderFC3(); renderFC4(); renderFC2BLRapprochement();
  if (typeof showToast === 'function')
    showToast(_fcEditId ? '✓ Article modifié' : '✓ Article ajouté aux leaders', 'success');
}

function fcDeleteArticle(id) {
  const a = fcArticles.find(x => x.id === id);
  if (!confirm(`Supprimer "${a ? a.nom : id}" de la liste des articles leaders ?`)) return;
  fcArticles = fcArticles.filter(x => x.id !== id);
  fcSaveAll();
  renderFC1(); renderFC3(); renderFC4(); renderFC2BLRapprochement();
  if (typeof showToast === 'function') showToast('Article supprimé.', '');
}

/* ─── FC-4 : Mise à jour période manuelle ────────────────────── */
function fcUpdatePeriodLabel() {
  const debutEl = document.getElementById('fc-date-debut');
  const finEl   = document.getElementById('fc-date-fin');
  if (!fcSemaine || !debutEl || !finEl) return;
  if (debutEl.value) fcSemaine.debut = debutEl.value.trim();
  if (finEl.value)   fcSemaine.fin   = finEl.value.trim();
  fcSaveAll();
  renderFC4();
}

/* ─── FC-4 : Calcul consolidé multi-semaines ────────────────── */

/** Remplit les selects de période à partir de l'historique */
function fcPopulateConsolidePickers() {
  const fromEl = document.getElementById('fc-consol-from');
  const toEl   = document.getElementById('fc-consol-to');
  if (!fromEl || !toEl) return;

  const opts = ['<option value="">— Sélectionner —</option>',
    ...fcHistorique.map(h =>
      `<option value="${h.id}">${h.semaine} · ${h.debut} – ${h.fin}</option>`)
  ].join('');

  fromEl.innerHTML = opts;
  toEl.innerHTML   = opts;

  // Par défaut : toute la plage disponible
  if (fcHistorique.length >= 2) {
    fromEl.value = fcHistorique[fcHistorique.length - 1].id;
    toEl.value   = fcHistorique[0].id;
  }
}

/** Calcule et affiche le flash cost consolidé sur la plage sélectionnée */
function fcRenderConsolide() {
  const fromId = document.getElementById('fc-consol-from')?.value;
  const toId   = document.getElementById('fc-consol-to')?.value;
  const wrap   = document.getElementById('fc-consol-result');
  if (!wrap) return;

  if (!fromId || !toId) {
    wrap.innerHTML = '';
    return;
  }

  // Trouver les indices dans l'historique (trié du plus récent au plus ancien)
  const idxFrom = fcHistorique.findIndex(h => h.id === fromId);
  const idxTo   = fcHistorique.findIndex(h => h.id === toId);
  if (idxFrom < 0 || idxTo < 0) { wrap.innerHTML = ''; return; }

  const iStart = Math.min(idxFrom, idxTo);
  const iEnd   = Math.max(idxFrom, idxTo);
  const slice  = fcHistorique.slice(iStart, iEnd + 1);

  if (!slice.length) { wrap.innerHTML = ''; return; }

  const totalCA    = slice.reduce((s, h) => s + h.ca_ht,      0);
  const totalCout  = slice.reduce((s, h) => s + h.cout_total, 0);
  const ratio      = totalCA > 0 ? (totalCout / totalCA * 100) : 0;
  const nbSemaines = slice.length;
  const periodeStr = `${slice[slice.length - 1].debut} → ${slice[0].fin}`;

  // Agréger par famille sur toute la période
  const parFamille = {};
  slice.forEach(h => {
    (h.detail || []).forEach(d => {
      if (!parFamille[d.famille]) parFamille[d.famille] = 0;
      parFamille[d.famille] += d.cout;
    });
  });

  const ok    = ratio <= FC_TARGET_RATIO;
  const delta = ratio - FC_TARGET_RATIO;

  wrap.innerHTML = `
    <div style="border-top:1px solid var(--gray-200);padding-top:16px;">
      <div style="font-size:11px;color:var(--gray-500);font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:12px;">
        Résultat · ${nbSemaines} semaine(s) · ${periodeStr}
      </div>
      <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px;">
        <div class="kpi kpi-primary" style="padding:14px;">
          <div class="kpi-corner"></div>
          <div class="kpi-label">CA période HT</div>
          <div class="kpi-value" style="font-size:18px;">${fcFmt(totalCA)} <small>CHF</small></div>
          <div class="kpi-foot">${nbSemaines} sem. · moy. ${fcFmt(totalCA/nbSemaines)}</div>
        </div>
        <div class="kpi" style="padding:14px;">
          <div class="kpi-corner"></div>
          <div class="kpi-label">Coût matière</div>
          <div class="kpi-value" style="font-size:18px;">${fcFmt(totalCout)} <small>CHF</small></div>
          <div class="kpi-foot">Moy. ${fcFmt(totalCout/nbSemaines)}/sem.</div>
        </div>
        <div class="kpi ${ok ? 'kpi-success' : delta <= 3 ? 'kpi-warning' : 'kpi-danger'}" style="padding:14px;">
          <div class="kpi-corner"></div>
          <div class="kpi-label">Ratio consolidé</div>
          <div class="kpi-value" style="font-size:22px;">${fcFmtPct(ratio)}</div>
          <div class="kpi-foot">Cible ${FC_TARGET_RATIO}% · écart ${delta >= 0 ? '+' : ''}${delta.toFixed(1)}pt</div>
        </div>
        <div class="kpi" style="padding:14px;">
          <div class="kpi-corner"></div>
          <div class="kpi-label">Semaines analysées</div>
          <div class="kpi-value" style="font-size:22px;">${nbSemaines}</div>
          <div class="kpi-foot">${slice[slice.length-1].semaine} → ${slice[0].semaine}</div>
        </div>
      </div>
      ${Object.keys(parFamille).length ? `
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${Object.entries(parFamille).sort((a,b)=>b[1]-a[1]).map(([f,v]) => `
          <div style="flex:1;min-width:120px;padding:10px 14px;background:var(--phar-navy-faint);border-radius:var(--radius);border:1px solid var(--phar-navy-pale);">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--phar-navy);margin-bottom:3px;">${f}</div>
            <div style="font-family:'Archivo';font-weight:700;font-size:14px;">${fcFmt(v)} CHF</div>
            <div style="font-size:10px;color:var(--gray-500);">${totalCout > 0 ? ((v/totalCout)*100).toFixed(1) : '0.0'}% du coût</div>
          </div>`).join('')}
      </div>` : ''}
      <div style="margin-top:12px;text-align:right;">
        <button class="btn btn-outline btn-sm" onclick="fcExportConsolideExcel(${iStart},${iEnd})">
          Exporter cette période (Excel)
        </button>
      </div>
    </div>`;
}

function fcExportConsolideExcel(iStart, iEnd) {
  if (typeof XLSX === 'undefined') return;
  const slice = fcHistorique.slice(iStart, iEnd + 1);
  const rows = [['Semaine','Période','CA HT (CHF)','Coût matière (CHF)','Ratio (%)']];
  slice.forEach(h => rows.push([h.semaine, `${h.debut} – ${h.fin}`, h.ca_ht, h.cout_total, h.ratio]));
  // Sous-détail par article
  rows.push([]);
  rows.push(['--- Détail par article ---']);
  rows.push(['Semaine','Article','Famille','Consommation','Coût CHF','% CA']);
  slice.forEach(h => {
    (h.detail || []).forEach(d => {
      rows.push([h.semaine, d.nom, d.famille, d.conso, d.cout, d.pct_ca]);
    });
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Flash Cost période');
  XLSX.writeFile(wb, `FlashCost_periode_${new Date().toISOString().slice(0,10)}.xlsx`);
  if (typeof showToast === 'function') showToast('✓ Export Excel généré.', 'success');
}

/* ─── MODULE FC-2 : BL Cumul achats ─────────────────────────── */
function renderFC2BLRapprochement() {
  const wrap = document.getElementById('fc-bl-rapprochement');
  if (!wrap || !fcSemaine) return;

  const totalAchats = fcArticles.reduce((s, a) => {
    return s + (fcSemaine.achats[a.id] || 0) * a.prix_cible;
  }, 0);

  const rows = fcArticles.map(a => {
    const qte   = fcSemaine.achats[a.id] || 0;
    const valeur = qte * a.prix_cible;
    const hasQte = qte > 0;
    return `<tr>
      <td style="font-weight:600;">${a.nom}</td>
      <td><span class="badge badge-info">${a.famille}</span></td>
      <td style="color:var(--gray-500);font-size:12px;">${a.fournisseur || '—'}</td>
      <td style="text-align:right;font-variant-numeric:tabular-nums;">
        ${hasQte ? qte.toFixed(2) : '<span style="color:var(--gray-300)">—</span>'} ${a.unite}
      </td>
      <td style="text-align:right;font-variant-numeric:tabular-nums;font-weight:${hasQte?700:400};">
        ${hasQte ? fcFmt(valeur) + ' CHF' : '<span style="color:var(--gray-300)">—</span>'}
      </td>
      <td style="text-align:center;">
        ${hasQte
          ? '<span class="badge badge-success">Approvisionné</span>'
          : '<span class="badge" style="background:var(--gray-100);color:var(--gray-500);">En attente</span>'}
      </td>
    </tr>`;
  }).join('');

  wrap.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-title">Cumul achats semaine · Articles leaders</div>
        <div class="card-hint">Semaine ${fcSemaine.semaine} · ${fcSemaine.debut} – ${fcSemaine.fin}</div>
      </div>
      <div class="inv-table-scroll">
        <table class="data-table" style="font-size:13px;">
          <thead><tr>
            <th>Article leader</th><th>Famille</th><th>Fournisseur</th>
            <th class="num">Qté achetée</th><th class="num">Valeur estimée</th>
            <th style="text-align:center;">Statut</th>
          </tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr style="background:var(--phar-navy-pale);">
            <td colspan="4" style="padding:12px 16px;font-weight:700;font-size:13px;color:var(--phar-navy);">Total valorisé (au prix cible)</td>
            <td style="text-align:right;font-weight:800;font-family:'Archivo';font-size:15px;color:var(--phar-navy);padding:12px 16px;">${fcFmt(totalAchats)} CHF</td>
            <td></td>
          </tr></tfoot>
        </table>
      </div>
    </div>`;

  // Show price alerts for BLs associated with current week
  const blsThisWeek = (typeof pharBLs !== 'undefined' ? pharBLs : []).filter(bl =>
    fcSemaine.bls && fcSemaine.bls.includes(bl.id)
  );
  if (blsThisWeek.length) {
    const alertLines = [];
    blsThisWeek.forEach(bl => {
      (bl.articles || []).forEach(line => {
        const article = fcMatchArticle(line.designation);
        if (!article) return;
        const pu = parseFloat(line.prix_unitaire_ht) || 0;
        const max = article.prix_cible * (1 + article.seuil_alerte / 100);
        if (pu > max) {
          alertLines.push({ article: article.nom, pu, prix_cible: article.prix_cible,
            ecart: ((pu - article.prix_cible) / article.prix_cible * 100).toFixed(1),
            bl: bl.fournisseur, date: bl.date });
        }
      });
    });
    if (alertLines.length) {
      const alertsHtml = alertLines.map(al => `
        <div class="alert warning" style="margin-bottom:8px;">
          <div class="alert-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
          <div class="alert-content">
            <div class="alert-title">Prix anormal · ${al.article}</div>
            <div class="alert-text">${al.bl} (${al.date}) : <strong>${al.pu.toFixed(2)} CHF</strong> vs prix cible ${al.prix_cible.toFixed(2)} CHF · <strong>+${al.ecart}%</strong></div>
          </div>
        </div>`).join('');
      wrap.insertAdjacentHTML('beforeend', `
        <div class="section-bar" style="margin-top:24px;">
          <div class="section-bar-num">!</div>
          <div class="section-bar-label">Alertes prix semaine en cours</div>
          <div class="section-bar-line"></div>
        </div>
        ${alertsHtml}`);
    }
  }
}

/* ─── MODULE FC-3 : Stock de clôture ─────────────────────────── */
function renderFC3() {
  const tbody   = document.getElementById('fc-stock-tbody');
  const progEl  = document.getElementById('fc-stock-progress');
  const semLbl  = document.getElementById('fc-stock-semaine-label');
  if (!tbody || !fcSemaine) return;

  if (semLbl) semLbl.textContent = `${fcSemaine.semaine} · ${fcSemaine.debut} – ${fcSemaine.fin}`;

  let filled = 0;
  tbody.innerHTML = fcArticles.map(a => {
    const ouv       = parseFloat(fcSemaine.stock_ouverture[a.id]) || 0;
    const achats    = parseFloat(fcSemaine.achats[a.id]) || 0;
    const theorique = ouv + achats;
    const physRaw   = fcSemaine.stock_fermeture[a.id];
    const hasPhys   = physRaw !== null && physRaw !== undefined && physRaw !== '';
    if (hasPhys) filled++;
    const physVal   = hasPhys ? parseFloat(physRaw) : null;
    const ecart     = hasPhys ? physVal - theorique : null;
    const ecartCls  = ecart === null ? '' : Math.abs(ecart) < 0.05 ? 'delta-positive' : ecart < 0 ? 'delta-negative' : 'delta-warning';

    return `<tr>
      <td style="font-weight:600;">${a.nom}
        <div style="font-size:10px;color:var(--gray-500);margin-top:2px;">${a.famille}</div>
      </td>
      <td style="text-align:center;color:var(--gray-500);">${a.unite}</td>
      <td class="num" style="color:var(--gray-500);">${ouv.toFixed(2)}</td>
      <td class="num" style="color:var(--phar-navy);font-weight:600;">${achats.toFixed(2)}</td>
      <td class="num" style="font-weight:700;">${theorique.toFixed(2)}</td>
      <td style="padding:4px 8px;">
        <input type="number" value="${hasPhys ? physVal : ''}"
               step="0.01" min="0" placeholder="saisir…"
               data-fc-stock-id="${a.id}"
               style="text-align:right;width:120px;padding:7px 10px;"
               onchange="fcUpdateStock('${a.id}', this.value)"
               onkeydown="if(event.key==='Enter'||event.key==='Tab'){event.preventDefault();fcFocusNextStock('${a.id}');}">
      </td>
      <td class="num ${ecartCls}" style="font-weight:700;">
        ${ecart !== null
          ? `${ecart >= 0 ? '+' : ''}${ecart.toFixed(2)}`
          : '<span style="color:var(--gray-200)">—</span>'}
      </td>
    </tr>`;
  }).join('');

  if (!fcArticles.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:48px;color:var(--gray-400);">
      Aucun article leader défini. Allez dans <strong>Articles leaders</strong> pour en créer.</td></tr>`;
  }

  // Progress bar
  if (progEl) {
    const total = fcArticles.length;
    const pct   = total > 0 ? (filled / total * 100) : 0;
    const color = pct === 100 ? 'var(--success)' : 'var(--phar-navy)';
    progEl.innerHTML = `
      <div class="ratio-block" style="padding:16px 24px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div>
            <div style="font-family:'Archivo';font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:.05em;">
              Progression de la saisie
            </div>
            <div style="font-size:12px;color:var(--gray-500);margin-top:2px;">
              ${filled === total ? '✓ Tous les articles saisis — prêt pour le calcul.' : `${total - filled} article(s) restant(s)`}
            </div>
          </div>
          <div style="font-family:'Archivo';font-weight:800;font-size:26px;letter-spacing:-.02em;">
            ${filled} <span style="font-size:16px;color:var(--gray-400);font-weight:500;">/ ${total}</span>
          </div>
        </div>
        <div class="ratio-bar" style="height:10px;margin:0;">
          <div class="ratio-fill" style="width:${pct.toFixed(1)}%;background:${color};"></div>
        </div>
      </div>`;
  }
}

function fcUpdateStock(id, val) {
  if (!fcSemaine) return;
  fcSemaine.stock_fermeture[id] = (val === '' || val === null) ? null : parseFloat(val);
  fcSaveAll();
  renderFC3();
  renderFC4();
}

function fcFocusNextStock(currentId) {
  const ids = fcArticles.map(a => a.id);
  const idx = ids.indexOf(currentId);
  if (idx < ids.length - 1) {
    const nextId = ids[idx + 1];
    const el = document.querySelector(`[data-fc-stock-id="${nextId}"]`);
    if (el) el.focus();
  }
}

function fcResetStockFermeture() {
  if (!confirm('Réinitialiser tous les stocks de clôture saisis ?\nLes valeurs seront effacées (les stocks d\'ouverture et achats restent intacts).')) return;
  if (fcSemaine) { fcSemaine.stock_fermeture = {}; fcSaveAll(); }
  renderFC3();
  renderFC4();
  if (typeof showToast === 'function') showToast('Stocks de clôture réinitialisés.', '');
}

/* ─── MODULE FC-4 : Flash Cost calcul ───────────────────────── */
function fcCalcSemaine() {
  if (!fcSemaine) return null;
  const ca = parseFloat(fcSemaine.ca_ht) || 0;
  let coutTotal = 0;
  const parFamille = {};

  const details = fcArticles.map(a => {
    const ouv    = parseFloat(fcSemaine.stock_ouverture[a.id]) || 0;
    const achats = parseFloat(fcSemaine.achats[a.id]) || 0;
    const fermRaw = fcSemaine.stock_fermeture[a.id];
    const ferm   = (fermRaw !== null && fermRaw !== undefined) ? parseFloat(fermRaw) : (ouv + achats);
    const conso  = Math.max(0, ouv + achats - ferm);
    const cout   = conso * a.prix_cible;
    coutTotal   += cout;

    if (!parFamille[a.famille]) parFamille[a.famille] = { cout: 0, nb: 0 };
    parFamille[a.famille].cout += cout;
    parFamille[a.famille].nb++;

    return { ...a, conso, cout, pct_ca: ca > 0 ? (cout / ca * 100) : 0 };
  }).sort((a, b) => b.cout - a.cout);

  const ratio = ca > 0 ? (coutTotal / ca * 100) : 0;
  return { ca, coutTotal, ratio, details, parFamille };
}

function renderFC4() {
  if (!fcSemaine) return;
  const calc = fcCalcSemaine();

  // Fill CA input without interrupting user
  const caEl = document.getElementById('fc-ca-input');
  if (caEl && !caEl.matches(':focus')) caEl.value = fcSemaine.ca_ht || '';

  // Dates éditables
  const debutEl = document.getElementById('fc-date-debut');
  const finEl   = document.getElementById('fc-date-fin');
  if (debutEl && !debutEl.matches(':focus')) debutEl.value = fcSemaine.debut || '';
  if (finEl   && !finEl.matches(':focus'))   finEl.value   = fcSemaine.fin   || '';

  if (!calc) return;

  const prevWeek   = fcHistorique[0];
  const deltaRatio = prevWeek ? calc.ratio - prevWeek.ratio : null;

  const set = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };

  set('fc-kpi-ca',    `${fcFmt(calc.ca)} <small>CHF</small>`);
  set('fc-kpi-cout',  `${fcFmt(calc.coutTotal)} <small>CHF</small>`);
  set('fc-kpi-ratio', `${fcFmtPct(calc.ratio)} <small>ratio</small>`);

  if (deltaRatio !== null) {
    const sign = deltaRatio > 0 ? '+' : '';
    set('fc-kpi-delta', `${sign}${fcFmtPct(deltaRatio)} <small>pts vs S-1</small>`);
  } else {
    set('fc-kpi-delta', '— <small>pts</small>');
  }

  // Color KPI cards
  const ratioCard = document.getElementById('fc-kpi-ratio-card');
  if (ratioCard) {
    ratioCard.className = 'kpi';
    if (calc.ca > 0) {
      const d = calc.ratio - FC_TARGET_RATIO;
      ratioCard.classList.add(d <= 0 ? 'kpi-success' : d <= 3 ? 'kpi-warning' : 'kpi-danger');
    }
  }
  const deltaCard = document.getElementById('fc-kpi-delta-card');
  if (deltaCard && deltaRatio !== null) {
    deltaCard.className = 'kpi';
    if (Math.abs(deltaRatio) >= 1)
      deltaCard.classList.add(deltaRatio < 0 ? 'kpi-success' : 'kpi-warning');
  }

  // Top articles table
  const tbody = document.getElementById('fc-top-tbody');
  if (tbody) {
    if (!calc.details.length || calc.coutTotal === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--gray-400);">
        Aucune donnée — saisissez le stock de clôture.</td></tr>`;
    } else {
      tbody.innerHTML = calc.details.map((a, i) => `
        <tr>
          <td style="color:var(--gray-400);font-size:11px;font-weight:700;">${i + 1}</td>
          <td style="font-weight:600;">${a.nom}</td>
          <td><span class="badge badge-info">${a.famille}</span></td>
          <td class="num">${a.conso > 0.001 ? a.conso.toFixed(2) + ' ' + a.unite : '<span style="color:var(--gray-300)">—</span>'}</td>
          <td class="num" style="font-weight:700;">${a.cout > 0 ? fcFmt(a.cout) + ' CHF' : '<span style="color:var(--gray-300)">—</span>'}</td>
          <td class="num">
            <span style="font-weight:700;color:${a.pct_ca > 10 ? 'var(--danger)' : a.pct_ca > 5 ? 'var(--warning)' : a.pct_ca > 0 ? 'var(--success)' : 'var(--gray-300)'};">
              ${a.pct_ca > 0 ? fcFmtPct(a.pct_ca) : '—'}
            </span>
          </td>
        </tr>`).join('');
    }
  }

  // Famille bars
  const famEl = document.getElementById('fc-famille-bars');
  if (famEl) {
    const entries = Object.entries(calc.parFamille)
      .filter(([, v]) => v.cout > 0)
      .sort((a, b) => b[1].cout - a[1].cout);
    if (!entries.length) {
      famEl.innerHTML = '<div style="color:var(--gray-400);font-size:12px;text-align:center;padding:24px 0;">Aucune donnée</div>';
    } else {
      const maxCout = entries[0][1].cout;
      famEl.innerHTML = entries.map(([fam, v]) => `
        <div style="margin-bottom:14px;">
          <div class="row-between" style="margin-bottom:5px;">
            <span style="font-size:13px;font-weight:600;">${fam}</span>
            <span style="font-size:12px;color:var(--gray-500);font-variant-numeric:tabular-nums;">${fcFmt(v.cout)} CHF</span>
          </div>
          <div style="height:8px;background:var(--gray-100);border-radius:2px;overflow:hidden;">
            <div style="height:100%;width:${(v.cout / maxCout * 100).toFixed(1)}%;background:var(--phar-navy);border-radius:2px;transition:width .4s;"></div>
          </div>
        </div>`).join('');
    }
  }

  // Ratio bar
  const fillEl  = document.getElementById('fc-ratio-fill');
  const lblEl   = document.getElementById('fc-ratio-label');
  const msgEl   = document.getElementById('fc-ratio-msg');
  const tgtLine = document.getElementById('fc-ratio-target-line');

  if (fillEl) {
    const w = Math.min(calc.ratio, 100);
    fillEl.style.width = (calc.ca > 0 ? w : 0).toFixed(1) + '%';
    const d = calc.ratio - FC_TARGET_RATIO;
    fillEl.style.background = calc.ca === 0 ? 'var(--gray-300)'
      : d <= 0 ? 'var(--success)' : d <= 3 ? 'var(--warning)' : 'var(--danger)';
  }
  if (lblEl)   lblEl.textContent = calc.ca > 0 ? fcFmtPct(calc.ratio) : '—%';
  if (tgtLine) tgtLine.style.left = FC_TARGET_RATIO + '%';
  if (msgEl) {
    if (calc.ca === 0) {
      msgEl.textContent = 'Saisissez le CA de la semaine pour calculer le ratio flash cost.';
      msgEl.style.color = 'var(--gray-500)';
    } else if (calc.coutTotal === 0) {
      msgEl.textContent = 'Renseignez le stock de clôture pour calculer la consommation.';
      msgEl.style.color = 'var(--gray-500)';
    } else {
      const d = calc.ratio - FC_TARGET_RATIO;
      if (d <= -2)      { msgEl.textContent = `↓ Flash cost ${Math.abs(d).toFixed(1)}pt sous la cible — excellent résultat.`; msgEl.style.color = 'var(--success)'; }
      else if (d <= 0)  { msgEl.textContent = `✓ Flash cost dans la cible à ${fcFmtPct(calc.ratio)}.`; msgEl.style.color = 'var(--success)'; }
      else if (d <= 3)  { msgEl.textContent = `↑ ${d.toFixed(1)}pt au-dessus de la cible — à surveiller de près.`; msgEl.style.color = 'var(--warning)'; }
      else              { msgEl.textContent = `↑ ${d.toFixed(1)}pt au-dessus de la cible — action corrective nécessaire.`; msgEl.style.color = 'var(--danger)'; }
    }
  }
}

function fcUpdateCA(val) {
  if (!fcSemaine) return;
  fcSemaine.ca_ht = parseFloat(val) || 0;
  fcSaveAll();
  renderFC4();
}

/* ─── FC-4 : Export PDF ──────────────────────────────────────── */
function fcExportPDF() {
  const calc = fcCalcSemaine();
  if (!calc || !fcSemaine) return;

  const ratioColor = calc.ratio <= FC_TARGET_RATIO ? '#2D7A4F' : '#B23B2A';
  const ratioBg    = calc.ratio <= FC_TARGET_RATIO ? '#E5F2EA' : '#F8E5E1';
  const date       = new Date().toLocaleDateString('fr-CH');

  const rowsHtml = calc.details.filter(a => a.cout > 0).map((a, i) => `
    <tr>
      <td style="text-align:right;color:#9A9A95;padding:5px 8px;">${i + 1}</td>
      <td>${a.nom}</td>
      <td>${a.famille}</td>
      <td style="text-align:right;font-variant-numeric:tabular-nums;">${a.conso.toFixed(2)} ${a.unite}</td>
      <td style="text-align:right;font-weight:700;font-variant-numeric:tabular-nums;">${fcFmt(a.cout)}</td>
      <td style="text-align:right;font-variant-numeric:tabular-nums;">${fcFmtPct(a.pct_ca)}</td>
    </tr>`).join('');

  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
  <title>Flash Cost · ${fcSemaine.semaine}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:12px;color:#1A1A18;margin:24px;}
    h1{font-size:20px;color:#263B8B;margin:0 0 2px;}
    .meta{color:#6B6B65;font-size:11px;margin-bottom:16px;}
    .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px;}
    .kpi{border:1px solid #E8E8E8;border-radius:4px;padding:10px 12px;}
    .kpi-label{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#6B6B65;margin-bottom:4px;}
    .kpi-val{font-size:18px;font-weight:800;color:#263B8B;}
    table{width:100%;border-collapse:collapse;margin-bottom:16px;}
    th{background:#263B8B;color:white;padding:6px 10px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.06em;}
    td{padding:5px 10px;border-bottom:1px solid #F4F3F3;}
    .total{font-weight:800;background:#E8EBF5;}
    .footer{margin-top:20px;font-size:9px;color:#9A9A95;border-top:1px solid #E8E8E8;padding-top:6px;display:flex;justify-content:space-between;}
    @media print{@page{size:A4;margin:12mm;}}
  </style></head><body>
  <h1>Flash Cost · ${fcSemaine.debut} – ${fcSemaine.fin}</h1>
  <div class="meta">Hôtel Bellerive · Vevey · Imprimé le ${date} · ${fcArticles.length} articles leaders</div>
  <div class="kpis">
    <div class="kpi"><div class="kpi-label">CA semaine HT</div><div class="kpi-val">${fcFmt(calc.ca)} CHF</div></div>
    <div class="kpi"><div class="kpi-label">Coût matière leaders</div><div class="kpi-val">${fcFmt(calc.coutTotal)} CHF</div></div>
    <div class="kpi" style="background:${ratioBg};border-color:${ratioColor};">
      <div class="kpi-label" style="color:${ratioColor};">Flash cost ratio</div>
      <div class="kpi-val" style="color:${ratioColor};">${fcFmtPct(calc.ratio)}</div>
    </div>
    <div class="kpi"><div class="kpi-label">Cible</div><div class="kpi-val">${FC_TARGET_RATIO}%</div></div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Article</th><th>Famille</th><th style="text-align:right;">Consommation</th><th style="text-align:right;">Coût CHF</th><th style="text-align:right;">% CA</th></tr></thead>
    <tbody>
      ${rowsHtml}
      <tr class="total">
        <td colspan="4" style="text-align:right;">TOTAL</td>
        <td style="text-align:right;">${fcFmt(calc.coutTotal)}</td>
        <td style="text-align:right;">${fcFmtPct(calc.ratio)}</td>
      </tr>
    </tbody>
  </table>
  <div class="footer">
    <span>PHAR Cost v1.0 · Flash Cost · Semaine ${fcSemaine.semaine} · © PHAR SA 2026</span>
    <span>Visé par : ________________________</span>
  </div>
  <script>window.onload = () => { window.print(); }<\/script>
  </body></html>`);
  win.document.close();
}

/* ─── FC-4 : Valider la semaine ──────────────────────────────── */
function fcValiderSemaine() {
  if (!fcSemaine) return;
  const calc = fcCalcSemaine();
  if (!calc) return;

  if (calc.ca === 0) {
    if (typeof showToast === 'function') showToast('Saisissez le CA de la semaine avant de valider.', 'error');
    return;
  }
  const missing = fcArticles.filter(a => {
    const v = fcSemaine.stock_fermeture[a.id];
    return v === null || v === undefined;
  });

  let msg = `Valider la semaine ${fcSemaine.semaine} ?\n\nCA : ${fcFmt(calc.ca)} CHF\nCoût matière : ${fcFmt(calc.coutTotal)} CHF\nRatio : ${fcFmtPct(calc.ratio)}`;
  if (missing.length) msg += `\n\n⚠ ${missing.length} article(s) sans stock de clôture — le stock théorique sera utilisé.`;
  msg += '\n\nCette action archive la semaine et repart avec le stock de fermeture comme ouverture de la semaine suivante.';

  if (!confirm(msg)) return;

  // Archive
  const entry = {
    id:         'fch_' + Math.random().toString(36).slice(2, 10),
    semaine:    fcSemaine.semaine,
    debut:      fcSemaine.debut,
    fin:        fcSemaine.fin,
    ca_ht:      calc.ca,
    cout_total: calc.coutTotal,
    ratio:      calc.ratio,
    detail:     calc.details.map(a => ({
      id: a.id, nom: a.nom, famille: a.famille,
      conso: a.conso, cout: a.cout, pct_ca: a.pct_ca
    }))
  };
  fcHistorique.unshift(entry);

  // New week: ouverture = fermeture actuelle (ou théorique si absent)
  const newOuv = {};
  fcArticles.forEach(a => {
    const ouv = parseFloat(fcSemaine.stock_ouverture[a.id]) || 0;
    const ach = parseFloat(fcSemaine.achats[a.id]) || 0;
    const ferm = fcSemaine.stock_fermeture[a.id];
    newOuv[a.id] = (ferm !== null && ferm !== undefined) ? parseFloat(ferm) : (ouv + ach);
  });

  const next = _fcNextWeek(fcSemaine.semaine);
  fcSemaine = {
    semaine:         next.id,
    debut:           next.debut,
    fin:             next.fin,
    ca_ht:           0,
    stock_ouverture: newOuv,
    achats:          Object.fromEntries(fcArticles.map(a => [a.id, 0])),
    stock_fermeture: {},
    bls:             []
  };

  fcSaveAll();
  renderFC4();
  renderFC3();
  renderFC5();
  fcPopulateConsolidePickers();

  if (typeof showToast === 'function')
    showToast(`✓ Semaine ${entry.semaine} clôturée · ratio ${fcFmtPct(entry.ratio)}`, 'success');
}

function _fcNextWeek(weekStr) {
  const m = weekStr.match(/(\d{4})-W(\d{2})/);
  if (!m) return { id: weekStr + '_next', debut: '—', fin: '—' };
  let year = parseInt(m[1]), week = parseInt(m[2]) + 1;
  if (week > 52) { week = 1; year++; }
  const id = `${year}-W${String(week).padStart(2, '0')}`;
  const jan4    = new Date(year, 0, 4);
  const dow     = jan4.getDay() || 7;
  const monday  = new Date(jan4);
  monday.setDate(jan4.getDate() - (dow - 1) + (week - 1) * 7);
  const sunday  = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = d => d.toLocaleDateString('fr-CH');
  return { id, debut: fmt(monday), fin: fmt(sunday) };
}

/* ─── MODULE FC-5 : Historique ───────────────────────────────── */
function renderFC5() {
  renderFC5Table();
  renderFC5Chart();
  const countEl = document.getElementById('fc-histo-count');
  if (countEl) countEl.textContent = `${fcHistorique.length} semaine(s) clôturée(s)`;
}

function renderFC5Table() {
  const tbody = document.getElementById('fc-histo-tbody');
  if (!tbody) return;
  if (!fcHistorique.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:48px;color:var(--gray-400);">
      Aucune semaine clôturée. Utilisez « Valider la semaine » dans Flash Cost.</td></tr>`;
    return;
  }
  tbody.innerHTML = fcHistorique.map((h, i) => {
    const ok       = h.ratio <= FC_TARGET_RATIO;
    const prev     = fcHistorique[i + 1];
    const deltaPts = prev ? h.ratio - prev.ratio : null;
    const deltaHtml = deltaPts !== null
      ? `<span style="margin-left:10px;font-size:11px;font-weight:700;color:${deltaPts > 0 ? 'var(--danger)' : 'var(--success)'};">
           ${deltaPts > 0 ? '↑' : '↓'} ${deltaPts > 0 ? '+' : ''}${deltaPts.toFixed(1)}pt
         </span>`
      : '';
    return `<tr>
      <td style="font-family:'Archivo';font-weight:700;">${h.semaine}</td>
      <td style="color:var(--gray-500);font-size:12px;">${h.debut} – ${h.fin}</td>
      <td class="num">${fcFmt(h.ca_ht)} CHF</td>
      <td class="num">${fcFmt(h.cout_total)} CHF</td>
      <td style="text-align:right;">
        <span style="font-family:'Archivo';font-weight:800;font-size:15px;color:${ok ? 'var(--success)' : 'var(--danger)'};">${fcFmtPct(h.ratio)}</span>
        ${deltaHtml}
      </td>
      <td style="text-align:right;">
        ${h.detail && h.detail.length ? `<button class="btn btn-ghost btn-sm" onclick="fcViewWeekDetail('${h.id}')">Détail</button>` : ''}
      </td>
    </tr>`;
  }).join('');
}

function renderFC5Chart() {
  const wrap = document.getElementById('fc-histo-chart');
  if (!wrap) return;
  const weeks = fcHistorique.slice(0, 12).reverse();
  if (!weeks.length) {
    wrap.innerHTML = '<div style="text-align:center;padding:48px;color:var(--gray-400);font-size:13px;">Clôturez des semaines pour voir le graphique.</div>';
    return;
  }
  const maxR   = Math.max(...weeks.map(w => w.ratio), FC_TARGET_RATIO + 5, 40);
  const tgtPct = (FC_TARGET_RATIO / maxR * 100).toFixed(1);

  const bars = weeks.map(w => {
    const h     = (w.ratio / maxR * 100).toFixed(1);
    const color = w.ratio <= FC_TARGET_RATIO ? 'var(--success)' : 'var(--danger)';
    return `<div class="bar-col">
      <div class="bar" style="height:${h}%;background:${color};cursor:default;" title="${w.semaine} · ${fcFmtPct(w.ratio)}">
        <span class="bar-value">${fcFmtPct(w.ratio)}</span>
      </div>
    </div>`;
  }).join('');

  const labels = weeks.map(w =>
    `<div class="bar-label">${w.semaine.replace(/\d{4}-/, '')}</div>`
  ).join('');

  wrap.innerHTML = `
    <div class="row-between" style="margin-bottom:14px;">
      <div>
        <div class="card-title" style="margin-bottom:4px;">Évolution flash cost · ${weeks.length} semaine(s)</div>
        <div class="card-hint">Cible : ${FC_TARGET_RATIO}%</div>
      </div>
      <div style="display:flex;gap:16px;font-size:11px;align-items:center;">
        <span class="row" style="gap:6px;"><span style="width:10px;height:10px;background:var(--success);display:inline-block;border-radius:1px;"></span> ≤ ${FC_TARGET_RATIO}%</span>
        <span class="row" style="gap:6px;"><span style="width:10px;height:10px;background:var(--danger);display:inline-block;border-radius:1px;"></span> > ${FC_TARGET_RATIO}%</span>
      </div>
    </div>
    <div class="bars" style="position:relative;">
      <div style="position:absolute;top:0;bottom:0;left:0;right:0;pointer-events:none;z-index:1;">
        <div style="position:absolute;bottom:${tgtPct}%;left:0;right:0;border-top:2px dashed rgba(38,59,139,.35);"></div>
        <span style="position:absolute;bottom:${tgtPct}%;right:4px;font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:var(--gray-500);transform:translateY(-100%);font-weight:700;">cible ${FC_TARGET_RATIO}%</span>
      </div>
      ${bars}
    </div>
    <div class="bar-labels">${labels}</div>`;
}

function fcViewWeekDetail(histoId) {
  const h = fcHistorique.find(x => x.id === histoId);
  if (!h || !h.detail || !h.detail.length) return;
  const rows = h.detail.map((a, i) => `
    <tr>
      <td style="color:var(--gray-400);font-size:11px;">${i+1}</td>
      <td style="font-weight:600;">${a.nom}</td>
      <td><span class="badge badge-info">${a.famille}</span></td>
      <td class="num">${a.conso.toFixed(2)}</td>
      <td class="num">${fcFmt(a.cout)} CHF</td>
      <td class="num">${fcFmtPct(a.pct_ca)}</td>
    </tr>`).join('');

  const modal = document.getElementById('fc-detail-modal');
  if (!modal) return;
  document.getElementById('fc-detail-modal-title').textContent = `Détail · ${h.semaine} · ${h.debut} – ${h.fin}`;
  document.getElementById('fc-detail-body').innerHTML = `
    <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px;">
      <div class="kpi kpi-primary"><div class="kpi-corner"></div><div class="kpi-label">CA HT</div><div class="kpi-value" style="font-size:20px;">${fcFmt(h.ca_ht)} <small>CHF</small></div></div>
      <div class="kpi"><div class="kpi-corner"></div><div class="kpi-label">Coût matière</div><div class="kpi-value" style="font-size:20px;">${fcFmt(h.cout_total)} <small>CHF</small></div></div>
      <div class="kpi ${h.ratio <= FC_TARGET_RATIO ? 'kpi-success' : 'kpi-danger'}"><div class="kpi-corner"></div><div class="kpi-label">Ratio</div><div class="kpi-value" style="font-size:20px;">${fcFmtPct(h.ratio)}</div><div class="kpi-foot">cible ${FC_TARGET_RATIO}%</div></div>
    </div>
    <div class="inv-table-scroll">
      <table class="data-table" style="font-size:13px;">
        <thead><tr><th>#</th><th>Article</th><th>Famille</th><th class="num">Consommation</th><th class="num">Coût CHF</th><th class="num">% CA</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  modal.classList.add('visible');
}

function fcExportHistoriqueExcel() {
  if (!fcHistorique.length) {
    if (typeof showToast === 'function') showToast('Aucun historique à exporter.', 'error');
    return;
  }
  if (typeof XLSX === 'undefined') {
    if (typeof showToast === 'function') showToast('Bibliothèque XLSX non disponible.', 'error');
    return;
  }
  const header = ['Semaine', 'Début', 'Fin', 'CA HT (CHF)', 'Coût matière (CHF)', 'Ratio (%)'];
  const rows = [header, ...fcHistorique.map(h => [
    h.semaine, h.debut, h.fin, h.ca_ht, h.cout_total, h.ratio
  ])];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Flash Cost');
  XLSX.writeFile(wb, `FlashCost_historique_${new Date().toISOString().slice(0, 10)}.xlsx`);
  if (typeof showToast === 'function') showToast('✓ Historique exporté.', 'success');
}

/* ─── Modals injection ───────────────────────────────────────── */
function injectFCModals() {
  const wrap = document.createElement('div');
  const familleOptions = FC_FAMILLES.map(f => `<option value="${f}">${f}</option>`).join('');
  wrap.innerHTML = `
    <!-- Modal article leader -->
    <div class="modal-backdrop" id="fc-art-modal">
      <div class="modal" style="max-width:520px;">
        <div class="modal-header">
          <div class="modal-title" id="fc-art-modal-title">Ajouter un article leader</div>
          <button class="modal-close" onclick="document.getElementById('fc-art-modal').classList.remove('visible')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="form-grid form-grid-2" style="margin-bottom:16px;">
            <div style="grid-column:1/-1;">
              <label class="field-label">Nom de l'article *</label>
              <input type="text" id="fc-art-nom" placeholder="Ex : Filet de bœuf CH" autocomplete="off">
            </div>
            <div>
              <label class="field-label">Famille</label>
              <select id="fc-art-famille">${familleOptions}</select>
            </div>
            <div>
              <label class="field-label">Fournisseur référent</label>
              <input type="text" id="fc-art-fournisseur" placeholder="Ex : Merat">
            </div>
            <div>
              <label class="field-label">Unité</label>
              <input type="text" id="fc-art-unite" placeholder="kg, btl, carton…" value="kg">
            </div>
            <div>
              <label class="field-label">Prix cible CHF/unité *</label>
              <input type="number" id="fc-art-prix" placeholder="0.00" step="0.01" min="0">
            </div>
          </div>
          <div>
            <label class="field-label">Seuil d'alerte (%)</label>
            <input type="number" id="fc-art-seuil" placeholder="10" value="10" step="1" min="1" max="50"
                   style="max-width:120px;">
            <div style="font-size:11px;color:var(--gray-500);margin-top:6px;">
              Une alerte est déclenchée si le prix BL dépasse le prix cible + ce pourcentage.
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onclick="document.getElementById('fc-art-modal').classList.remove('visible')">Annuler</button>
          <button class="btn btn-primary" onclick="fcSaveArticle()">Enregistrer</button>
        </div>
      </div>
    </div>

    <!-- Modal détail semaine historique -->
    <div class="modal-backdrop" id="fc-detail-modal">
      <div class="modal" style="max-width:760px;">
        <div class="modal-header">
          <div class="modal-title" id="fc-detail-modal-title">Détail semaine</div>
          <button class="modal-close" onclick="document.getElementById('fc-detail-modal').classList.remove('visible')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="modal-body" id="fc-detail-body"></div>
        <div class="modal-footer">
          <button class="btn btn-primary" onclick="document.getElementById('fc-detail-modal').classList.remove('visible')">Fermer</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(wrap);

  // ── Modal rapprochement facture ──────────────────────────────
  const reconModal = document.createElement('div');
  reconModal.innerHTML = `
    <div class="modal-backdrop" id="fc-recon-modal">
      <div class="modal" style="max-width:680px;">
        <div class="modal-header">
          <div class="modal-title">Rapprochement sur facture</div>
          <button class="modal-close" onclick="document.getElementById('fc-recon-modal').classList.remove('visible')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="modal-body">

          <!-- Résumé des BL sélectionnés -->
          <div style="margin-bottom:20px;">
            <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--gray-500);margin-bottom:10px;">BL sélectionnés</div>
            <div class="scan-meta-grid" style="grid-template-columns:repeat(3,1fr);background:var(--gray-50);border-radius:var(--radius);border:1px solid var(--gray-200);padding:14px 16px;gap:16px;">
              <div class="scan-meta-item">
                <div class="label">Bulletins</div>
                <div class="value"><span id="fc-recon-nb-bl">—</span> BL</div>
              </div>
              <div class="scan-meta-item" style="grid-column:2/-1;">
                <div class="label">Fournisseur(s)</div>
                <div class="value" id="fc-recon-fournisseurs" style="font-size:13px;">—</div>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:10px;">
              <div style="padding:12px;background:var(--phar-navy-faint);border-radius:var(--radius);border:1px solid var(--phar-navy-pale);">
                <div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--phar-navy);font-weight:700;margin-bottom:4px;">Total BL HT</div>
                <div style="font-family:'Archivo';font-weight:800;font-size:16px;color:var(--phar-navy);font-variant-numeric:tabular-nums;"><span id="fc-recon-bl-ht">—</span> CHF</div>
              </div>
              <div style="padding:12px;background:var(--gray-50);border-radius:var(--radius);border:1px solid var(--gray-200);">
                <div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--gray-500);font-weight:700;margin-bottom:4px;">Dont TVA</div>
                <div style="font-family:'Archivo';font-weight:700;font-size:16px;font-variant-numeric:tabular-nums;"><span id="fc-recon-bl-tva">—</span> CHF</div>
              </div>
              <div style="padding:12px;background:var(--gray-50);border-radius:var(--radius);border:1px solid var(--gray-200);">
                <div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--gray-500);font-weight:700;margin-bottom:4px;">Total BL TTC</div>
                <div style="font-family:'Archivo';font-weight:700;font-size:16px;font-variant-numeric:tabular-nums;"><span id="fc-recon-bl-ttc">—</span> CHF</div>
              </div>
            </div>
          </div>

          <!-- Saisie montants facture -->
          <div class="form-grid form-grid-2" style="margin-bottom:18px;">
            <div>
              <label class="field-label">Référence facture</label>
              <input type="text" id="fc-recon-ref" placeholder="Ex : FAC-2026-0421">
            </div>
            <div>
              <label class="field-label">Date facture</label>
              <input type="text" id="fc-recon-date" placeholder="JJ.MM.AAAA">
            </div>
            <div>
              <label class="field-label">Montant facture HT (CHF)</label>
              <input type="number" id="fc-recon-fac-ht" step="0.01" min="0" placeholder="0.00"
                     oninput="_fcReconUpdateEcart()" style="font-variant-numeric:tabular-nums;">
            </div>
            <div>
              <label class="field-label">Montant facture TTC (CHF)</label>
              <input type="number" id="fc-recon-fac-ttc" step="0.01" min="0" placeholder="0.00"
                     oninput="_fcReconUpdateEcart()" style="font-variant-numeric:tabular-nums;">
            </div>
          </div>

          <!-- Boîte écart -->
          <div class="recon-ecart idle" id="fc-recon-ecart-box" style="margin-bottom:0;">
            <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--gray-500);margin-bottom:10px;">Analyse de l'écart</div>
            <div class="recon-grid" style="grid-template-columns:1fr 1fr 1fr;gap:12px;">
              <div>
                <div style="font-size:11px;color:var(--gray-500);margin-bottom:2px;">Écart HT (facture − BL)</div>
                <div style="font-family:'Archivo';font-weight:700;font-size:14px;font-variant-numeric:tabular-nums;" id="fc-recon-ecart-ht">—</div>
              </div>
              <div>
                <div style="font-size:11px;color:var(--gray-500);margin-bottom:2px;">Écart TTC (facture − BL)</div>
                <div style="font-family:'Archivo';font-weight:700;font-size:14px;font-variant-numeric:tabular-nums;" id="fc-recon-ecart-ttc">—</div>
              </div>
              <div>
                <div style="font-size:11px;color:var(--gray-500);margin-bottom:2px;">Statut</div>
                <div style="font-weight:700;font-size:13px;" id="fc-recon-statut">Saisissez les montants</div>
              </div>
            </div>
          </div>

        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onclick="document.getElementById('fc-recon-modal').classList.remove('visible')">Annuler</button>
          <button class="btn btn-primary" id="fc-recon-confirm-btn" onclick="fcConfirmerRapprochement()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width:14px;height:14px;stroke-width:2;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            Créer la facture consolidée
          </button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(reconModal);

  // ── Liste des factures consolidées injectée dans l'onglet rapprochement ──
  // On l'ajoute après le div fc-bl-rapprochement dans le pane rapprochement
  const rapprPane = document.getElementById('achats-pane-rapprochement');
  if (rapprPane) {
    const facDiv = document.createElement('div');
    facDiv.style.marginTop = '24px';
    facDiv.innerHTML = `
      <div class="section-bar">
        <div class="section-bar-num">F</div>
        <div class="section-bar-label">Factures consolidées</div>
        <div class="section-bar-line"></div>
      </div>
      <div class="card" style="padding:0;">
        <div id="fc-factures-list">
          <div style="padding:32px;text-align:center;color:var(--gray-400);font-size:13px;">
            Aucune facture consolidée pour l'instant.
          </div>
        </div>
      </div>`;
    rapprPane.appendChild(facDiv);
  }

  ['fc-art-modal', 'fc-detail-modal', 'fc-recon-modal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', e => {
      if (e.target.id === id) e.target.classList.remove('visible');
    });
  });

  // Enter to submit article form
  const artModal = document.getElementById('fc-art-modal');
  if (artModal) artModal.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.target.matches('select, textarea')) fcSaveArticle();
  });
}

/* ─── MODULE FC-2 : Rapprochement facture ────────────────────── */

/**
 * Ouvre le modal de rapprochement en consolidant les BL sélectionnés.
 * Appelé depuis le bouton "Rapprocher une facture".
 */
function fcCreerRapprochement() {
  const sel = (typeof pharBLs !== 'undefined' ? pharBLs : [])
    .filter(b => typeof _blSelection !== 'undefined' && _blSelection.has(b.id));

  if (!sel.length) {
    if (typeof showToast === 'function')
      showToast('Cochez d\'abord des bulletins dans la liste.', 'error');
    return;
  }

  // Calcul totaux BL sélectionnés
  const sumHT  = sel.reduce((s, b) => s + (b.total_ht  || 0), 0);
  const sumTVA = sel.reduce((s, b) => s + (b.total_tva || 0), 0);
  const sumTTC = sel.reduce((s, b) => s + (b.total_ttc || 0), 0);

  // Fournisseurs uniques
  const fournisseurs = [...new Set(sel.map(b => b.fournisseur).filter(Boolean))];

  // Lecture des montants facture déjà saisis dans le panneau de rapprochement
  const facHTEl  = document.getElementById('rec-fac-ht');
  const facTTCEl = document.getElementById('rec-fac-ttc');
  const facHT    = facHTEl  ? parseFloat(facHTEl.value)  : NaN;
  const facTTC   = facTTCEl ? parseFloat(facTTCEl.value) : NaN;

  // Pré-remplir le modal
  const modal = document.getElementById('fc-recon-modal');
  if (!modal) return;

  // Infos résumé BL
  document.getElementById('fc-recon-nb-bl').textContent     = sel.length;
  document.getElementById('fc-recon-fournisseurs').textContent = fournisseurs.join(', ') || '—';
  document.getElementById('fc-recon-bl-ht').textContent     = _fcFmtMontant(sumHT);
  document.getElementById('fc-recon-bl-tva').textContent    = _fcFmtMontant(sumTVA);
  document.getElementById('fc-recon-bl-ttc').textContent    = _fcFmtMontant(sumTTC);

  // Pré-remplir montants facture depuis le panneau (si déjà saisis)
  document.getElementById('fc-recon-fac-ht').value  = isNaN(facHT)  ? '' : facHT.toFixed(2);
  document.getElementById('fc-recon-fac-ttc').value = isNaN(facTTC) ? '' : facTTC.toFixed(2);
  document.getElementById('fc-recon-ref').value     = '';
  document.getElementById('fc-recon-date').value    = new Date().toLocaleDateString('fr-CH');

  // Stocker les IDs pour la confirmation
  modal.dataset.blIds  = JSON.stringify(sel.map(b => b.id));
  modal.dataset.sumHT  = sumHT;
  modal.dataset.sumTVA = sumTVA;
  modal.dataset.sumTTC = sumTTC;

  // Calculer l'écart initial
  _fcReconUpdateEcart();

  modal.classList.add('visible');
}

/** Recalcule l'écart dans le modal rapprochement en temps réel */
function _fcReconUpdateEcart() {
  const modal  = document.getElementById('fc-recon-modal');
  if (!modal) return;

  const sumHT  = parseFloat(modal.dataset.sumHT)  || 0;
  const sumTTC = parseFloat(modal.dataset.sumTTC) || 0;

  const facHTEl  = document.getElementById('fc-recon-fac-ht');
  const facTTCEl = document.getElementById('fc-recon-fac-ttc');
  const facHT    = facHTEl  ? parseFloat(facHTEl.value)  : NaN;
  const facTTC   = facTTCEl ? parseFloat(facTTCEl.value) : NaN;

  const hasHT  = !isNaN(facHT);
  const hasTTC = !isNaN(facTTC);

  const ecartHT  = hasHT  ? facHT  - sumHT  : null;
  const ecartTTC = hasTTC ? facTTC - sumTTC : null;

  const fmtE = (e, base) => {
    if (e === null) return '—';
    const pct  = base > 0 ? (Math.abs(e) / base * 100).toFixed(1) : '0.0';
    const sign = e >= 0 ? '+' : '';
    return `${sign}${_fcFmtMontant(e)} CHF &nbsp;(${sign}${e >= 0 ? '' : '-'}${pct}%)`;
  };

  const htEl  = document.getElementById('fc-recon-ecart-ht');
  const ttcEl = document.getElementById('fc-recon-ecart-ttc');
  const stEl  = document.getElementById('fc-recon-statut');
  const box   = document.getElementById('fc-recon-ecart-box');
  const btn   = document.getElementById('fc-recon-confirm-btn');

  if (htEl)  htEl.innerHTML  = fmtE(ecartHT,  facHT);
  if (ttcEl) ttcEl.innerHTML = fmtE(ecartTTC, facTTC);

  // Statut coloré
  if (box) box.classList.remove('ok', 'warn', 'bad', 'idle');

  if (!hasHT && !hasTTC) {
    if (box && stEl) { box.classList.add('idle'); stEl.textContent = 'Saisissez les montants facture'; }
    if (btn) btn.disabled = false; // on peut créer sans facture (saisie ultérieure)
    return;
  }

  const absEcarts = [ecartHT, ecartTTC].filter(e => e !== null).map(Math.abs);
  const pctEcarts = [];
  if (hasHT  && facHT  > 0 && ecartHT  !== null) pctEcarts.push(Math.abs(ecartHT  / facHT  * 100));
  if (hasTTC && facTTC > 0 && ecartTTC !== null) pctEcarts.push(Math.abs(ecartTTC / facTTC * 100));

  const maxAbs = Math.max(...absEcarts, 0);
  const maxPct = pctEcarts.length ? Math.max(...pctEcarts) : 0;

  let statut, cls;
  if (maxAbs <= 0.05)   { statut = '✓ Concordant — écart nul';          cls = 'ok';   }
  else if (maxPct <= 1) { statut = '~ Écart mineur (< 1%)';              cls = 'warn'; }
  else                  { statut = '✗ Écart significatif — à vérifier';  cls = 'bad';  }

  if (box && stEl) { box.classList.add(cls); stEl.textContent = statut; }
  if (btn) btn.disabled = false;
}

/** Confirme et crée la facture consolidée */
function fcConfirmerRapprochement() {
  const modal = document.getElementById('fc-recon-modal');
  if (!modal) return;

  const blIds  = JSON.parse(modal.dataset.blIds || '[]');
  const sumHT  = parseFloat(modal.dataset.sumHT)  || 0;
  const sumTVA = parseFloat(modal.dataset.sumTVA) || 0;
  const sumTTC = parseFloat(modal.dataset.sumTTC) || 0;

  const facHT  = parseFloat(document.getElementById('fc-recon-fac-ht').value)  || null;
  const facTTC = parseFloat(document.getElementById('fc-recon-fac-ttc').value) || null;
  const ref    = document.getElementById('fc-recon-ref').value.trim();
  const date   = document.getElementById('fc-recon-date').value.trim();

  const ecartHT  = facHT  !== null ? facHT  - sumHT  : null;
  const ecartTTC = facTTC !== null ? facTTC - sumTTC : null;

  let statut = 'concordant';
  if (ecartHT !== null || ecartTTC !== null) {
    const maxPct = Math.max(
      facHT  > 0 && ecartHT  !== null ? Math.abs(ecartHT  / facHT  * 100) : 0,
      facTTC > 0 && ecartTTC !== null ? Math.abs(ecartTTC / facTTC * 100) : 0
    );
    if (Math.max(Math.abs(ecartHT || 0), Math.abs(ecartTTC || 0)) <= 0.05) statut = 'concordant';
    else if (maxPct <= 1)  statut = 'ecart_mineur';
    else                   statut = 'ecart_significatif';
  }

  // Récupérer les noms fournisseurs
  const bls = (typeof pharBLs !== 'undefined' ? pharBLs : []).filter(b => blIds.includes(b.id));
  const fournisseurs = [...new Set(bls.map(b => b.fournisseur).filter(Boolean))];

  // Créer la facture consolidée
  const facture = {
    id:          'fac_' + Math.random().toString(36).slice(2, 10),
    created_at:  new Date().toISOString(),
    ref,
    date,
    fournisseurs,
    bl_ids:      blIds,
    nb_bl:       blIds.length,
    bl_ht:       sumHT,
    bl_tva:      sumTVA,
    bl_ttc:      sumTTC,
    fac_ht:      facHT,
    fac_ttc:     facTTC,
    ecart_ht:    ecartHT,
    ecart_ttc:   ecartTTC,
    statut
  };

  // Persister dans localStorage
  const LS_FAC = 'phar_fc_factures_v1';
  let factures = [];
  try { factures = JSON.parse(localStorage.getItem(LS_FAC)) || []; } catch(e) {}
  factures.unshift(facture);
  try { localStorage.setItem(LS_FAC, JSON.stringify(factures)); } catch(e) {}

  // Marquer les BL comme rapprochés
  if (typeof pharBLs !== 'undefined') {
    blIds.forEach(id => {
      const bl = pharBLs.find(b => b.id === id);
      if (bl) { bl.statut = 'rapproche'; bl.facture_id = facture.id; }
    });
    if (typeof saveStores === 'function') saveStores();
  }

  // Vider la sélection
  if (typeof _blSelection !== 'undefined') _blSelection.clear();

  modal.classList.remove('visible');

  // Rerender BL repo
  if (typeof renderBLRepository === 'function') renderBLRepository();
  if (typeof updateReconcilePanel === 'function') updateReconcilePanel();

  // Afficher la facture créée dans un toast + log
  const statutLabel = { concordant:'Concordant', ecart_mineur:'Écart mineur', ecart_significatif:'Écart significatif' }[statut] || statut;
  if (typeof showToast === 'function')
    showToast(`✓ Facture consolidée créée · ${blIds.length} BL · ${_fcFmtMontant(sumHT)} CHF HT · ${statutLabel}`, 'success');

  // Afficher le résumé dans la liste des factures (onglet rapprochement)
  _fcRefreshFacturesList();
}

/** Formate un montant CHF avec apostrophe suisse */
function _fcFmtMontant(n) {
  if (n === null || isNaN(n)) return '—';
  const abs = Math.abs(n);
  const fmt = abs.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return n < 0 ? '-' + fmt : fmt;
}

/** Affiche la liste des factures consolidées dans l'onglet rapprochement */
function _fcRefreshFacturesList() {
  const wrap = document.getElementById('fc-factures-list');
  if (!wrap) return;

  const LS_FAC = 'phar_fc_factures_v1';
  let factures = [];
  try { factures = JSON.parse(localStorage.getItem(LS_FAC)) || []; } catch(e) {}

  if (!factures.length) {
    wrap.innerHTML = `<div style="padding:32px;text-align:center;color:var(--gray-400);font-size:13px;">
      Aucune facture consolidée. Sélectionnez des BL et cliquez « Rapprocher une facture ».</div>`;
    return;
  }

  const statutBadge = {
    concordant:          'badge-success',
    ecart_mineur:        'badge-warning',
    ecart_significatif:  'badge-danger'
  };
  const statutLabel = {
    concordant:          'Concordant',
    ecart_mineur:        'Écart mineur',
    ecart_significatif:  'Écart significatif'
  };

  const rows = factures.map(f => `
    <tr>
      <td style="font-size:11px;color:var(--gray-500);">${f.date || '—'}</td>
      <td style="font-weight:600;">${f.fournisseurs.join(', ') || '—'}</td>
      <td style="font-size:12px;color:var(--gray-500);">${f.ref || '—'}</td>
      <td style="text-align:center;">
        <span class="badge badge-info">${f.nb_bl} BL</span>
      </td>
      <td class="num">${_fcFmtMontant(f.bl_ht)}</td>
      <td class="num" style="color:${f.fac_ht !== null ? 'var(--gray-900)' : 'var(--gray-400)'};">
        ${f.fac_ht !== null ? _fcFmtMontant(f.fac_ht) : '—'}
      </td>
      <td class="num" style="font-weight:700;color:${
        f.ecart_ht === null ? 'var(--gray-400)'
        : Math.abs(f.ecart_ht) <= 0.05 ? 'var(--success)'
        : Math.abs(f.ecart_ht / (f.fac_ht || 1) * 100) <= 1 ? 'var(--warning)'
        : 'var(--danger)'};">
        ${f.ecart_ht !== null
          ? (f.ecart_ht >= 0 ? '+' : '') + _fcFmtMontant(f.ecart_ht)
          : '—'}
      </td>
      <td><span class="badge ${statutBadge[f.statut] || 'badge-info'}">${statutLabel[f.statut] || f.statut}</span></td>
      <td style="text-align:right;">
        <button class="btn btn-ghost btn-sm" style="color:var(--danger);" onclick="_fcDeleteFacture('${f.id}')" title="Supprimer">✕</button>
      </td>
    </tr>`).join('');

  wrap.innerHTML = `
    <table class="data-table" style="font-size:13px;">
      <thead><tr>
        <th>Date</th><th>Fournisseur(s)</th><th>Réf. facture</th>
        <th style="text-align:center;">BL inclus</th>
        <th class="num">Total BL HT</th>
        <th class="num">Montant facture HT</th>
        <th class="num">Écart HT</th>
        <th>Statut</th>
        <th></th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function _fcDeleteFacture(id) {
  if (!confirm('Supprimer cette facture consolidée ?\nLes BL associés reprendront le statut « À rapprocher ».')) return;
  const LS_FAC = 'phar_fc_factures_v1';
  let factures = [];
  try { factures = JSON.parse(localStorage.getItem(LS_FAC)) || []; } catch(e) {}
  const fac = factures.find(f => f.id === id);
  if (fac && typeof pharBLs !== 'undefined') {
    fac.bl_ids.forEach(blId => {
      const bl = pharBLs.find(b => b.id === blId);
      if (bl) { bl.statut = 'a_rapprocher'; bl.facture_id = null; }
    });
    if (typeof saveStores === 'function') saveStores();
  }
  factures = factures.filter(f => f.id !== id);
  try { localStorage.setItem(LS_FAC, JSON.stringify(factures)); } catch(e) {}
  _fcRefreshFacturesList();
  if (typeof renderBLRepository === 'function') renderBLRepository();
  if (typeof showToast === 'function') showToast('Facture supprimée, BL remis en attente.', '');
}

/* ─── ANALYTICS : Analyse des entrées en stock ───────────────── */

/**
 * Ouvre le modal analytics et calcule les stats.
 * Accessible depuis le module Inventaire et le journal des mouvements.
 */
function fcOpenAnalytics() {
  const modal = document.getElementById('fc-analytics-modal');
  if (!modal) return;
  // Pré-remplir dates : 1er du mois courant → aujourd'hui
  const now   = new Date();
  const y     = now.getFullYear();
  const m     = String(now.getMonth() + 1).padStart(2, '0');
  const today = now.toLocaleDateString('fr-CH');
  const first = `01.${m}.${y}`;
  const fromEl = document.getElementById('fc-ana-from');
  const toEl   = document.getElementById('fc-ana-to');
  if (fromEl && !fromEl.value) fromEl.value = first;
  if (toEl   && !toEl.value)   toEl.value   = today;
  modal.classList.add('visible');
  fcRunAnalytics();
}

/** Parse une date au format JJ.MM.AAAA → Date object */
function _fcParseDate(str) {
  if (!str) return null;
  const p = str.split('.');
  if (p.length !== 3) return null;
  return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
}

/** Retourne les mouvements dans la plage sélectionnée */
function _fcFilterMouvements() {
  const mvs = (typeof stockMovements !== 'undefined' ? stockMovements : []);
  const fromStr = document.getElementById('fc-ana-from')?.value;
  const toStr   = document.getElementById('fc-ana-to')?.value;
  const merc    = document.getElementById('fc-ana-merc')?.value || 'all';
  const search  = (document.getElementById('fc-ana-search')?.value || '').toLowerCase().trim();
  const dFrom   = _fcParseDate(fromStr);
  const dTo     = _fcParseDate(toStr);

  return mvs.filter(mv => {
    const d = _fcParseDate(mv.date);
    if (dFrom && d && d < dFrom) return false;
    if (dTo   && d && d > dTo)   return false;
    if (merc !== 'all' && mv.mercuriale !== merc) return false;
    if (search && !mv.article.toLowerCase().includes(search) &&
        !(mv.fournisseur || '').toLowerCase().includes(search)) return false;
    return true;
  });
}

/** Lance le calcul d'analytics et rafraîchit l'affichage */
function fcRunAnalytics() {
  const groupBy = document.getElementById('fc-ana-group')?.value || 'article';
  const mvs     = _fcFilterMouvements();

  // KPIs globaux
  const totalVal   = mvs.reduce((s, m) => s + m.quantite * m.prix_unitaire, 0);
  const totalQteKg = mvs.reduce((s, m) => s + m.quantite, 0);
  const nbArticles = new Set(mvs.map(m => m.article)).size;
  const nbBL       = new Set(mvs.map(m => m.bl_numero).filter(Boolean)).size;

  const kEl = document.getElementById('fc-ana-kpis');
  if (kEl) kEl.innerHTML = `
    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;">
      <div class="kpi kpi-primary" style="padding:14px;"><div class="kpi-corner"></div>
        <div class="kpi-label">Valeur totale</div>
        <div class="kpi-value" style="font-size:18px;">${fcFmt(totalVal)} <small>CHF</small></div>
        <div class="kpi-foot">${mvs.length} mouvement(s)</div>
      </div>
      <div class="kpi" style="padding:14px;"><div class="kpi-corner"></div>
        <div class="kpi-label">Articles distincts</div>
        <div class="kpi-value" style="font-size:22px;">${nbArticles}</div>
        <div class="kpi-foot">dans la période</div>
      </div>
      <div class="kpi" style="padding:14px;"><div class="kpi-corner"></div>
        <div class="kpi-label">BL / livraisons</div>
        <div class="kpi-value" style="font-size:22px;">${nbBL || mvs.length}</div>
        <div class="kpi-foot">bulletins distincts</div>
      </div>
      <div class="kpi" style="padding:14px;"><div class="kpi-corner"></div>
        <div class="kpi-label">Qté totale reçue</div>
        <div class="kpi-value" style="font-size:18px;">${_fcFmtMontant(totalQteKg)}</div>
        <div class="kpi-foot">toutes unités confondues</div>
      </div>
    </div>`;

  if (groupBy === 'article')      _fcRenderAnalyticsByArticle(mvs);
  else if (groupBy === 'mois')    _fcRenderAnalyticsByMonth(mvs);
  else if (groupBy === 'fournisseur') _fcRenderAnalyticsByFournisseur(mvs);
  else if (groupBy === 'pivot')   _fcRenderAnalyticsPivot(mvs);
}

/** Vue par article */
function _fcRenderAnalyticsByArticle(mvs) {
  const map = {};
  mvs.forEach(m => {
    if (!map[m.article]) map[m.article] = {
      article: m.article, merc: m.mercuriale, fournisseur: m.fournisseur || '—',
      unite: m.unite, nb: 0, qte: 0, valeur: 0,
      prix_min: Infinity, prix_max: -Infinity,
      dernier_prix: 0, derniere_date: ''
    };
    const r = map[m.article];
    r.nb++;
    r.qte    += m.quantite;
    r.valeur += m.quantite * m.prix_unitaire;
    r.prix_min = Math.min(r.prix_min, m.prix_unitaire);
    r.prix_max = Math.max(r.prix_max, m.prix_unitaire);
    if (!r.derniere_date || m.date > r.derniere_date) {
      r.derniere_date  = m.date;
      r.dernier_prix   = m.prix_unitaire;
      r.fournisseur    = m.fournisseur || r.fournisseur;
    }
  });

  const rows = Object.values(map).sort((a, b) => b.valeur - a.valeur);
  if (!rows.length) {
    document.getElementById('fc-ana-table').innerHTML =
      '<div style="padding:32px;text-align:center;color:var(--gray-400);">Aucun mouvement dans cette période.</div>';
    return;
  }

  const html = rows.map((r, i) => `
    <tr>
      <td style="color:var(--gray-400);font-size:11px;font-weight:700;">${i+1}</td>
      <td style="font-weight:600;max-width:200px;">${r.article}</td>
      <td><span class="badge ${r.merc === 'bev' ? 'badge-info' : 'badge-success'}">${r.merc === 'bev' ? 'Boissons' : 'Food'}</span></td>
      <td style="font-size:12px;color:var(--gray-500);">${r.fournisseur}</td>
      <td style="text-align:center;color:var(--gray-500);">${r.unite}</td>
      <td class="num">${r.nb}</td>
      <td class="num" style="font-weight:600;">${_fcFmtMontant(r.qte)}</td>
      <td class="num" style="font-weight:700;color:var(--phar-navy);">${fcFmt(r.valeur)}</td>
      <td class="num" style="font-size:11px;">${fcFmt(r.prix_min)}</td>
      <td class="num" style="font-size:11px;">${fcFmt(r.prix_max)}</td>
      <td class="num" style="font-weight:700;color:${r.dernier_prix > r.prix_min * 1.1 ? 'var(--danger)' : 'var(--gray-900)'};">
        ${fcFmt(r.dernier_prix)}
      </td>
      <td style="font-size:11px;color:var(--gray-500);">${r.derniere_date}</td>
    </tr>`).join('');

  document.getElementById('fc-ana-table').innerHTML = `
    <div class="inv-table-scroll">
      <table class="data-table" style="font-size:12px;">
        <thead><tr>
          <th>#</th><th>Article</th><th>Merc.</th><th>Fournisseur</th><th style="text-align:center;">Unité</th>
          <th class="num">Livraisons</th><th class="num">Qté totale</th>
          <th class="num">Valeur CHF</th>
          <th class="num">Prix min</th><th class="num">Prix max</th>
          <th class="num">Dernier prix</th><th>Dernière date</th>
        </tr></thead>
        <tbody>${html}</tbody>
      </table>
    </div>`;
}

/** Vue par mois */
function _fcRenderAnalyticsByMonth(mvs) {
  const map = {};
  mvs.forEach(m => {
    const d = _fcParseDate(m.date);
    const key = d ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` : 'inconnu';
    const label = d ? d.toLocaleDateString('fr-CH', {month:'long', year:'numeric'}) : 'Inconnu';
    if (!map[key]) map[key] = { key, label, nb: 0, nbArticles: new Set(), valeur: 0, qte: 0 };
    map[key].nb++;
    map[key].nbArticles.add(m.article);
    map[key].valeur += m.quantite * m.prix_unitaire;
    map[key].qte    += m.quantite;
  });

  const rows = Object.values(map).sort((a, b) => b.key.localeCompare(a.key));
  const maxVal = Math.max(...rows.map(r => r.valeur), 1);

  if (!rows.length) {
    document.getElementById('fc-ana-table').innerHTML =
      '<div style="padding:32px;text-align:center;color:var(--gray-400);">Aucun mouvement dans cette période.</div>';
    return;
  }

  const html = rows.map(r => `
    <tr>
      <td style="font-family:'Archivo';font-weight:700;">${r.label}</td>
      <td class="num">${r.nb}</td>
      <td class="num">${r.nbArticles.size}</td>
      <td class="num" style="font-weight:700;color:var(--phar-navy);">${fcFmt(r.valeur)}</td>
      <td style="width:200px;padding-right:16px;">
        <div style="height:8px;background:var(--gray-100);border-radius:2px;overflow:hidden;">
          <div style="height:100%;width:${(r.valeur/maxVal*100).toFixed(1)}%;background:var(--phar-navy);border-radius:2px;"></div>
        </div>
      </td>
    </tr>`).join('');

  document.getElementById('fc-ana-table').innerHTML = `
    <div class="inv-table-scroll">
      <table class="data-table" style="font-size:13px;">
        <thead><tr>
          <th>Mois</th><th class="num">Mouvements</th><th class="num">Articles</th>
          <th class="num">Valeur CHF</th><th>Répartition</th>
        </tr></thead>
        <tbody>${html}</tbody>
      </table>
    </div>`;
}

/** Vue par fournisseur */
function _fcRenderAnalyticsByFournisseur(mvs) {
  const map = {};
  mvs.forEach(m => {
    const k = m.fournisseur || 'Inconnu';
    if (!map[k]) map[k] = { fournisseur: k, nb: 0, articles: new Set(), valeur: 0 };
    map[k].nb++;
    map[k].articles.add(m.article);
    map[k].valeur += m.quantite * m.prix_unitaire;
  });

  const rows = Object.values(map).sort((a, b) => b.valeur - a.valeur);
  const maxVal = Math.max(...rows.map(r => r.valeur), 1);

  if (!rows.length) {
    document.getElementById('fc-ana-table').innerHTML =
      '<div style="padding:32px;text-align:center;color:var(--gray-400);">Aucun mouvement dans cette période.</div>';
    return;
  }

  const html = rows.map((r, i) => `
    <tr>
      <td style="color:var(--gray-400);font-size:11px;">${i+1}</td>
      <td style="font-weight:700;">${r.fournisseur}</td>
      <td class="num">${r.nb}</td>
      <td class="num">${r.articles.size}</td>
      <td class="num" style="font-weight:700;color:var(--phar-navy);">${fcFmt(r.valeur)}</td>
      <td style="width:180px;">
        <div style="height:8px;background:var(--gray-100);border-radius:2px;overflow:hidden;">
          <div style="height:100%;width:${(r.valeur/maxVal*100).toFixed(1)}%;background:var(--phar-navy);border-radius:2px;"></div>
        </div>
      </td>
    </tr>`).join('');

  document.getElementById('fc-ana-table').innerHTML = `
    <div class="inv-table-scroll">
      <table class="data-table" style="font-size:13px;">
        <thead><tr>
          <th>#</th><th>Fournisseur</th><th class="num">Livraisons</th>
          <th class="num">Articles</th><th class="num">Valeur CHF</th><th>Répartition</th>
        </tr></thead>
        <tbody>${html}</tbody>
      </table>
    </div>`;
}

/** Vue pivot : articles × mois */
function _fcRenderAnalyticsPivot(mvs) {
  // Collecter les mois uniques et les articles uniques
  const monthsSet = new Set();
  const articlesSet = new Set();
  mvs.forEach(m => {
    const d = _fcParseDate(m.date);
    if (d) monthsSet.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
    articlesSet.add(m.article);
  });
  const months   = [...monthsSet].sort();
  const articles = [...articlesSet].sort();

  if (!months.length) {
    document.getElementById('fc-ana-table').innerHTML =
      '<div style="padding:32px;text-align:center;color:var(--gray-400);">Aucun mouvement dans cette période.</div>';
    return;
  }

  // Construire la matrice article × mois → valeur
  const matrix = {};
  articles.forEach(a => { matrix[a] = {}; months.forEach(mo => { matrix[a][mo] = 0; }); });
  mvs.forEach(m => {
    const d = _fcParseDate(m.date);
    if (!d) return;
    const mo = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    if (matrix[m.article] && matrix[m.article][mo] !== undefined)
      matrix[m.article][mo] += m.quantite * m.prix_unitaire;
  });

  const monthLabels = months.map(mo => {
    const [y, mo2] = mo.split('-');
    return new Date(+y, +mo2-1, 1).toLocaleDateString('fr-CH', {month:'short', year:'2-digit'});
  });
  const maxCell = Math.max(...articles.flatMap(a => months.map(mo => matrix[a][mo])), 1);

  const theadHtml = `<tr>
    <th>Article</th>
    ${monthLabels.map(l => `<th class="num" style="min-width:80px;">${l}</th>`).join('')}
    <th class="num">Total</th>
  </tr>`;

  const tbodyHtml = articles.map(art => {
    const total = months.reduce((s, mo) => s + matrix[art][mo], 0);
    const cells = months.map(mo => {
      const v = matrix[art][mo];
      const intensity = Math.round(v / maxCell * 100);
      return `<td class="num" style="font-size:11px;font-variant-numeric:tabular-nums;
        background:${v > 0 ? `rgba(38,59,139,${(intensity/100*0.25+0.03).toFixed(2)})` : 'transparent'};
        color:${v > 0 ? 'var(--phar-navy)' : 'var(--gray-300)'};">
        ${v > 0 ? fcFmt(v) : '—'}</td>`;
    }).join('');
    return `<tr>
      <td style="font-weight:600;font-size:12px;max-width:180px;">${art}</td>
      ${cells}
      <td class="num" style="font-weight:700;color:var(--phar-navy);">${fcFmt(total)}</td>
    </tr>`;
  }).join('');

  document.getElementById('fc-ana-table').innerHTML = `
    <div class="inv-table-scroll" style="max-height:420px;overflow:auto;">
      <table class="data-table" style="font-size:12px;">
        <thead>${theadHtml}</thead>
        <tbody>${tbodyHtml}</tbody>
      </table>
    </div>`;
}

/** Export Excel depuis la vue analytics */
function fcExportAnalyticsExcel() {
  if (typeof XLSX === 'undefined') {
    if (typeof showToast === 'function') showToast('XLSX non disponible.', 'error');
    return;
  }
  const groupBy = document.getElementById('fc-ana-group')?.value || 'article';
  const mvs     = _fcFilterMouvements();
  if (!mvs.length) {
    if (typeof showToast === 'function') showToast('Aucun mouvement à exporter.', 'error');
    return;
  }

  let header, rows;

  if (groupBy === 'mois') {
    const map = {};
    mvs.forEach(m => {
      const d = _fcParseDate(m.date);
      const key = d ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` : '?';
      if (!map[key]) map[key] = { mois: key, nb: 0, valeur: 0 };
      map[key].nb++;
      map[key].valeur += m.quantite * m.prix_unitaire;
    });
    header = ['Mois','Mouvements','Valeur CHF'];
    rows   = Object.values(map).sort((a,b)=>b.mois.localeCompare(a.mois))
               .map(r => [r.mois, r.nb, r.valeur]);

  } else if (groupBy === 'fournisseur') {
    const map = {};
    mvs.forEach(m => {
      const k = m.fournisseur || '?';
      if (!map[k]) map[k] = { f: k, nb: 0, valeur: 0 };
      map[k].nb++;
      map[k].valeur += m.quantite * m.prix_unitaire;
    });
    header = ['Fournisseur','Mouvements','Valeur CHF'];
    rows   = Object.values(map).sort((a,b)=>b.valeur-a.valeur).map(r=>[r.f, r.nb, r.valeur]);

  } else {
    // Par article (défaut + pivot)
    header = ['Date','Mercuriale','Article','Fournisseur','N° BL','Qté','Unité','PU HT','Valeur HT','POS'];
    rows   = mvs.map(m => [
      m.date, m.mercuriale === 'bev' ? 'Boissons' : 'Food',
      m.article, m.fournisseur, m.bl_numero,
      m.quantite, m.unite, m.prix_unitaire,
      m.quantite * m.prix_unitaire, m.pos
    ]);
  }

  const fromVal = document.getElementById('fc-ana-from')?.value || '';
  const toVal   = document.getElementById('fc-ana-to')?.value   || '';
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Analyse entrées');
  XLSX.writeFile(wb, `Analyse_stock_${fromVal.replace(/\./g,'-')}_${toVal.replace(/\./g,'-')}.xlsx`);
  if (typeof showToast === 'function') showToast('✓ Export Excel généré.', 'success');
}

/** Export PDF une-page de l'analytics */
function fcExportAnalyticsPDF() {
  const mvs = _fcFilterMouvements();
  if (!mvs.length) { if (typeof showToast === 'function') showToast('Aucun mouvement.', 'error'); return; }
  const from = document.getElementById('fc-ana-from')?.value || '—';
  const to   = document.getElementById('fc-ana-to')?.value   || '—';

  // Agréger par article
  const map = {};
  mvs.forEach(m => {
    if (!map[m.article]) map[m.article] = { article: m.article, nb: 0, valeur: 0, fournisseur: m.fournisseur || '' };
    map[m.article].nb++;
    map[m.article].valeur += m.quantite * m.prix_unitaire;
  });
  const rows = Object.values(map).sort((a,b)=>b.valeur-a.valeur);
  const total = rows.reduce((s,r)=>s+r.valeur,0);
  const date  = new Date().toLocaleDateString('fr-CH');

  const win = window.open('','_blank');
  win.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
  <title>Analyse stock · ${from} – ${to}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:11px;color:#1A1A18;margin:20px;}
    h1{font-size:18px;color:#263B8B;margin:0 0 2px;}
    .meta{color:#6B6B65;font-size:10px;margin-bottom:14px;}
    table{width:100%;border-collapse:collapse;}
    th{background:#263B8B;color:white;padding:5px 8px;text-align:left;font-size:9px;text-transform:uppercase;}
    td{padding:4px 8px;border-bottom:1px solid #F4F3F3;}
    td.num{text-align:right;font-variant-numeric:tabular-nums;}
    .total{font-weight:800;background:#E8EBF5;}
    .footer{margin-top:16px;font-size:9px;color:#9A9A95;border-top:1px solid #E8E8E8;padding-top:6px;}
    @media print{@page{size:A4;margin:10mm;}}
  </style></head><body>
  <h1>Analyse entrées en stock · ${from} → ${to}</h1>
  <div class="meta">Hôtel Bellerive · Vevey · Imprimé le ${date} · ${rows.length} articles · ${mvs.length} mouvements</div>
  <table>
    <thead><tr><th>#</th><th>Article</th><th>Fournisseur</th><th class="num">Livraisons</th><th class="num">Valeur CHF</th><th class="num">% total</th></tr></thead>
    <tbody>
      ${rows.map((r,i)=>`<tr>
        <td style="color:#9A9A95;text-align:right;">${i+1}</td>
        <td>${r.article}</td><td style="font-size:10px;color:#6B6B65;">${r.fournisseur}</td>
        <td class="num">${r.nb}</td>
        <td class="num" style="font-weight:700;">${fcFmt(r.valeur)}</td>
        <td class="num">${total>0?((r.valeur/total)*100).toFixed(1)+'%':'—'}</td>
      </tr>`).join('')}
      <tr class="total"><td colspan="4" style="text-align:right;">TOTAL</td>
        <td class="num">${fcFmt(total)}</td><td class="num">100%</td></tr>
    </tbody>
  </table>
  <div class="footer">PHAR Cost v1.0 · © PHAR SA 2026 · Période : ${from} – ${to}</div>
  <script>window.onload=()=>window.print();<\/script>
  </body></html>`);
  win.document.close();
}

/** Injecte le modal Analytics dans le DOM */
function _fcInjectAnalyticsModal() {
  const el = document.createElement('div');
  el.innerHTML = `
    <div class="modal-backdrop" id="fc-analytics-modal">
      <div class="modal" style="max-width:1000px;width:95vw;max-height:92vh;">
        <div class="modal-header">
          <div class="modal-title">Analyse & Export · Entrées en stock</div>
          <button class="modal-close" onclick="document.getElementById('fc-analytics-modal').classList.remove('visible')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="modal-body" style="overflow-y:auto;max-height:calc(92vh - 130px);">

          <!-- Filtres -->
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr auto;gap:12px;align-items:flex-end;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--gray-200);">
            <div>
              <label class="field-label">Du</label>
              <input type="text" id="fc-ana-from" placeholder="JJ.MM.AAAA"
                     style="font-variant-numeric:tabular-nums;" oninput="fcRunAnalytics()">
            </div>
            <div>
              <label class="field-label">Au</label>
              <input type="text" id="fc-ana-to" placeholder="JJ.MM.AAAA"
                     style="font-variant-numeric:tabular-nums;" oninput="fcRunAnalytics()">
            </div>
            <div>
              <label class="field-label">Mercuriale</label>
              <select id="fc-ana-merc" onchange="fcRunAnalytics()">
                <option value="all">Toutes</option>
                <option value="food">Food</option>
                <option value="bev">Boissons</option>
              </select>
            </div>
            <div>
              <label class="field-label">Vue</label>
              <select id="fc-ana-group" onchange="fcRunAnalytics()">
                <option value="article">Par article</option>
                <option value="mois">Par mois</option>
                <option value="fournisseur">Par fournisseur</option>
                <option value="pivot">Pivot article × mois</option>
              </select>
            </div>
            <div>
              <label class="field-label" style="visibility:hidden;">.</label>
              <button class="btn btn-ghost btn-sm" onclick="fcRunAnalytics()">↺ Actualiser</button>
            </div>
          </div>

          <!-- Recherche article -->
          <div style="margin-bottom:16px;">
            <input type="text" id="fc-ana-search" placeholder="Filtrer par article ou fournisseur…"
                   style="max-width:400px;" oninput="fcRunAnalytics()">
          </div>

          <!-- KPIs -->
          <div id="fc-ana-kpis"></div>

          <!-- Tableau résultats -->
          <div id="fc-ana-table">
            <div style="padding:32px;text-align:center;color:var(--gray-400);">Chargement…</div>
          </div>

        </div>
        <div class="modal-footer" style="justify-content:space-between;">
          <div style="display:flex;gap:8px;">
            <button class="btn btn-ghost btn-sm" onclick="fcExportAnalyticsPDF()">
              Exporter PDF
            </button>
            <button class="btn btn-outline btn-sm" onclick="fcExportAnalyticsExcel()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width:14px;height:14px;stroke-width:2;">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" transform="rotate(180 12 12)"/>
              </svg>
              Exporter Excel
            </button>
          </div>
          <button class="btn btn-primary" onclick="document.getElementById('fc-analytics-modal').classList.remove('visible')">Fermer</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(el);
  document.getElementById('fc-analytics-modal').addEventListener('click', e => {
    if (e.target.id === 'fc-analytics-modal') e.target.classList.remove('visible');
  });
}

/* ═══════════════════════════════════════════════════════════════
   PHAR MARKETPLACE — Importeur Excel de bons de livraison
   Format détecté sur export "Livraisons" de la marketplace PHAR
   ═══════════════════════════════════════════════════════════════

   Structure du fichier :
   Ligne 1  : No de client      | [id]
   Ligne 2  : Adresse           | [nom entreprise]
   Ligne 3  :                   | [adresse]
   Ligne 4  :                   | [NPA ville]
   Ligne 5  : E-mail            | [email]
   Ligne 6  : Date de commande  | [date + heure]
   Ligne 7  : Numéro de commande| [numéro] ← identifiant unique
   Ligne 8  : Date de livraison | [date livraison]
   Ligne 9  : Référence         | [ref optionnelle]
   ...      : vide
   Ligne 12 : N° art. | Désignation | Quantité | Unité de livraison | Fournisseur | Prix de base | Montant
   Ligne 13+: [articles]
   Dernière : Total | | | | | | [total]
   ─────────────────────────────────────────────────────────────── */

const MOIS_FR = {
  'jan':1,'fév':2,'fev':2,'mar':3,'avr':4,'mai':5,'juin':6,
  'jui':6,'jul':7,'aoû':8,'aou':8,'sep':9,'oct':10,'nov':11,'déc':12,'dec':12
};

/** "21 mai 26" ou "21 mai 26, 13:44:01" → "21.05.2026" */
function _pharMktDate(str) {
  if (!str) return '—';
  const m = String(str).match(/(\d{1,2})\s+([a-záéèêëûüàâ]+)\.?\s+(\d{2,4})/i);
  if (!m) return String(str).split(',')[0].trim();
  const day   = m[1].padStart(2, '0');
  const mKey  = m[2].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').slice(0,3);
  const mNum  = String(MOIS_FR[mKey] || 1).padStart(2, '0');
  const year  = m[3].length === 2 ? '20' + m[3] : m[3];
  return `${day}.${mNum}.${year}`;
}

/** Parse le nombre au format FR (virgule décimale) */
function _pharNum(val) {
  if (val === null || val === undefined || val === '') return 0;
  return parseFloat(String(val).replace(/\s/g,'').replace(',','.')) || 0;
}

/** Détermine si un classeur Excel est un export PHAR Marketplace */
function _isPHARMarketplace(rows) {
  if (!rows || rows.length < 12) return false;
  // Cherche "Numéro de commande" dans les 10 premières lignes
  const hasCmd = rows.slice(0, 10).some(r =>
    String(r[0] || '').toLowerCase().includes('numéro de commande') ||
    String(r[0] || '').toLowerCase().includes('numero de commande')
  );
  // Cherche la ligne d'en-têtes avec "N° art." ou "Désignation"
  const hasHeader = rows.some(r =>
    (String(r[0] || '').trim() === 'N° art.' || String(r[1] || '').trim() === 'Désignation')
  );
  return hasCmd && hasHeader;
}

/** Parse un classeur PHAR Marketplace et retourne un objet BL */
function _parsePHARMarketplace(rows, fileName) {
  // ── 1. En-têtes ──────────────────────────────────────────────
  let orderNum = '', orderDate = '', deliveryDate = '', clientRef = '';
  let headerRowIdx = -1;

  rows.forEach((row, idx) => {
    const a = String(row[0] || '').trim();
    const b = String(row[1] || '').trim();
    if (/numéro de commande/i.test(a) || /numero de commande/i.test(a)) orderNum = b;
    if (/date de commande/i.test(a))  orderDate    = _pharMktDate(b);
    if (/date de livraison/i.test(a)) deliveryDate = _pharMktDate(b);
    if (/référence/i.test(a))         clientRef    = b;
    // Détecte la ligne d'en-têtes des colonnes
    if (String(row[0]||'').trim() === 'N° art.' || String(row[1]||'').trim() === 'Désignation') {
      headerRowIdx = idx;
    }
  });

  // ── 2. Articles ───────────────────────────────────────────────
  const articles = [];
  let totalHT = 0;

  if (headerRowIdx >= 0) {
    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      const artNo = String(row[0] || '').trim();

      // Stop à la ligne Total ou vide
      if (!artNo) continue;
      if (/^total$/i.test(artNo)) {
        // Récupère le total de la ligne Total (col G = index 6)
        const tot = _pharNum(row[6]);
        if (tot > 0) totalHT = tot;
        break;
      }

      const designation = String(row[1] || '').trim();
      if (!designation) continue;

      const quantite  = _pharNum(row[2]) || 1;
      const uniteCmd  = String(row[3] || '').trim();  // "UV à 960 STK"
      const fournLine = String(row[4] || '').trim();  // Fournisseur ligne
      const prixBase  = _pharNum(row[5]);             // Prix par pièce individuelle
      const montant   = _pharNum(row[6]);             // Total ligne (prix × nb pièces dans l'UV)

      // Prix unitaire par UV commandé (= montant / quantite)
      const prixParUV = quantite > 0 ? montant / quantite : prixBase;

      // Extraire le nombre de pièces par UV s'il est dans l'unité
      // Ex: "UV à 960 STK" → 960 pièces, prixBase = prix/pièce
      const unitsMatch = uniteCmd.match(/à\s*(\d+(?:[.,]\d+)?)\s*stk/i);
      const unitsPerUV = unitsMatch ? _pharNum(unitsMatch[1]) : null;

      const cat = typeof fcAutoCategory === 'function' ? fcAutoCategory(designation) : 'Autres';
      const tva = typeof fcAutoTVA === 'function' ? fcAutoTVA(designation, cat) : 2.6;

      articles.push({
        ref:              artNo,
        designation,
        quantite,
        unite:            uniteCmd || 'UV',
        prix_unitaire_ht: prixParUV,   // Prix par UV commandé
        prix_base_piece:  prixBase,    // Prix par pièce individuelle
        units_per_uv:     unitsPerUV,  // Nb pièces dans l'UV (null si inconnu)
        total_ht:         montant,
        tva_pct:          tva,
        categorie_suggeree: cat,
        fournisseur_ligne:  fournLine  // Fournisseur réel via marketplace
      });

      if (totalHT === 0) totalHT += montant;
    }
  }

  // Total TVA estimé par ligne
  const totalTVA = articles.reduce((s, a) =>
    s + (a.total_ht * (a.tva_pct / 100)), 0);
  const totalTTC = totalHT + totalTVA;

  return {
    type_document:  'bon_livraison',
    fichier:        fileName,
    fournisseur:    'PHAR Marketplace',
    numero:         orderNum,
    date:           deliveryDate || orderDate,
    date_commande:  orderDate,
    client:         'PHAR SA',
    reference:      clientRef,
    articles,
    total_ht:       totalHT,
    total_tva:      parseFloat(totalTVA.toFixed(2)),
    total_ttc:      parseFloat(totalTTC.toFixed(2)),
    devise:         'CHF',
    notes:          clientRef ? `Référence : ${clientRef}` : '',
    source:         'phar_marketplace'  // flag pour identifier l'origine
  };
}

/** Lance l'import PHAR Marketplace depuis un Excel */
function importPHARMarketplace() {
  const input = document.createElement('input');
  input.type    = 'file';
  input.accept  = '.xlsx,.xls';
  input.multiple = true;

  input.onchange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // S'assurer qu'on est sur l'onglet scan
    if (typeof switchAchatsTab === 'function') switchAchatsTab('scan');

    // Naviguer vers fc-bons si besoin
    if (typeof _navActivateModule === 'function') {
      const navItem = document.querySelector('.nav-sub-item[data-module="fc-bons"][data-tab="scan"]');
      if (typeof _navSetActive === 'function') _navSetActive(navItem);
      if (typeof navOpenGroup === 'function') navOpenGroup('achats');
      _navActivateModule('fc-bons', 'scan');
    }

    if (typeof clearBLLog === 'function') {
      clearBLLog();
      document.getElementById('bl-scan-results').innerHTML = '';
    }
    if (typeof blLog === 'function')
      blLog(`Import PHAR Marketplace · ${files.length} fichier(s)`, 'step');

    let ok = 0, fail = 0;

    for (const file of files) {
      if (typeof blLog === 'function')
        blLog(`— ${file.name} (${(file.size/1024).toFixed(0)} Ko)…`, 'step');
      try {
        const buf  = await file.arrayBuffer();
        const wb   = XLSX.read(buf, { type:'array' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });

        if (!_isPHARMarketplace(rows)) {
          if (typeof blLog === 'function')
            blLog(`  ✗ Format non reconnu — ce fichier ne semble pas être un export PHAR Marketplace.`, 'err');
          // Essaie quand même de scanner via PHAR API si clé dispo
          if (typeof blLog === 'function')
            blLog(`  → Essayez le scan PHAR API pour ce document.`, 'info');
          fail++;
          continue;
        }

        const parsed = _parsePHARMarketplace(rows, file.name);
        if (typeof blLog === 'function')
          blLog(`  ✓ ${parsed.articles.length} article(s) · N° ${parsed.numero} · ${parsed.date} · ${parsed.total_ht.toFixed(2)} CHF HT`, 'ok');

        // Persiste dans pharBLs + initialise le modèle net/rabais + carte éditable
        let _blMkt = null;
        if (typeof persistScannedBL === 'function') {
          _blMkt = persistScannedBL(parsed, file.name);
        }
        if (_blMkt) {
          if (typeof _blRecomputeNet === 'function') _blRecomputeNet(_blMkt);
          if (typeof saveStores === 'function') saveStores();
          if (typeof renderEditableBLCard === 'function') renderEditableBLCard(_blMkt);
          else if (typeof _renderPHARMarketplaceCard === 'function') _renderPHARMarketplaceCard(parsed);
        }
        ok++;
      } catch (err) {
        if (typeof blLog === 'function')
          blLog(`  ✗ ${file.name} : ${err.message}`, 'err');
        fail++;
      }
    }

    if (typeof blLog === 'function')
      blLog(`Terminé · ${ok} importé(s)${fail ? ` · ${fail} échec(s)` : ''}`, ok ? 'ok' : 'err');
    if (ok && typeof renderBLRepository === 'function') renderBLRepository();
    if (ok && typeof showToast === 'function')
      showToast(`✓ ${ok} commande(s) PHAR Marketplace importée(s)`, 'success');
    document.querySelector('main')?.scrollTo({ top: 0, behavior:'smooth' });
  };

  input.click();
}

/** Carte résultat enrichie pour PHAR Marketplace */
function _renderPHARMarketplaceCard(parsed) {
  const container = document.getElementById('bl-scan-results');
  if (!container) return;

  const rows = (parsed.articles || []).map((a, idx) => {
    const tva     = a.tva_pct || 2.6;
    const totTTC  = a.total_ht * (1 + tva / 100);
    const catOpts = (typeof getAllCategories === 'function' ? getAllCategories() : ['Autres']).map(c =>
      `<option value="${c}" ${c === a.categorie_suggeree ? 'selected' : ''}>${c}</option>`
    ).join('');

    // Infos unité enrichies
    const uniteDetail = a.units_per_uv
      ? `<div style="font-size:10px;color:var(--gray-400);margin-top:2px;">${a.units_per_uv} pcs · ${a.prix_base_piece?.toFixed(4)} CHF/pce</div>`
      : '';

    return `<tr id="phar-mkt-row-${idx}">
      <td style="font-size:11px;color:var(--phar-navy);font-weight:700;font-family:monospace;">${a.ref}</td>
      <td style="font-weight:600;max-width:200px;">
        ${a.designation}
        ${a.fournisseur_ligne && a.fournisseur_ligne !== 'PHAR Marketplace'
          ? `<div style="font-size:10px;color:var(--gray-400);margin-top:1px;">via ${a.fournisseur_ligne}</div>`
          : ''}
      </td>
      <td class="num">${a.quantite}</td>
      <td>
        <div style="font-size:12px;">${a.unite}</div>
        ${uniteDetail}
      </td>
      <td class="num" style="font-weight:700;">${a.prix_unitaire_ht.toFixed(2)}</td>
      <td class="num" style="font-weight:700;">${a.total_ht.toFixed(2)}</td>
      <td style="text-align:center;">
        <span class="badge ${tva > 3 ? 'badge-warning' : 'badge-success'}" style="font-size:10px;">${tva}%</span>
      </td>
      <td class="num" style="font-weight:700;color:var(--phar-navy);">${totTTC.toFixed(2)}</td>
      <td>
        <select style="font-size:11px;padding:3px 6px;border:1px solid var(--gray-200);border-radius:3px;"
                onchange="_blUpdateArticleCat('${parsed.id || ''}',${idx},this.value)">
          ${catOpts}
        </select>
      </td>
    </tr>`;
  }).join('');

  const card = document.createElement('div');
  card.className = 'scan-result-card';
  card.style.marginBottom = '16px';
  card.innerHTML = `
    <div class="scan-result-header" style="background:linear-gradient(90deg,var(--phar-navy-faint),white);">
      <div>
        <h3 style="color:var(--phar-navy);">
          <!-- Hexagone PHAR miniature -->
          <svg width="16" height="14" viewBox="0 0 110 96" style="vertical-align:middle;margin-right:6px;">
            <polygon points="27.5,2 82.5,2 110,48 82.5,94 27.5,94 0,48" fill="var(--phar-navy)"/>
            <polygon points="24,76 24,22 72,46" fill="white"/>
          </svg>
          PHAR Marketplace · Commande ${parsed.numero}
        </h3>
        <div style="font-size:11px;color:var(--gray-500);margin-top:4px;">
          Livraison : ${parsed.date} · Commandé le : ${parsed.date_commande}
          ${parsed.reference ? ` · Réf. : ${parsed.reference}` : ''}
        </div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="openBLIntegrationModalFromBL('${parsed.id || ''}')">
        Intégrer à l'inventaire
      </button>
    </div>

    <!-- Méta -->
    <div class="scan-meta-grid">
      <div class="scan-meta-item"><div class="label">Fournisseur</div><div class="value">PHAR Marketplace</div></div>
      <div class="scan-meta-item"><div class="label">N° commande</div><div class="value" style="font-family:monospace;">${parsed.numero}</div></div>
      <div class="scan-meta-item"><div class="label">Date livraison</div><div class="value">${parsed.date}</div></div>
      <div class="scan-meta-item">
        <div class="label">Total TTC</div>
        <div class="value" style="color:var(--phar-navy);font-family:'Archivo';font-weight:800;">${parsed.total_ttc.toFixed(2)} CHF</div>
      </div>
    </div>

    <!-- Tableau articles -->
    <div class="inv-table-scroll">
      <table class="data-table" style="font-size:12px;">
        <thead><tr>
          <th>N° art.</th><th>Désignation</th>
          <th class="num">Qté</th><th>Unité de livraison</th>
          <th class="num">PU HT</th><th class="num">Total HT</th>
          <th style="text-align:center;">TVA</th>
          <th class="num">Total TTC</th>
          <th>Catégorie</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr style="background:var(--phar-navy-pale);">
            <td colspan="5" style="padding:10px 16px;font-weight:700;color:var(--phar-navy);">TOTAL</td>
            <td class="num" style="font-weight:700;">${parsed.total_ht.toFixed(2)}</td>
            <td style="text-align:center;font-size:11px;color:var(--gray-500);">TVA : ${parsed.total_tva.toFixed(2)}</td>
            <td class="num" style="font-weight:800;font-family:'Archivo';font-size:14px;color:var(--phar-navy);">${parsed.total_ttc.toFixed(2)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Note source -->
    <div style="padding:8px 16px;background:var(--gray-50);border-top:1px solid var(--gray-200);
         font-size:10px;color:var(--gray-400);display:flex;align-items:center;gap:6px;">
      <svg width="12" height="10" viewBox="0 0 110 96">
        <polygon points="27.5,2 82.5,2 110,48 82.5,94 27.5,94 0,48" fill="var(--phar-navy)" opacity=".5"/>
        <polygon points="24,76 24,22 72,46" fill="white"/>
      </svg>
      Import automatique PHAR Marketplace · ${parsed.fichier}
    </div>`;

  container.appendChild(card);

  // Mettre à jour l'ID du BL dans la carte maintenant qu'il est persisté
  const bl = typeof pharBLs !== 'undefined'
    ? pharBLs.find(b => b.numero === parsed.numero && b.source === 'phar_marketplace')
    : null;
  if (bl) {
    card.querySelectorAll('[onclick*="openBLIntegrationModalFromBL"]').forEach(btn => {
      btn.setAttribute('onclick', `openBLIntegrationModalFromBL('${bl.id}')`);
    });
    card.querySelectorAll('[onchange*="_blUpdateArticleCat"]').forEach(sel => {
      sel.setAttribute('onchange', sel.getAttribute('onchange').replace("''", `'${bl.id}'`));
    });
  }
}

/* ─── Override renderScanResultCard : TVA + catégorie auto ──── */

/**
 * Remplace la fonction index.html pour afficher :
 * PU HT | Qté | Total HT | TVA % | Total TTC | Catégorie (éditable)
 */
window.renderScanResultCard = function(bl) {
  const totalTTC = bl.total_ttc || 0;
  let articlesHtml = '';

  if (bl.articles && bl.articles.length) {
    const rows = bl.articles.map((a, idx) => {
      const cat       = a.categorie_suggeree || fcAutoCategory(a.designation || '');
      const tva       = fcAutoTVA(a.designation || '', cat);
      const puHT      = parseFloat(a.prix_unitaire_ht) || 0;
      const qte       = parseFloat(a.quantite) || 0;
      const totalHT   = puHT * qte;
      const totalTTCl = totalHT * (1 + tva / 100);
      const catOpts   = getAllCategories().map(c =>
        `<option value="${c}" ${c === cat ? 'selected' : ''}>${c}</option>`
      ).join('');
      return `<tr id="bl-art-row-${bl.id}-${idx}">
        <td style="font-size:11px;color:var(--gray-500);">${a.ref || '—'}</td>
        <td style="font-weight:600;max-width:200px;">${a.designation || '—'}</td>
        <td class="num">${qte.toString().replace('.', ',')}</td>
        <td>${a.unite || '—'}</td>
        <td class="num" style="font-variant-numeric:tabular-nums;">${puHT.toFixed(2)}</td>
        <td class="num" style="font-weight:700;font-variant-numeric:tabular-nums;">${totalHT.toFixed(2)}</td>
        <td style="text-align:center;">
          <span class="badge ${tva > 3 ? 'badge-warning' : 'badge-success'}" style="font-size:10px;">${tva}%</span>
        </td>
        <td class="num" style="font-weight:700;color:var(--phar-navy);font-variant-numeric:tabular-nums;">${totalTTCl.toFixed(2)}</td>
        <td>
          <select style="font-size:11px;padding:4px 6px;border:1px solid var(--gray-200);border-radius:3px;background:var(--white);"
                  onchange="_blUpdateArticleCat('${bl.id}',${idx},this.value)">
            ${catOpts}
          </select>
        </td>
      </tr>`;
    }).join('');

    // Totaux recalculés avec TVA auto
    const totHT  = bl.articles.reduce((s, a) => s + (parseFloat(a.quantite)||0)*(parseFloat(a.prix_unitaire_ht)||0), 0);
    const totTTC = bl.articles.reduce((a, art) => {
      const cat = art.categorie_suggeree || fcAutoCategory(art.designation||'');
      const tva = fcAutoTVA(art.designation||'', cat);
      return a + (parseFloat(art.quantite)||0)*(parseFloat(art.prix_unitaire_ht)||0)*(1+tva/100);
    }, 0);

    articlesHtml = `
      <div class="inv-table-scroll">
        <table class="data-table" style="font-size:12px;">
          <thead><tr>
            <th>Réf.</th><th>Désignation</th>
            <th class="num">Qté</th><th>Unité</th>
            <th class="num">PU HT</th><th class="num">Total HT</th>
            <th style="text-align:center;">TVA</th>
            <th class="num">Total TTC</th>
            <th>Catégorie</th>
          </tr></thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr style="background:var(--phar-navy-pale);">
              <td colspan="5" style="padding:8px 16px;font-weight:700;color:var(--phar-navy);">Totaux</td>
              <td class="num" style="font-weight:700;">${totHT.toFixed(2)}</td>
              <td></td>
              <td class="num" style="font-weight:800;font-family:'Archivo';font-size:13px;color:var(--phar-navy);">${totTTC.toFixed(2)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>`;
  }

  const card = document.createElement('div');
  card.className = 'scan-result-card';
  card.style.marginBottom = '16px';
  card.dataset.blId = bl.id;
  card.innerHTML = `
    <div class="scan-result-header">
      <h3>✓ ${bl.type_document === 'facture' ? 'Facture' : 'Bon de livraison'}${bl.fichier ? ' · ' + bl.fichier : ''}</h3>
      <button class="btn btn-primary btn-sm" onclick="openBLIntegrationModalFromBL('${bl.id}')">Intégrer à l'inventaire</button>
    </div>
    <div class="scan-meta-grid">
      <div class="scan-meta-item"><div class="label">Fournisseur</div><div class="value">${bl.fournisseur || '—'}</div></div>
      <div class="scan-meta-item"><div class="label">N° document</div><div class="value">${bl.numero || '—'}</div></div>
      <div class="scan-meta-item"><div class="label">Date</div><div class="value">${bl.date || '—'}</div></div>
      <div class="scan-meta-item">
        <div class="label">Total TTC</div>
        <div class="value" style="color:var(--phar-navy);">${(totalTTC || 0).toFixed(2)} CHF</div>
      </div>
    </div>
    ${articlesHtml}
    ${bl.notes ? `<div style="padding:10px 20px;background:var(--gray-50);border-top:1px solid var(--gray-200);font-size:12px;color:var(--gray-700);"><strong>Notes :</strong> ${bl.notes}</div>` : ''}`;

  document.getElementById('bl-scan-results').appendChild(card);
};

/** Met à jour la catégorie d'un article d'un BL persisté (et recalcule la TVA) */
function _blUpdateArticleCat(blId, idx, newCat) {
  const bl = (typeof pharBLs !== 'undefined' ? pharBLs : []).find(b => b.id === blId);
  if (!bl || !bl.articles || !bl.articles[idx]) return;
  bl.articles[idx].categorie_suggeree = newCat;
  if (typeof saveStores === 'function') saveStores();
  // Recalculer la TVA affichée dans la même ligne
  const tva  = fcAutoTVA(bl.articles[idx].designation || '', newCat);
  const puHT = parseFloat(bl.articles[idx].prix_unitaire_ht) || 0;
  const qte  = parseFloat(bl.articles[idx].quantite) || 0;
  const ttc  = (puHT * qte * (1 + tva / 100)).toFixed(2);
  const row  = document.getElementById(`bl-art-row-${blId}-${idx}`);
  if (row) {
    const cells = row.querySelectorAll('td');
    // TVA badge (col 6)
    cells[6].innerHTML = `<span class="badge ${tva > 3 ? 'badge-warning' : 'badge-success'}" style="font-size:10px;">${tva}%</span>`;
    // Total TTC (col 7)
    cells[7].textContent = ttc;
  }
  if (typeof showToast === 'function')
    showToast(`Catégorie → ${newCat} · TVA ${tva}%`, '');
}

/* ─── MODULE Articles & Configuration ───────────────────────── */

function switchACTab(tab) {
  document.querySelectorAll('.subtab[data-ac-tab]').forEach(b =>
    b.classList.toggle('active', b.dataset.acTab === tab));
  document.querySelectorAll('.ac-tabpane').forEach(p => p.classList.remove('active'));
  const pane = document.getElementById('ac-pane-' + tab);
  if (pane) pane.classList.add('active');

  if (tab === 'articles')    acRenderArticles();
  if (tab === 'prix')        acRenderPrix();
  if (tab === 'categories')  acRenderCategories();
  if (tab === 'fournisseurs') acRenderFournisseurs();
}

/** Retourne tous les articles food + bev avec leur mercuriale */
function acGetAllArticles() {
  const food = (typeof pharStores !== 'undefined' ? pharStores.food : []).map(a => ({...a, _merc:'food'}));
  const bev  = (typeof pharStores !== 'undefined' ? pharStores.bev  : []).map(a => ({...a, _merc:'bev'}));
  return [...food, ...bev];
}

function acRenderArticles() {
  const tbody   = document.getElementById('ac-articles-tbody');
  const countEl = document.getElementById('ac-count');
  if (!tbody) return;

  const search   = (document.getElementById('ac-search')?.value   || '').toLowerCase();
  const merc     = (document.getElementById('ac-filter-merc')?.value || 'all');
  const catFilter = (document.getElementById('ac-filter-cat')?.value || 'all');

  // Populate category filter
  const catSel = document.getElementById('ac-filter-cat');
  if (catSel && catSel.options.length <= 1) {
    FC_CATEGORIES.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c; opt.textContent = c;
      catSel.appendChild(opt);
    });
  }

  let articles = acGetAllArticles();

  if (merc !== 'all')        articles = articles.filter(a => a._merc === merc);
  if (catFilter !== 'all')   articles = articles.filter(a => {
    const cat = a._ac_cat || fcAutoCategory(a.article);
    return cat === catFilter;
  });
  if (search) articles = articles.filter(a =>
    a.article.toLowerCase().includes(search) ||
    (a.fournisseur||'').toLowerCase().includes(search)
  );

  if (countEl) countEl.textContent = `${articles.length} article(s) affiché(s)`;

  if (!articles.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--gray-400);">Aucun article trouvé.</td></tr>`;
    return;
  }

  tbody.innerHTML = articles.map((a, idx) => {
    const cat     = a._ac_cat || fcAutoCategory(a.article);
    const tva     = fcAutoTVA(a.article, cat);
    const cump    = a.cump != null ? a.cump : a.pu;
    const cumpDiff = Math.abs(cump - a.pu) > 0.01;
    const catOpts = getAllCategories().map(c =>
      `<option value="${c}" ${c===cat?'selected':''}>${c}</option>`).join('');
    return `<tr>
      <td style="font-weight:600;max-width:200px;">
        <input type="text" value="${(a.article||'').replace(/"/g,'&quot;')}"
               style="border:none;background:transparent;width:100%;font-weight:600;"
               onchange="acUpdateArticle('${a._merc}','${(a.article||'').replace(/'/g,"\\'")}','nom',this.value)"
               onblur="if(this.value!='${(a.article||'').replace(/'/g,"\\'")}')acRenderArticles()">
      </td>
      <td>
        <select style="font-size:11px;padding:3px 6px;border:1px solid var(--gray-200);border-radius:3px;"
                onchange="acUpdateArticle('${a._merc}','${(a.article||'').replace(/'/g,"\\'")}','cat',this.value);this.closest('tr').querySelector('td:nth-child(7)').textContent=fcAutoTVA('${(a.article||'').replace(/'/g,"\\'")}',this.value)+'%'">
          ${catOpts}
        </select>
      </td>
      <td>
        <input type="text" value="${(a.fournisseur||'').replace(/"/g,'&quot;')}"
               style="font-size:11px;border:none;background:transparent;color:var(--gray-500);width:100%;"
               onchange="acUpdateArticle('${a._merc}','${(a.article||'').replace(/'/g,"\\'")}','fournisseur',this.value)">
      </td>
      <td style="text-align:center;">
        <input type="text" value="${a.unite||''}"
               style="font-size:11px;border:none;background:transparent;text-align:center;width:52px;"
               onchange="acUpdateArticle('${a._merc}','${(a.article||'').replace(/'/g,"\\'")}','unite',this.value)">
      </td>
      <td class="num">
        <input type="number" value="${a.pu.toFixed(2)}" step="0.01" min="0"
               style="text-align:right;width:72px;font-weight:600;border:none;background:transparent;"
               onchange="acUpdateArticle('${a._merc}','${(a.article||'').replace(/'/g,"\\'")}','pu',parseFloat(this.value))">
      </td>
      <td class="num" style="${cumpDiff?'color:var(--phar-navy);font-weight:600;':'color:var(--gray-400);'}">
        ${cump.toFixed(2)}
      </td>
      <td style="text-align:center;">
        <span class="badge ${tva > 3 ? 'badge-warning' : 'badge-success'}" style="font-size:10px;">${tva}%</span>
      </td>
      <td style="text-align:center;">
        <span class="badge ${a._merc==='bev'?'badge-info':'badge-success'}" style="font-size:10px;">${a._merc==='bev'?'Bois.':'Food'}</span>
      </td>
      <td style="text-align:center;">${(function(){
        const sku = typeof getSkuForArticle==='function' ? getSkuForArticle(a.article) : null;
        return sku ? `<span style="font-family:monospace;font-size:10px;color:var(--phar-navy);background:var(--phar-navy-faint);padding:2px 6px;border-radius:3px;" title="${sku.ls_name||''}">${sku.ls_sku}</span>` : '<span style="color:var(--gray-300);font-size:11px;">—</span>';
      })()}</td>
      <td style="text-align:right;white-space:nowrap;">
        <button class="btn btn-ghost btn-sm"
                onclick="typeof openArticleEditor==='function'&&openArticleEditor('${(a.article||'').replace(/'/g,"\\'")}','${a._merc}',false)">Modifier</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--danger);padding:4px 8px;"
                onclick="acDeleteArticle('${a._merc}','${(a.article||'').replace(/'/g,"\\'")}')">✕</button>
      </td>
    </tr>`;
  }).join('');
}

function acUpdateArticle(merc, originalName, field, value) {
  if (typeof pharStores === 'undefined') return;
  const arr  = pharStores[merc];
  const item = arr.find(a => a.article === originalName);
  if (!item) return;
  if (field === 'nom')        item.article    = value;
  else if (field === 'pu')    { item.pu = parseFloat(value)||0; }
  else if (field === 'fournisseur') item.fournisseur = value;
  else if (field === 'unite') item.unite      = value;
  else if (field === 'cat')   item._ac_cat    = value;
  if (typeof saveStores === 'function') saveStores();
}

function acDeleteArticle(merc, name) {
  if (!confirm(`Supprimer "${name}" de la mercuriale ${merc==='food'?'Food':'Boissons'} ?`)) return;
  if (typeof pharStores !== 'undefined') {
    pharStores[merc] = pharStores[merc].filter(a => a.article !== name);
    if (typeof saveStores === 'function') saveStores();
    acRenderArticles();
    if (typeof showToast === 'function') showToast(`Article "${name}" supprimé.`, '');
  }
}

function acNewArticle() {
  const merc  = document.getElementById('ac-filter-merc')?.value;
  const m     = (merc === 'bev') ? 'bev' : 'food';
  const nom   = prompt('Nom du nouvel article :');
  if (!nom || !nom.trim()) return;
  const pu    = parseFloat(prompt('Prix unitaire HT (CHF) :') || '0') || 0;
  const unite = prompt('Unité (kg, pce, btl…) :') || 'pce';
  const cat   = fcAutoCategory(nom);
  const pos   = Object.fromEntries(
    (typeof POS_DEFINITIONS !== 'undefined' ? POS_DEFINITIONS[m] : []).map(p => [p, 0])
  );
  if (typeof pharStores !== 'undefined') {
    const item = { groupe: m==='food'?'Food':'Minérales', article: nom.trim(),
      unite, fournisseur:'', pu, cump:pu, prix_reference:pu, historique_prix:[],
      lightspeed_sku:null, pos, mois_m1:0, _ac_cat: cat };
    pharStores[m].push(item);
    if (typeof saveStores === 'function') saveStores();
    acRenderArticles();
    if (typeof showToast === 'function') showToast(`✓ "${nom}" ajouté (${cat} · TVA ${fcAutoTVA(nom,cat)}%)`, 'success');
  }
}

function acExport() {
  if (typeof XLSX === 'undefined') return;
  const all = acGetAllArticles();
  const header = ['Article','Mercuriale','Catégorie','Fournisseur','Unité','PU HT','CUMP','TVA achat %'];
  const rows   = all.map(a => {
    const cat = a._ac_cat || fcAutoCategory(a.article);
    return [a.article, a._merc==='bev'?'Boissons':'Food', cat,
      a.fournisseur||'', a.unite||'', a.pu, a.cump||a.pu, fcAutoTVA(a.article,cat)];
  });
  const ws = XLSX.utils.aoa_to_sheet([header,...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Articles');
  XLSX.writeFile(wb, `Articles_PHAR_${new Date().toISOString().slice(0,10)}.xlsx`);
  if (typeof showToast === 'function') showToast('✓ Export Excel généré.', 'success');
}

function acRenderPrix() {
  const el = document.getElementById('ac-prix-content');
  if (!el) return;
  const seuil = 10; // % d'écart CUMP vs PU de référence
  const all   = acGetAllArticles().filter(a => {
    const cump = a.cump != null ? a.cump : a.pu;
    return a.pu > 0 && Math.abs((cump - a.pu) / a.pu * 100) >= seuil;
  }).sort((a,b) => {
    const da = Math.abs(((a.cump||a.pu)-a.pu)/a.pu*100);
    const db = Math.abs(((b.cump||b.pu)-b.pu)/b.pu*100);
    return db - da;
  });

  if (!all.length) {
    el.innerHTML = `<div style="padding:48px;text-align:center;">
      <div style="font-size:32px;margin-bottom:12px;">✓</div>
      <div style="font-weight:600;color:var(--success);">Aucun prix irrégulier</div>
      <div style="font-size:12px;color:var(--gray-500);margin-top:6px;">Tous les CUMP sont dans la norme (écart < ${seuil}%).</div>
    </div>`;
    return;
  }

  const rows = all.map(a => {
    const cump  = a.cump || a.pu;
    const diff  = cump - a.pu;
    const pct   = (diff / a.pu * 100).toFixed(1);
    const up    = diff > 0;
    return `<tr>
      <td style="font-weight:600;">${a.article}</td>
      <td><span class="badge ${a._merc==='bev'?'badge-info':'badge-success'}">${a._merc==='bev'?'Boissons':'Food'}</span></td>
      <td style="font-size:11px;color:var(--gray-500);">${a.fournisseur||'—'}</td>
      <td class="num">${a.pu.toFixed(2)}</td>
      <td class="num" style="font-weight:700;color:${up?'var(--danger)':'var(--success)'};">${cump.toFixed(2)}</td>
      <td class="num" style="font-weight:700;color:${up?'var(--danger)':'var(--success)'};">
        ${up?'↑':' ↓'} ${Math.abs(diff).toFixed(2)} CHF (${up?'+':''}${pct}%)
      </td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <div class="alert warning" style="margin-bottom:16px;">
      <div class="alert-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>
      <div class="alert-content">
        <div class="alert-title">${all.length} article(s) avec prix irréguliers</div>
        <div class="alert-text">CUMP vs prix de référence · seuil d'alerte : ${seuil}%</div>
      </div>
    </div>
    <div class="card" style="padding:0;">
      <table class="data-table" style="font-size:13px;">
        <thead><tr>
          <th>Article</th><th>Merc.</th><th>Fournisseur</th>
          <th class="num">PU réf.</th><th class="num">CUMP actuel</th><th class="num">Variation</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function acRenderCategories() {
  const el = document.getElementById('ac-cat-content');
  if (!el) return;
  const all    = acGetAllArticles();
  const custom = loadCustomCategories();
  const allCats = getAllCategories();
  const stats  = {};
  allCats.forEach(c => { stats[c] = { nb:0 }; });
  all.forEach(a => {
    const c = a._ac_cat || fcAutoCategory(a.article);
    if (!stats[c]) stats[c] = { nb:0 };
    stats[c].nb++;
  });

  const sysRows = FC_CATEGORIES.map(c => {
    const tva = FC_CAT_ALCOOL.has(c) ? 8.1 : 2.6;
    return `<tr>
      <td style="font-weight:600;">${c}</td>
      <td class="num">${stats[c]?.nb || 0}</td>
      <td style="text-align:center;"><span class="badge ${tva>3?'badge-warning':'badge-success'}">${tva}%</span></td>
      <td style="text-align:center;"><span style="font-size:10px;color:var(--gray-400);">Système</span></td>
      <td></td>
    </tr>`;
  }).join('');

  const customRows = custom.length ? custom.map(c => {
    const tva = fcAutoTVA(c, c);
    return `<tr style="background:var(--phar-navy-faint);">
      <td style="font-weight:600;">${c}</td>
      <td class="num">${stats[c]?.nb || 0}</td>
      <td style="text-align:center;"><span class="badge ${tva>3?'badge-warning':'badge-success'}">${tva}%</span></td>
      <td style="text-align:center;"><span class="badge badge-info" style="font-size:10px;">Personnalisée</span></td>
      <td style="text-align:right;">
        <button class="btn btn-ghost btn-sm" style="color:var(--danger);"
                onclick="acDeleteCustomCat('${c.replace(/'/g,"\\'")}')">✕</button>
      </td>
    </tr>`;
  }).join('') : '';

  el.innerHTML = `
    <!-- Créer une catégorie personnalisée -->
    <div class="card" style="padding:0;max-width:700px;margin-bottom:20px;">
      <div class="card-header">
        <div class="card-title">Catégories personnalisées</div>
        <div class="card-hint">Créez vos propres catégories : Bœuf, Porc, Surgelés, Produit asiatique…</div>
      </div>
      <div class="card-body">
        <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;">
          <div style="flex:1;min-width:200px;">
            <label class="field-label">Nom de la catégorie</label>
            <input type="text" id="ac-new-cat-input" placeholder="Ex : Bœuf, Surgelés, Produit asiatique…"
                   onkeydown="if(event.key==='Enter')acAddCustomCat()">
          </div>
          <div style="min-width:120px;">
            <label class="field-label">TVA achat</label>
            <select id="ac-new-cat-tva">
              <option value="2.6">2.6% — Alimentaire</option>
              <option value="8.1">8.1% — Alcool</option>
              <option value="0">0% — Exonéré</option>
            </select>
          </div>
          <button class="btn btn-primary btn-sm" onclick="acAddCustomCat()" style="margin-bottom:0;">
            + Créer la catégorie
          </button>
        </div>
        ${custom.length ? `
        <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--gray-200);">
          <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--gray-500);margin-bottom:8px;">
            Catégories créées (${custom.length})
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            ${custom.map(c => `
              <div style="display:inline-flex;align-items:center;gap:6px;
                   background:var(--phar-navy-faint);border:1px solid var(--phar-navy-pale);
                   border-radius:20px;padding:5px 12px 5px 14px;">
                <span style="font-size:13px;font-weight:600;color:var(--phar-navy);">${c}</span>
                <button onclick="acDeleteCustomCat('${c.replace(/'/g,"\\'")}');"
                        style="background:none;border:none;cursor:pointer;color:var(--gray-400);
                               padding:0;line-height:1;font-size:14px;transition:color .12s;"
                        onmouseover="this.style.color='var(--danger)'"
                        onmouseout="this.style.color='var(--gray-400)'">×</button>
              </div>`).join('')}
          </div>
        </div>` : ''}
      </div>
    </div>

    <!-- Toutes les catégories -->
    <div class="card" style="padding:0;max-width:700px;">
      <div class="card-header">
        <div class="card-title">Toutes les catégories</div>
        <div class="card-hint">${allCats.length} catégories · ${custom.length} personnalisées</div>
      </div>
      <table class="data-table" style="font-size:13px;">
        <thead><tr>
          <th>Catégorie</th><th class="num">Articles</th>
          <th style="text-align:center;">TVA achat</th>
          <th style="text-align:center;">Type</th>
          <th></th>
        </tr></thead>
        <tbody>${sysRows}${customRows}</tbody>
      </table>
    </div>

    <div class="alert info" style="margin-top:16px;max-width:700px;">
      <div class="alert-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></div>
      <div class="alert-content">
        <div class="alert-title">Règle TVA Suisse — Achats F&B</div>
        <div class="alert-text">
          <strong>2.6%</strong> — Alimentation, boissons sans alcool, café, thé ·
          <strong>8.1%</strong> — Alcool : vins, bières, spiritueux ·
          <strong>3.8%</strong> — Ventes uniquement (PDJ / chambres) — jamais sur les achats
        </div>
      </div>
    </div>`;
}

function acAddCustomCat() {
  const input = document.getElementById('ac-new-cat-input');
  const name  = input?.value.trim();
  if (!name) { if (typeof showToast === 'function') showToast('Saisissez un nom de catégorie.', 'error'); return; }
  if (addCustomCategory(name)) {
    if (input) input.value = '';
    acRenderCategories();
  }
}

function acDeleteCustomCat(name) {
  if (!confirm(`Supprimer la catégorie "${name}" ?\nLes articles assignés ne seront pas modifiés.`)) return;
  deleteCustomCategory(name);
  acRenderCategories();
  if (typeof showToast === 'function') showToast(`Catégorie "${name}" supprimée.`, '');
}

function acRenderFournisseurs() {
  const el = document.getElementById('ac-four-content');
  if (!el) return;

  // Statistiques d'articles par fournisseur (depuis les mercuriales)
  const all = (typeof acGetAllArticles === 'function') ? acGetAllArticles() : [];
  const stats = {};
  all.forEach(a => {
    const f = (a.fournisseur || '').trim() || 'Non renseigné';
    if (!stats[f]) stats[f] = { nb: 0, cats: new Set() };
    stats[f].nb++;
    stats[f].cats.add(a._ac_cat || (typeof fcAutoCategory === 'function' ? fcAutoCategory(a.article) : 'Autres'));
  });
  const statFor = nom => stats[(nom || '').trim()] || { nb: 0, cats: new Set() };

  const configured = acGetConfiguredFournisseurs();
  const configuredNames = new Set(configured.map(f => (f.nom || '').trim().toLowerCase()));

  const confRows = configured.map(f => {
    const st = statFor(f.nom);
    const hasRab = (parseFloat(f.rabais_val) || 0) > 0;
    return `<tr>
      <td><input type="text" value="${(f.nom || '').replace(/"/g, '&quot;')}" onchange="acUpdateFournisseur('${f.id}','nom',this.value)" style="font-weight:700;border:1px solid var(--gray-200);background:var(--white);padding:4px 6px;border-radius:3px;min-width:160px;width:100%;"></td>
      <td style="white-space:nowrap;">
        <div style="display:flex;align-items:center;justify-content:flex-end;gap:4px;">
          <input type="number" value="${parseFloat(f.rabais_val) || 0}" step="0.01" min="0" onchange="acUpdateFournisseur('${f.id}','rabais_val',this.value)" style="width:60px;height:28px;box-sizing:border-box;text-align:right;${hasRab ? 'color:var(--phar-navy);font-weight:700;' : ''}">
          <select onchange="acUpdateFournisseur('${f.id}','rabais_type',this.value)" style="width:56px;height:28px;box-sizing:border-box;font-size:11px;border:1px solid var(--gray-200);border-radius:3px;">
            <option value="pct" ${f.rabais_type !== 'chf' ? 'selected' : ''}>%</option>
            <option value="chf" ${f.rabais_type === 'chf' ? 'selected' : ''}>CHF</option>
          </select>
        </div>
      </td>
      <td><input type="text" value="${(f.notes || '').replace(/"/g, '&quot;')}" placeholder="conditions, contact, délai…" onchange="acUpdateFournisseur('${f.id}','notes',this.value)" style="font-size:11px;border:1px solid var(--gray-200);background:var(--white);padding:4px 6px;border-radius:3px;width:100%;min-width:150px;color:var(--gray-600);"></td>
      <td class="num">${st.nb}</td>
      <td style="text-align:center;"><button class="btn btn-ghost btn-sm" style="color:var(--danger);padding:2px 8px;" title="Supprimer" onclick="acDeleteFournisseur('${f.id}')">✕</button></td>
    </tr>`;
  }).join('');

  const known = (typeof acGetKnownFournisseurNames === 'function') ? acGetKnownFournisseurNames() : [];
  const unconfigured = known.filter(n => n && n.toLowerCase() !== 'non renseigné' && !configuredNames.has(n.toLowerCase()));
  const unconfRows = unconfigured.map(n => {
    const st = statFor(n);
    return `<tr>
      <td style="font-weight:600;color:var(--gray-600);">${n}</td>
      <td class="num">${st.nb}</td>
      <td style="text-align:right;"><button class="btn btn-outline btn-sm" onclick="acAddFournisseur('${(n || '').replace(/'/g, "\\'")}')">+ Configurer une condition</button></td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <div class="card" style="padding:0;margin-bottom:16px;">
      <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <div>
          <div class="card-title">Fournisseurs &amp; conditions</div>
          <div class="card-hint">Définissez un rabais par défaut (ex. 4% sur Fideco) — appliqué automatiquement aux BL de ce fournisseur.</div>
        </div>
        <button class="btn btn-primary btn-sm" style="white-space:nowrap;" onclick="acAddFournisseur()">+ Ajouter un fournisseur</button>
      </div>
      <table class="data-table" style="font-size:13px;">
        <thead><tr><th>Fournisseur</th><th class="num">Rabais par défaut</th><th>Notes / conditions</th><th class="num">Articles</th><th></th></tr></thead>
        <tbody>${confRows || `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--gray-400);">Aucun fournisseur configuré. Ajoutez-en un, ou configurez-en un depuis la liste détectée ci-dessous.</td></tr>`}</tbody>
      </table>
    </div>
    ${unconfigured.length ? `
    <div class="card" style="padding:0;">
      <div class="card-header">
        <div class="card-title">Fournisseurs détectés (non configurés)</div>
        <div class="card-hint">${unconfigured.length} fournisseur(s) présents dans vos articles / BL sans condition définie.</div>
      </div>
      <table class="data-table" style="font-size:13px;">
        <thead><tr><th>Fournisseur</th><th class="num">Articles</th><th></th></tr></thead>
        <tbody>${unconfRows}</tbody>
      </table>
    </div>` : ''}`;
}

/* ─── Init ───────────────────────────────────────────────────── */
fcLoad();
injectFCModals();
_fcInjectAnalyticsModal();

// Activer le module de démarrage (Dashboard)
(function() {
  _navActivateModule('dashboard', null);
  const dashItem = document.querySelector('.nav-direct[data-module="dashboard"]');
  if (dashItem && typeof _navSetActive === 'function') _navSetActive(dashItem);
})();

// Init Articles & Config (lazy — render au premier clic via switchACTab)
// mais pré-remplir les selects au cas où
setTimeout(() => {
  const catSel = document.getElementById('ac-filter-cat');
  if (catSel && catSel.options.length <= 1) {
    FC_CATEGORIES.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c; opt.textContent = c;
      catSel.appendChild(opt);
    });
  }
}, 500);
renderFC1();
renderFC2BLRapprochement();
renderFC3();
renderFC4();
renderFC5();
fcPopulateConsolidePickers();
_fcRefreshFacturesList();

/* ════════════════════════════════════════════════════════════════
   BL ÉDITABLES + RABAIS (par article / par BL) — étape import / scan
   ----------------------------------------------------------------
   • Carte d'import éditable (méta + lignes) — scan IA ET PHAR Marketplace
   • Rabais par article (% ou CHF) + rabais global BL (% ou CHF, prorata)
   • prix_unitaire_ht = PRIX NET (réellement payé) → CUMP, comparateur,
     cumul achats et rapprochement utilisent tous le net automatiquement.
   • prix_brut_unitaire_ht conservé pour traçabilité / ré-édition.
   Cette section remplace l'usage des anciens renderScanResultCard /
   _renderPHARMarketplaceCard (conservés mais désormais inutilisés).
   ════════════════════════════════════════════════════════════════ */

function _blFind(id) {
  return (typeof pharBLs !== 'undefined' ? pharBLs : []).find(b => b.id === id) || null;
}

/* Moteur de recalcul net : rabais par ligne, puis rabais global au prorata */
function _blRecomputeNet(bl) {
  if (!bl || !Array.isArray(bl.articles)) return;

  // 1) Rabais par ligne → sous-total
  let subtotal = 0;
  bl.articles.forEach(a => {
    const qte = parseFloat(a.quantite) || 0;
    if (a.prix_brut_unitaire_ht == null) a.prix_brut_unitaire_ht = parseFloat(a.prix_unitaire_ht) || 0;
    const brut = parseFloat(a.prix_brut_unitaire_ht) || 0;
    a.prix_brut_unitaire_ht = brut;
    a.rabais_type = (a.rabais_type === 'chf') ? 'chf' : 'pct';
    a.rabais_val  = parseFloat(a.rabais_val) || 0;

    const lineBrut = qte * brut;
    let disc = a.rabais_type === 'pct' ? lineBrut * a.rabais_val / 100 : a.rabais_val;
    if (disc < 0) disc = 0;
    if (disc > lineBrut) disc = lineBrut;
    a._afterLine = lineBrut - disc;
    subtotal += a._afterLine;
  });

  // 2) Rabais global → montant à répartir
  bl.rabais_global_type = (bl.rabais_global_type === 'chf') ? 'chf' : 'pct';
  bl.rabais_global_val  = parseFloat(bl.rabais_global_val) || 0;
  let globalDisc = bl.rabais_global_type === 'pct'
    ? subtotal * bl.rabais_global_val / 100
    : bl.rabais_global_val;
  if (globalDisc < 0) globalDisc = 0;
  if (globalDisc > subtotal) globalDisc = subtotal;

  // 3) Finalisation des lignes (prorata) + totaux
  let totHT = 0, totTVA = 0, totBrut = 0;
  bl.articles.forEach(a => {
    const qte   = parseFloat(a.quantite) || 0;
    const share = subtotal > 0 ? (a._afterLine / subtotal) * globalDisc : 0;
    const net   = Math.max(0, a._afterLine - share);

    a.total_ht             = parseFloat(net.toFixed(2));
    a.prix_unitaire_ht     = qte > 0 ? parseFloat((net / qte).toFixed(6)) : 0; // PRIX NET canonique
    a.prix_net_unitaire_ht = a.prix_unitaire_ht;

    const cat = a.categorie_suggeree
      || (typeof fcAutoCategory === 'function' ? fcAutoCategory(a.designation || '') : 'Autres');
    const autoTva = typeof fcAutoTVA === 'function' ? fcAutoTVA(a.designation || '', cat) : 2.6;
    // Override manuel confirmé sur le BL réel : prioritaire sur le taux auto
    const tva = (a.tva_override != null && !isNaN(parseFloat(a.tva_override)))
      ? parseFloat(a.tva_override) : autoTva;
    a.tva_pct = tva;

    totHT   += net;
    totTVA  += net * tva / 100;
    totBrut += qte * (parseFloat(a.prix_brut_unitaire_ht) || 0);
    delete a._afterLine;
  });

  bl.total_ht      = parseFloat(totHT.toFixed(2));
  bl.total_tva     = parseFloat(totTVA.toFixed(2));
  bl.total_ttc     = parseFloat((totHT + totTVA).toFixed(2));
  bl.total_brut_ht = parseFloat(totBrut.toFixed(2));
  bl.total_rabais  = parseFloat((totBrut - totHT).toFixed(2));
}

/* ─── Handlers d'édition (appelés depuis les onchange inline) ─── */

function _blEditArticle(blId, idx, field, value) {
  const bl = _blFind(blId);
  if (!bl || !bl.articles || !bl.articles[idx]) return;
  const a = bl.articles[idx];
  if (field === 'quantite' || field === 'prix_brut_unitaire_ht' || field === 'rabais_val') {
    a[field] = parseFloat(value) || 0;
  } else if (field === 'rabais_type') {
    a.rabais_type = value === 'chf' ? 'chf' : 'pct';
  } else {
    a[field] = value; // designation, unite, ref, categorie_suggeree
  }
  _blRecomputeNet(bl);
  if (typeof saveStores === 'function') saveStores();
  _blRerenderCard(blId);
  if (typeof renderBLRepository === 'function') renderBLRepository();
}

function _blEditMeta(blId, field, value) {
  const bl = _blFind(blId);
  if (!bl) return;
  if (field === 'rabais_global_val') {
    bl.rabais_global_val = parseFloat(value) || 0;
    _blRecomputeNet(bl);
    _blRerenderCard(blId);
  } else if (field === 'rabais_global_type') {
    bl.rabais_global_type = value === 'chf' ? 'chf' : 'pct';
    _blRecomputeNet(bl);
    _blRerenderCard(blId);
  } else {
    bl[field] = value; // fournisseur / numero / date : pas de re-render (conserve le focus)
  }
  if (typeof saveStores === 'function') saveStores();
  if (typeof renderBLRepository === 'function') renderBLRepository();
}

function _blRemoveArticle(blId, idx) {
  const bl = _blFind(blId);
  if (!bl || !bl.articles) return;
  if ((bl.articles.length || 0) <= 1) {
    if (typeof showToast === 'function') showToast('Un BL doit conserver au moins une ligne.', 'error');
    return;
  }
  bl.articles.splice(idx, 1);
  _blRecomputeNet(bl);
  if (typeof saveStores === 'function') saveStores();
  _blRerenderCard(blId);
  if (typeof renderBLRepository === 'function') renderBLRepository();
}

function _blAddArticle(blId) {
  const bl = _blFind(blId);
  if (!bl) return;
  if (!Array.isArray(bl.articles)) bl.articles = [];
  bl.articles.push({
    ref: '', designation: 'Nouvel article', quantite: 1, unite: 'pce',
    prix_brut_unitaire_ht: 0, prix_unitaire_ht: 0,
    rabais_type: 'pct', rabais_val: 0, categorie_suggeree: 'Autres'
  });
  _blRecomputeNet(bl);
  if (typeof saveStores === 'function') saveStores();
  _blRerenderCard(blId);
}

/* ─── Rendu de la carte éditable ─── */

function _blCardInnerHTML(bl) {
  const _n2  = v => (parseFloat(v) || 0).toFixed(2);
  const cats = (typeof getAllCategories === 'function' ? getAllCategories() : ['Autres']);
  const isMkt = bl.source === 'phar_marketplace';

  const rows = (bl.articles || []).map((a, idx) => {
    const cat = a.categorie_suggeree
      || (typeof fcAutoCategory === 'function' ? fcAutoCategory(a.designation || '') : 'Autres');
    const tva = a.tva_pct != null ? a.tva_pct
      : (typeof fcAutoTVA === 'function' ? fcAutoTVA(a.designation || '', cat) : 2.6);
    const catOpts = cats.map(c => `<option value="${c}" ${c === cat ? 'selected' : ''}>${c}</option>`).join('');
    const sub = (a.units_per_uv ? `${a.units_per_uv} pcs · ${_n2(a.prix_base_piece)} CHF/pce` : '')
      + (a.fournisseur_ligne && a.fournisseur_ligne !== 'PHAR Marketplace'
        ? `${a.units_per_uv ? ' · ' : ''}via ${a.fournisseur_ligne}` : '');
    const hasRab = (parseFloat(a.rabais_val) || 0) > 0;
    // TVA éditable : taux auto, override manuel confirmé, taux suisses légaux
    const autoTva = (typeof fcAutoTVA === 'function' ? fcAutoTVA(a.designation || '', cat) : 2.6);
    const isManualTva = (a.tva_override != null && !isNaN(parseFloat(a.tva_override)));
    const effTva = isManualTva ? parseFloat(a.tva_override) : autoTva;
    const _tvaRates = [8.1, 3.8, 2.6, 0];
    let tvaOpts = `<option value="__auto__" ${!isManualTva ? 'selected' : ''}>Auto (${autoTva}%)</option>`;
    tvaOpts += _tvaRates.map(r => `<option value="${r}" ${isManualTva && Math.abs(effTva - r) < 0.001 ? 'selected' : ''}>${r}%</option>`).join('');
    if (isManualTva && !_tvaRates.some(r => Math.abs(effTva - r) < 0.001))
      tvaOpts += `<option value="${effTva}" selected>${effTva}%</option>`;
    tvaOpts += `<option value="__other__">Autre…</option>`;
    return `<tr id="bl-art-row-${bl.id}-${idx}">
      <td><input type="text" value="${(a.ref || '').replace(/"/g, '&quot;')}" onchange="_blEditArticle('${bl.id}',${idx},'ref',this.value)" style="width:58px;border:none;background:transparent;font-family:monospace;font-size:11px;color:var(--gray-500);"></td>
      <td style="max-width:210px;">
        <input type="text" value="${(a.designation || '').replace(/"/g, '&quot;')}" onchange="_blEditArticle('${bl.id}',${idx},'designation',this.value)" style="width:100%;min-width:150px;font-weight:600;border:1px solid var(--gray-200);background:var(--white);padding:3px 5px;border-radius:3px;">
        ${sub ? `<div style="font-size:10px;color:var(--gray-400);margin-top:1px;padding-left:4px;">${sub}</div>` : ''}
      </td>
      <td class="num"><input type="number" value="${parseFloat(a.quantite) || 0}" step="0.01" min="0" onchange="_blEditArticle('${bl.id}',${idx},'quantite',this.value)" style="width:62px;text-align:right;"></td>
      <td><input type="text" value="${(a.unite || '').replace(/"/g, '&quot;')}" onchange="_blEditArticle('${bl.id}',${idx},'unite',this.value)" style="width:60px;font-size:11px;"></td>
      <td class="num"><input type="number" value="${parseFloat(a.prix_brut_unitaire_ht) || 0}" step="0.01" min="0" onchange="_blEditArticle('${bl.id}',${idx},'prix_brut_unitaire_ht',this.value)" style="width:74px;text-align:right;font-weight:600;"></td>
      <td style="white-space:nowrap;">
        <div style="display:flex;align-items:center;justify-content:flex-end;gap:4px;">
          <input type="number" value="${parseFloat(a.rabais_val) || 0}" step="0.01" min="0" onchange="_blEditArticle('${bl.id}',${idx},'rabais_val',this.value)" style="width:48px;height:26px;box-sizing:border-box;text-align:right;${hasRab ? 'color:var(--danger);font-weight:700;' : ''}">
          <select onchange="_blEditArticle('${bl.id}',${idx},'rabais_type',this.value)" style="width:52px;height:26px;box-sizing:border-box;font-size:11px;padding:2px 4px;border:1px solid var(--gray-200);border-radius:3px;">
            <option value="pct" ${a.rabais_type !== 'chf' ? 'selected' : ''}>%</option>
            <option value="chf" ${a.rabais_type === 'chf' ? 'selected' : ''}>CHF</option>
          </select>
        </div>
      </td>
      <td class="num" style="font-variant-numeric:tabular-nums;${hasRab ? 'color:var(--phar-navy);font-weight:700;' : 'color:var(--gray-500);'}">${_n2(a.prix_unitaire_ht)}</td>
      <td class="num" style="font-weight:700;font-variant-numeric:tabular-nums;">${_n2(a.total_ht)}</td>
      <td style="text-align:center;">
        <select onchange="_blSetTVA('${bl.id}',${idx},this.value)" title="${isManualTva ? 'TVA confirmée manuellement' : 'TVA déduite automatiquement — à confirmer selon le BL'}" style="font-size:11px;height:26px;box-sizing:border-box;padding:2px 4px;border-radius:3px;border:1px solid ${isManualTva ? 'var(--phar-navy)' : 'var(--gray-200)'};${isManualTva ? 'color:var(--phar-navy);font-weight:700;' : ''}">${tvaOpts}</select>
      </td>
      <td class="num" style="font-weight:700;color:var(--phar-navy);font-variant-numeric:tabular-nums;">${_n2((parseFloat(a.total_ht) || 0) * (1 + tva / 100))}</td>
      <td><select onchange="_blEditArticle('${bl.id}',${idx},'categorie_suggeree',this.value)" style="font-size:11px;padding:3px 6px;border:1px solid var(--gray-200);border-radius:3px;">${catOpts}</select></td>
      <td style="text-align:center;"><button class="btn btn-ghost btn-sm" style="color:var(--danger);padding:2px 7px;" title="Supprimer la ligne" onclick="_blRemoveArticle('${bl.id}',${idx})">✕</button></td>
    </tr>`;
  }).join('');

  const headerIcon = isMkt
    ? `<svg width="16" height="14" viewBox="0 0 110 96" style="vertical-align:middle;margin-right:6px;"><polygon points="27.5,2 82.5,2 110,48 82.5,94 27.5,94 0,48" fill="var(--phar-navy)"/><polygon points="24,76 24,22 72,46" fill="white"/></svg>`
    : '✓ ';
  const titleTxt = isMkt ? 'PHAR Marketplace · Commande'
    : (bl.type_document === 'facture' ? 'Facture' : 'Bon de livraison');
  const gRabActive = (parseFloat(bl.rabais_global_val) || 0) > 0;

  return `
    <div class="scan-result-header" style="${isMkt ? 'background:linear-gradient(90deg,var(--phar-navy-faint),white);' : ''}">
      <div style="flex:1;">
        <h3 style="${isMkt ? 'color:var(--phar-navy);' : ''}">${headerIcon}${titleTxt}</h3>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px;">
          <label style="font-size:10px;color:var(--gray-500);display:flex;flex-direction:column;gap:2px;">FOURNISSEUR
            <select onchange="_blSelectFournisseur('${bl.id}',this.value)" style="font-size:12px;padding:3px 6px;border:1px solid var(--gray-200);border-radius:3px;min-width:170px;">
              ${_blFournisseurOptions(bl.fournisseur)}
            </select>
          </label>
          <label style="font-size:10px;color:var(--gray-500);display:flex;flex-direction:column;gap:2px;">N° DOCUMENT
            <input type="text" value="${(bl.numero || '').replace(/"/g, '&quot;')}" onchange="_blEditMeta('${bl.id}','numero',this.value)" style="font-size:12px;padding:3px 6px;border:1px solid var(--gray-200);border-radius:3px;width:130px;font-family:monospace;">
          </label>
          <label style="font-size:10px;color:var(--gray-500);display:flex;flex-direction:column;gap:2px;">DATE
            <input type="text" value="${(bl.date || '').replace(/"/g, '&quot;')}" onchange="_blEditMeta('${bl.id}','date',this.value)" style="font-size:12px;padding:3px 6px;border:1px solid var(--gray-200);border-radius:3px;width:110px;">
          </label>
        </div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="openBLIntegrationModalFromBL('${bl.id}')">Intégrer à l'inventaire</button>
    </div>

    <div class="inv-table-scroll">
      <table class="data-table" style="font-size:12px;">
        <thead><tr>
          <th>Réf.</th><th>Désignation</th><th class="num">Qté</th><th>Unité</th>
          <th class="num">PU brut HT</th><th class="num">Rabais</th><th class="num">PU net</th>
          <th class="num">Total HT</th><th style="text-align:center;">TVA</th><th class="num">Total TTC</th>
          <th>Catégorie</th><th></th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr style="background:var(--phar-navy-pale);">
            <td colspan="6" style="padding:8px 12px;">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <span style="font-weight:700;color:var(--phar-navy);">Rabais global BL :</span>
                <input type="number" value="${parseFloat(bl.rabais_global_val) || 0}" step="0.01" min="0" onchange="_blEditMeta('${bl.id}','rabais_global_val',this.value)" style="width:60px;height:28px;box-sizing:border-box;text-align:right;${gRabActive ? 'color:var(--danger);font-weight:700;' : ''}">
                <select onchange="_blEditMeta('${bl.id}','rabais_global_type',this.value)" style="width:56px;height:28px;box-sizing:border-box;font-size:11px;padding:2px 4px;border:1px solid var(--gray-200);border-radius:3px;">
                  <option value="pct" ${bl.rabais_global_type !== 'chf' ? 'selected' : ''}>%</option>
                  <option value="chf" ${bl.rabais_global_type === 'chf' ? 'selected' : ''}>CHF</option>
                </select>
                <span style="font-size:10px;color:var(--gray-400);">réparti au prorata des lignes</span>
                <button class="btn btn-ghost btn-sm" style="margin-left:auto;" onclick="_blAddArticle('${bl.id}')">+ Ajouter une ligne</button>
              </div>
            </td>
            <td class="num" style="font-size:10px;color:var(--gray-500);">Net</td>
            <td class="num" style="font-weight:800;">${_n2(bl.total_ht)}</td>
            <td style="text-align:center;font-size:10px;color:var(--gray-500);">TVA ${_n2(bl.total_tva)}</td>
            <td class="num" style="font-weight:800;font-family:'Archivo';font-size:13px;color:var(--phar-navy);">${_n2(bl.total_ttc)}</td>
            <td colspan="2"></td>
          </tr>
          ${(bl.total_rabais || 0) > 0 ? `<tr><td colspan="12" style="padding:6px 12px;font-size:11px;color:var(--danger);background:var(--danger-light);">Rabais total appliqué : −${_n2(bl.total_rabais)} CHF · brut ${_n2(bl.total_brut_ht)} → net ${_n2(bl.total_ht)} HT</td></tr>` : ''}
        </tfoot>
      </table>
    </div>
    ${bl.notes ? `<div style="padding:8px 16px;background:var(--gray-50);border-top:1px solid var(--gray-200);font-size:11px;color:var(--gray-600);"><strong>Notes :</strong> ${bl.notes}</div>` : ''}
    <div style="padding:6px 16px;background:var(--gray-50);border-top:1px solid var(--gray-200);font-size:10px;color:var(--gray-400);">Modifications enregistrées automatiquement · ${isMkt ? 'Import PHAR Marketplace' : 'Scan IA'}${bl.fichier ? ' · ' + bl.fichier : ''}</div>
  `;
}

function _blRerenderCard(blId) {
  const el = document.getElementById('bl-card-' + blId);
  const bl = _blFind(blId);
  if (el && bl) el.innerHTML = _blCardInnerHTML(bl);
}

function renderEditableBLCard(bl) {
  if (!bl) return;
  // Applique une seule fois la condition de rabais du fournisseur configuré (si aucun rabais global encore saisi)
  if (!bl._four_cond_applied) {
    _blApplyFournisseurCondition(bl, false);
    bl._four_cond_applied = true;
  }
  _blRecomputeNet(bl);
  const container = document.getElementById('bl-scan-results');
  if (!container) return;
  let card = document.getElementById('bl-card-' + bl.id);
  if (!card) {
    card = document.createElement('div');
    card.className = 'scan-result-card';
    card.id = 'bl-card-' + bl.id;
    card.style.marginBottom = '16px';
    container.appendChild(card);
  }
  card.innerHTML = _blCardInnerHTML(bl);
}

/* Override : la carte d'import éditable remplace le rendu précédent */
window.renderScanResultCard = function (bl) { renderEditableBLCard(bl); };

/* ════════════════════════════════════════════════════════════════
   FOURNISSEURS CONFIGURÉS + CONDITIONS DE RABAIS
   • Store persistant pharFournisseurs (phar_fournisseurs_v1)
   • Onglet Achats → Fournisseurs : CRUD + rabais par défaut
   • Liste déroulante fournisseur dans la carte BL + application auto
   ════════════════════════════════════════════════════════════════ */

function acGetConfiguredFournisseurs() {
  return (typeof pharFournisseurs !== 'undefined' && Array.isArray(pharFournisseurs)) ? pharFournisseurs : [];
}

function acFindFournisseur(nom) {
  if (!nom) return null;
  const n = String(nom).trim().toLowerCase();
  return acGetConfiguredFournisseurs().find(f => String(f.nom || '').trim().toLowerCase() === n) || null;
}

/** Union des noms de fournisseurs : configurés + vus dans articles + vus dans BL */
function acGetKnownFournisseurNames() {
  const map = new Map(); // clé minuscule -> libellé affiché
  acGetConfiguredFournisseurs().forEach(f => { const d = (f.nom || '').trim(); if (d) map.set(d.toLowerCase(), d); });
  if (typeof acGetAllArticles === 'function') {
    acGetAllArticles().forEach(a => { const d = (a.fournisseur || '').trim(); if (d) map.set(d.toLowerCase(), d); });
  }
  (typeof pharBLs !== 'undefined' ? pharBLs : []).forEach(b => {
    const d = (b.fournisseur || '').trim(); if (d) map.set(d.toLowerCase(), d);
    (b.articles || []).forEach(l => {
      const fl = (l.fournisseur_ligne || '').trim();
      if (fl && fl !== 'PHAR Marketplace') map.set(fl.toLowerCase(), fl);
    });
  });
  return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'fr'));
}

function acAddFournisseur(nom) {
  if (typeof pharFournisseurs === 'undefined') return;
  const name = (typeof nom === 'string' ? nom : '').trim();
  if (name && acFindFournisseur(name)) {
    if (typeof showToast === 'function') showToast('Ce fournisseur est déjà configuré.', '');
    return;
  }
  pharFournisseurs.push({
    id: 'four_' + Math.random().toString(36).slice(2, 9),
    nom: name || 'Nouveau fournisseur',
    rabais_type: 'pct', rabais_val: 0, notes: ''
  });
  if (typeof saveStores === 'function') saveStores();
  acRenderFournisseurs();
}

function acUpdateFournisseur(id, field, value) {
  const f = acGetConfiguredFournisseurs().find(x => x.id === id);
  if (!f) return;
  if (field === 'rabais_val') f.rabais_val = parseFloat(value) || 0;
  else if (field === 'rabais_type') f.rabais_type = value === 'chf' ? 'chf' : 'pct';
  else f[field] = value; // nom / notes
  if (typeof saveStores === 'function') saveStores();
  // Re-render uniquement pour les champs de rabais (sinon on perd le focus de saisie texte)
  if (field === 'rabais_val' || field === 'rabais_type') acRenderFournisseurs();
}

function acDeleteFournisseur(id) {
  if (typeof pharFournisseurs === 'undefined') return;
  const f = pharFournisseurs.find(x => x.id === id);
  if (f && typeof confirm === 'function' && !confirm(`Supprimer le fournisseur « ${f.nom} » et sa condition de rabais ?`)) return;
  const i = pharFournisseurs.findIndex(x => x.id === id);
  if (i >= 0) pharFournisseurs.splice(i, 1);
  if (typeof saveStores === 'function') saveStores();
  acRenderFournisseurs();
}

/* ─── Liste déroulante fournisseur dans la carte BL ─── */

function _blFournisseurOptions(current) {
  const names = acGetKnownFournisseurNames();
  const cur = (current || '').trim();
  if (cur && !names.some(n => n.toLowerCase() === cur.toLowerCase())) names.unshift(cur);
  let opts = `<option value="" ${!cur ? 'selected' : ''}>— Choisir un fournisseur —</option>`;
  opts += names.map(n => {
    const sup = acFindFournisseur(n);
    const cond = sup && (parseFloat(sup.rabais_val) || 0) > 0
      ? ` (−${sup.rabais_val}${sup.rabais_type === 'chf' ? ' CHF' : '%'})` : '';
    const sel = cur && n.toLowerCase() === cur.toLowerCase() ? 'selected' : '';
    return `<option value="${n.replace(/"/g, '&quot;')}" ${sel}>${n}${cond}</option>`;
  }).join('');
  opts += `<option value="__new__">+ Autre fournisseur…</option>`;
  return opts;
}

function _blSelectFournisseur(blId, value) {
  const bl = _blFind(blId);
  if (!bl) return;
  if (value === '__new__') {
    const nom = (typeof prompt === 'function') ? prompt('Nom du nouveau fournisseur :', '') : '';
    if (nom && nom.trim()) bl.fournisseur = nom.trim();
    // sinon on garde l'ancienne valeur (le re-render rétablit le select)
  } else {
    bl.fournisseur = value;
  }
  const applied = _blApplyFournisseurCondition(bl, true);
  bl._four_cond_applied = true;
  _blRecomputeNet(bl);
  if (typeof saveStores === 'function') saveStores();
  _blRerenderCard(blId);
  if (typeof renderBLRepository === 'function') renderBLRepository();
  if (applied && typeof showToast === 'function') {
    const sup = acFindFournisseur(bl.fournisseur);
    showToast(`Condition « ${bl.fournisseur} » appliquée : rabais ${sup.rabais_val}${sup.rabais_type === 'chf' ? ' CHF' : '%'}`, 'success');
  }
}

/** Applique la condition de rabais d'un fournisseur configuré au rabais global du BL.
 *  force=false : n'applique que si aucun rabais global n'est déjà saisi. */
function _blApplyFournisseurCondition(bl, force) {
  if (!bl) return false;
  const sup = acFindFournisseur(bl.fournisseur);
  if (!sup) return false;
  const val = parseFloat(sup.rabais_val) || 0;
  if (val <= 0) return false;
  if (!force && (parseFloat(bl.rabais_global_val) || 0) > 0) return false;
  bl.rabais_global_type = sup.rabais_type === 'chf' ? 'chf' : 'pct';
  bl.rabais_global_val = val;
  return true;
}

/* ─── TVA éditable par ligne (override manuel confirmé) ─── */
function _blSetTVA(blId, idx, value) {
  const bl = _blFind(blId);
  if (!bl || !bl.articles || !bl.articles[idx]) return;
  const a = bl.articles[idx];
  if (value === '__auto__') {
    a.tva_override = null; // revient au taux automatique
  } else if (value === '__other__') {
    const cur = a.tva_pct != null ? a.tva_pct : '';
    const v = (typeof prompt === 'function') ? prompt('Taux de TVA (%) figurant sur le BL :', String(cur)) : null;
    if (v === null) { _blRerenderCard(blId); return; } // annulé → rétablit le sélecteur
    const n = parseFloat(String(v).replace(',', '.'));
    if (isNaN(n) || n < 0) {
      if (typeof showToast === 'function') showToast('Taux de TVA invalide.', 'error');
      _blRerenderCard(blId);
      return;
    }
    a.tva_override = n;
  } else {
    a.tva_override = parseFloat(value) || 0;
  }
  _blRecomputeNet(bl);
  if (typeof saveStores === 'function') saveStores();
  _blRerenderCard(blId);
  if (typeof renderBLRepository === 'function') renderBLRepository();
}
