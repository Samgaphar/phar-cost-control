/* ============================================================
   PHAR Cost — dashboard.js
   Tableau de bord : AUCUNE donnée n'est écrite en dur ici.

   Chaque indicateur est recalculé à la volée à partir de :
     • pharBLs          → bulletins et factures réellement scannés
     • pharStores       → inventaire et CUMP réels
     • fcHistorique     → semaines Flash Cost validées
     • fcSemaine        → semaine en cours
     • pharSettings     → cibles de ratio paramétrées

   Quand une donnée n'existe pas encore, l'indicateur affiche « — »
   accompagné de la raison précise. Il ne montre jamais un chiffre
   plausible mais inventé.
   ============================================================ */

const DASH_LS_PERIOD = 'phar_dash_period_v1';

let _dashPeriod = (() => {
  try { return localStorage.getItem(DASH_LS_PERIOD) || 'mois'; } catch (e) { return 'mois'; }
})();

/* ─── Dates ─────────────────────────────────────────────────── */

/** Parse une date « JJ.MM.AAAA » (ou ISO) → Date, ou null si illisible. */
function _dashParseDate(v) {
  if (!v) return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** Bornes [debut, fin[ de la période courante et de la précédente. */
function _dashRange(period, ref) {
  const now = ref || new Date();
  let debut, fin, prevDebut, label;

  if (period === 'semaine') {
    const day = now.getDay() || 7;
    debut = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1);
    fin   = new Date(debut); fin.setDate(debut.getDate() + 7);
    prevDebut = new Date(debut); prevDebut.setDate(debut.getDate() - 7);
    label = 'semaine en cours';
  } else if (period === 'trimestre') {
    const q = Math.floor(now.getMonth() / 3);
    debut = new Date(now.getFullYear(), q * 3, 1);
    fin   = new Date(now.getFullYear(), q * 3 + 3, 1);
    prevDebut = new Date(now.getFullYear(), q * 3 - 3, 1);
    label = 'trimestre en cours';
  } else if (period === 'annee') {
    debut = new Date(now.getFullYear(), 0, 1);
    fin   = new Date(now.getFullYear() + 1, 0, 1);
    prevDebut = new Date(now.getFullYear() - 1, 0, 1);
    label = 'année en cours';
  } else {
    debut = new Date(now.getFullYear(), now.getMonth(), 1);
    fin   = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    prevDebut = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    label = 'mois en cours';
  }
  return { debut, fin, prevDebut, prevFin: debut, label };
}

function _dashPeriodLabel(r) {
  const f = d => d.toLocaleDateString('fr-CH', { day: '2-digit', month: 'short', year: 'numeric' });
  const veille = new Date(r.fin); veille.setDate(veille.getDate() - 1);
  return `${f(r.debut)} → ${f(veille)}`;
}

/* ─── Formatage ─────────────────────────────────────────────── */

function _dashCHF(n) {
  return (Number(n) || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}
function _dashCHF0(n) {
  return Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}
function _dashEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ─── Collecte des données réelles ──────────────────────────── */

/** Bulletins d'achat (BL + saisies manuelles) d'une période. Les factures
 *  scannées sont exclues : elles reprennent des BL déjà comptés. */
function _dashAchatsDocs(debut, fin) {
  const all = (typeof pharBLs !== 'undefined' && Array.isArray(pharBLs)) ? pharBLs : [];
  return all.filter(b => {
    if (b.type_document === 'facture') return false;
    const d = _dashParseDate(b.date) || _dashParseDate(b.scan_ts);
    return d && d >= debut && d < fin;
  });
}

/** Total HT net des achats : bons de livraison moins bulletins de retour. */
function _dashAchatsHT(docs) {
  return docs.reduce((s, b) => {
    const ht = parseFloat(b.total_ht) || 0;
    return s + (b.type_document === 'bulletin_retour' ? -ht : ht);
  }, 0);
}

/** Semaines Flash Cost validées dont la date de début tombe dans la période. */
function _dashSemaines(debut, fin) {
  const h = (typeof fcHistorique !== 'undefined' && Array.isArray(fcHistorique)) ? fcHistorique : [];
  return h.filter(w => {
    const d = _dashParseDate(w.debut);
    return d && d >= debut && d < fin;
  });
}

/** Valorisation du stock au CUMP (ou au P.U. si aucun CUMP connu). */
function _dashStockValorise() {
  if (typeof pharStores === 'undefined') return { valeur: 0, articles: 0 };
  let valeur = 0, articles = 0;
  ['food', 'bev'].forEach(m => {
    (pharStores[m] || []).forEach(it => {
      const qte = Object.values(it.pos || {}).reduce((s, v) => s + (parseFloat(v) || 0), 0);
      if (qte > 0) {
        articles++;
        valeur += qte * (it.cump != null ? it.cump : (it.pu || 0));
      }
    });
  });
  return { valeur, articles };
}

/** Cibles de ratio paramétrées (Paramètres → Entreprise). */
function _dashCibles() {
  const e = (typeof pharSettings !== 'undefined' && pharSettings && pharSettings.entreprise) || {};
  return {
    food: parseFloat(e.target_food_cost) || 30,
    bev:  parseFloat(e.target_bev_cost)  || 20
  };
}

/* ─── Briques d'affichage ───────────────────────────────────── */

/** Carte KPI. `value === null` → « — » avec la raison affichée en pied. */
function _dashKpi(opts) {
  const vide = opts.value === null || opts.value === undefined;
  // Une carte sans valeur reste neutre : pas de couleur d'accent qui
  // suggérerait un résultat là où il n'y a rien de mesuré.
  const cls  = (!vide && opts.variant) ? ' kpi-' + opts.variant : '';
  const val  = opts.value === null || opts.value === undefined
    ? '<span style="color:var(--gray-300);">—</span>'
    : _dashEsc(opts.value);
  const unit = (opts.value !== null && opts.unit) ? `<small>${_dashEsc(opts.unit)}</small>` : '';
  const foot = opts.value === null
    ? `<span style="color:var(--gray-400);">${_dashEsc(opts.missing || 'donnée non disponible')}</span>`
    : (opts.foot || '');
  return `
    <div class="kpi${cls}">
      <div class="kpi-corner"></div>
      <div class="kpi-label">${_dashEsc(opts.label)}</div>
      <div class="kpi-value">${val} ${unit}</div>
      <div class="kpi-foot">${foot}</div>
    </div>`;
}

/** Variation vs période précédente, ou mention explicite si elle est vide. */
function _dashTrend(actuel, precedent) {
  if (!precedent) return '<span style="color:var(--gray-400);">pas de période de comparaison</span>';
  const pct = (actuel - precedent) / Math.abs(precedent) * 100;
  if (!isFinite(pct)) return '';
  const hausse = pct >= 0;
  return `vs période précédente <span class="kpi-trend ${hausse ? 'up' : 'down'}">${hausse ? '↑' : '↓'} ${Math.abs(pct).toFixed(1)}%</span>`;
}

function _dashEmpty(msg, hint) {
  return `
    <div style="padding:28px 20px;text-align:center;color:var(--gray-400);font-size:13px;">
      <div style="font-weight:600;color:var(--gray-500);margin-bottom:4px;">${_dashEsc(msg)}</div>
      ${hint ? `<div style="font-size:12px;">${_dashEsc(hint)}</div>` : ''}
    </div>`;
}

/* ─── Rendu principal ───────────────────────────────────────── */

function renderDashboard() {
  const host = document.getElementById('dash-content');
  if (!host) return;

  const r       = _dashRange(_dashPeriod);
  const cibles  = _dashCibles();
  const docs    = _dashAchatsDocs(r.debut, r.fin);
  const docsPrev = _dashAchatsDocs(r.prevDebut, r.prevFin);
  const achats     = _dashAchatsHT(docs);
  const achatsPrev = _dashAchatsHT(docsPrev);
  const semaines     = _dashSemaines(r.debut, r.fin);
  const semainesPrev = _dashSemaines(r.prevDebut, r.prevFin);
  const stock   = _dashStockValorise();

  const sub = document.getElementById('dash-subtitle');
  if (sub) sub.textContent = `Chiffres calculés sur vos données · ${r.label} · ${_dashPeriodLabel(r)}`;

  // ── CA et food cost : uniquement depuis les semaines validées ──
  const caTotal   = semaines.reduce((s, w) => s + (parseFloat(w.ca_ht) || 0), 0);
  const coutTotal = semaines.reduce((s, w) => s + (parseFloat(w.cout_total) || 0), 0);
  const caPrev    = semainesPrev.reduce((s, w) => s + (parseFloat(w.ca_ht) || 0), 0);
  const ratio     = caTotal > 0 ? (coutTotal / caTotal * 100) : null;

  let ratioVariant = '';
  if (ratio !== null) ratioVariant = ratio <= cibles.food ? 'success' : 'warning';

  const kpis = `
    <div class="kpi-grid">
      ${_dashKpi({
        label: 'Achats F&B',
        value: docs.length ? _dashCHF0(achats) : null,
        unit: 'CHF',
        variant: 'primary',
        foot: `${docs.length} document(s) · ${_dashTrend(achats, achatsPrev)}`,
        missing: 'aucun bulletin scanné sur la période'
      })}
      ${_dashKpi({
        label: 'CA matière HT',
        value: caTotal > 0 ? _dashCHF0(caTotal) : null,
        unit: 'CHF',
        foot: `${semaines.length} semaine(s) validée(s) · ${_dashTrend(caTotal, caPrev)}`,
        missing: 'CA non saisi — Flash Cost → Calcul'
      })}
      ${_dashKpi({
        label: 'Food cost réel',
        value: ratio !== null ? ratio.toFixed(1) : null,
        unit: '%',
        variant: ratioVariant,
        foot: `cible ${cibles.food}% · coût matière ${_dashCHF0(coutTotal)} CHF`,
        missing: 'aucune semaine validée sur la période'
      })}
      ${_dashKpi({
        label: 'Stock valorisé',
        value: stock.articles ? _dashCHF0(stock.valeur) : null,
        unit: 'CHF',
        foot: `${stock.articles} article(s) en stock · valorisé au CUMP`,
        missing: 'aucun stock saisi ni entrée de BL'
      })}
    </div>`;

  host.innerHTML = kpis
    + `<div class="dash-charts" style="display:grid;grid-template-columns:2fr 1fr;gap:20px;margin-bottom:24px;">
         ${_dashChartFoodCost(cibles.food)}
         ${_dashChartFournisseurs(docs, r)}
       </div>`
    + _dashAlertes(r, docs, ratio, cibles);
}

/* ─── Graphique : évolution du food cost (semaines validées) ── */

function _dashChartFoodCost(cible) {
  const h = (typeof fcHistorique !== 'undefined' && Array.isArray(fcHistorique)) ? fcHistorique : [];
  // fcHistorique est empilé du plus récent au plus ancien : on remet dans l'ordre
  const last = h.slice(0, 6).reverse().filter(w => (parseFloat(w.ca_ht) || 0) > 0);

  const head = `
    <div class="row-between mb-md">
      <div>
        <div class="card-title" style="margin-bottom:4px;">Évolution food cost</div>
        <div class="card-hint">semaines validées · cible ${cible}%</div>
      </div>
    </div>`;

  if (!last.length) {
    return `<div class="chart-card">${head}${_dashEmpty(
      'Aucune semaine validée',
      'Validez une semaine dans Flash Cost → Calcul pour alimenter cette courbe.')}</div>`;
  }

  // Échelle : 0 → max(ratios, cible) arrondi vers le haut, minimum 40%
  const maxRatio = Math.max(cible, ...last.map(w => parseFloat(w.ratio) || 0));
  const echelle  = Math.max(40, Math.ceil(maxRatio / 10) * 10);

  const bars = last.map((w, i) => {
    const ratio  = parseFloat(w.ratio) || 0;
    const height = Math.max(2, (ratio / echelle) * 100);
    const dernier = i === last.length - 1;
    return `<div class="bar-col"><div class="bar${dernier ? '' : ' past'}" style="height:${height.toFixed(1)}%;"><span class="bar-value">${ratio.toFixed(1)}</span></div></div>`;
  }).join('');

  const labels = last.map(w => {
    const num = String(w.semaine || '').split('-W')[1];
    return `<div class="bar-label">${num ? 'S' + num : _dashEsc(w.debut || '')}</div>`;
  }).join('');

  return `
    <div class="chart-card">
      ${head}
      <div class="bars">${bars}</div>
      <div class="bar-labels">${labels}</div>
    </div>`;
}

/* ─── Graphique : top fournisseurs (BL de la période) ───────── */

function _dashChartFournisseurs(docs, r) {
  const head = `
    <div class="row-between mb-md">
      <div class="card-title">Top fournisseurs</div>
      <div class="card-hint">${_dashEsc(r.label)}</div>
    </div>`;

  const par = {};
  docs.forEach(b => {
    const nom = (b.fournisseur || '').trim() || 'Fournisseur non renseigné';
    const ht  = parseFloat(b.total_ht) || 0;
    par[nom] = (par[nom] || 0) + (b.type_document === 'bulletin_retour' ? -ht : ht);
  });

  const list = Object.entries(par)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (!list.length) {
    return `<div class="chart-card">${head}${_dashEmpty(
      'Aucun achat sur la période',
      'Scannez un bulletin de livraison dans Achats.')}</div>`;
  }

  const max = list[0][1];
  const rows = list.map(([nom, val]) => `
    <div>
      <div class="row-between" style="margin-bottom:6px;">
        <span style="font-size:13px;font-weight:600;">${_dashEsc(nom)}</span>
        <span style="font-size:12px;color:var(--gray-500);font-weight:600;">${_dashCHF0(val)} CHF</span>
      </div>
      <div style="height:6px;background:var(--gray-100);border-radius:1px;">
        <div style="height:100%;width:${(val / max * 100).toFixed(1)}%;background:var(--phar-navy);border-radius:1px;"></div>
      </div>
    </div>`).join('');

  return `
    <div class="chart-card">
      ${head}
      <div style="display:flex;flex-direction:column;gap:16px;padding-top:8px;">${rows}</div>
    </div>`;
}

/* ─── Alertes réelles ───────────────────────────────────────── */

function _dashAlertes(r, docs, ratio, cibles) {
  const alertes = [];
  const bls = (typeof pharBLs !== 'undefined' && Array.isArray(pharBLs)) ? pharBLs : [];

  // 1. Bulletins non rapprochés (toutes périodes confondues)
  const aRappr = bls.filter(b =>
    b.type_document !== 'facture' &&
    (b.statut === 'a_rapprocher' || b.statut === 'integre_stock'));
  if (aRappr.length) {
    const montant = _dashAchatsHT(aRappr);
    alertes.push({
      niveau: 'warning',
      titre: `${aRappr.length} bulletin(s) en attente de rapprochement`,
      texte: `${_dashCHF0(montant)} CHF HT non encore rattachés à une facture fournisseur.`,
      action: 'Rapprocher',
      onclick: "switchAchatsTab('bulletins')"
    });
  }

  // 2. Factures consolidées en écart significatif
  let factures = [];
  try { factures = JSON.parse(localStorage.getItem('phar_fc_factures_v1')) || []; } catch (e) {}
  const enEcart = factures.filter(f => f.statut === 'ecart_significatif');
  if (enEcart.length) {
    const total = enEcart.reduce((s, f) => s + Math.abs(parseFloat(f.ecart_ht) || 0), 0);
    alertes.push({
      niveau: 'danger',
      titre: `${enEcart.length} facture(s) en écart significatif`,
      texte: `Écart cumulé de ${_dashCHF(total)} CHF HT entre les bulletins et les factures reçues.`,
      action: 'Examiner',
      onclick: "switchAchatsTab('recap')"
    });
  }

  // 3. Prix d'achat au-dessus du seuil sur les articles leaders
  if (typeof fcCalcSemaine === 'function' && typeof fcArticles !== 'undefined' && fcArticles.length) {
    const calc = fcCalcSemaine();
    const chers = calc ? calc.details.filter(a => a.alertePrix) : [];
    if (chers.length) {
      const pire = chers.sort((a, b) => b.ecartPct - a.ecartPct)[0];
      alertes.push({
        niveau: 'danger',
        titre: `${chers.length} article(s) achetés au-dessus du seuil`,
        texte: `Plus fort écart : ${_dashEsc(pire.nom)} à ${_dashCHF(pire.prixReelMoyen)} CHF `
             + `vs cible ${_dashCHF(pire.prix_cible)} CHF (+${pire.ecartPct.toFixed(1)}%).`,
        action: 'Voir',
        onclick: "_navActivateModule('fc-calcul', null)"
      });
    }
  }

  // 4. Food cost au-dessus de la cible
  if (ratio !== null && ratio > cibles.food) {
    alertes.push({
      niveau: 'warning',
      titre: 'Food cost au-dessus de la cible',
      texte: `${ratio.toFixed(1)}% mesuré sur les semaines validées de la période, pour une cible de ${cibles.food}%.`,
      action: 'Analyser',
      onclick: "_navActivateModule('fc-calcul', null)"
    });
  }

  // 5. Bulletins scannés incomplets (fournisseur ou numéro manquant)
  const incomplets = docs.filter(b => !(b.fournisseur || '').trim() || !(b.numero || '').trim());
  if (incomplets.length) {
    alertes.push({
      niveau: 'info',
      titre: `${incomplets.length} bulletin(s) incomplet(s)`,
      texte: 'Fournisseur ou numéro de document manquant après extraction — à compléter pour un rapprochement fiable.',
      action: 'Compléter',
      onclick: "switchAchatsTab('bulletins')"
    });
  }

  const icones = {
    danger:  '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    warning: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
    info:    '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'
  };

  const bar = `
    <div class="section-bar">
      <div class="section-bar-num">${alertes.length ? '!' : '✓'}</div>
      <div class="section-bar-label">Alertes en cours · ${alertes.length}</div>
      <div class="section-bar-line"></div>
    </div>`;

  if (!alertes.length) {
    return bar + `
      <div class="alert info">
        <div class="alert-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div class="alert-content">
          <div class="alert-title">Aucune alerte</div>
          <div class="alert-text">Rien à signaler sur vos données actuelles. Les alertes apparaissent dès qu'un écart réel est détecté.</div>
        </div>
      </div>`;
  }

  const ordre = { danger: 0, warning: 1, info: 2 };
  return bar + alertes
    .sort((a, b) => ordre[a.niveau] - ordre[b.niveau])
    .map(a => `
      <div class="alert ${a.niveau}">
        <div class="alert-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${icones[a.niveau]}</svg>
        </div>
        <div class="alert-content">
          <div class="alert-title">${a.titre}</div>
          <div class="alert-text">${a.texte}</div>
        </div>
        <button class="btn btn-outline btn-sm" onclick="${a.onclick}">${a.action}</button>
      </div>`).join('');
}

/* ─── Sélecteur de période ──────────────────────────────────── */

function setDashPeriod(period) {
  _dashPeriod = period;
  try { localStorage.setItem(DASH_LS_PERIOD, period); } catch (e) {}
  document.querySelectorAll('#dash-period-segment .segment-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.dashPeriod === period));
  renderDashboard();
}

/* ─── Export du rapport ─────────────────────────────────────── */

function exportDashboardPDF() {
  const r = _dashRange(_dashPeriod);
  const docs = _dashAchatsDocs(r.debut, r.fin);
  const semaines = _dashSemaines(r.debut, r.fin);
  const cibles = _dashCibles();
  const stock = _dashStockValorise();
  const achats = _dashAchatsHT(docs);
  const ca = semaines.reduce((s, w) => s + (parseFloat(w.ca_ht) || 0), 0);
  const cout = semaines.reduce((s, w) => s + (parseFloat(w.cout_total) || 0), 0);
  const ratio = ca > 0 ? (cout / ca * 100) : null;
  const enseigne = (typeof _fcEnseigne === 'function') ? _fcEnseigne() : 'Établissement';

  const ligne = (label, valeur, note) => `
    <tr><td>${_dashEsc(label)}</td>
        <td style="text-align:right;font-weight:700;">${valeur}</td>
        <td style="color:#777;font-size:11px;">${_dashEsc(note || '')}</td></tr>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Tableau de bord</title>
  <style>body{font-family:Arial,sans-serif;font-size:12px;margin:24px;}h1{color:#2C3183;margin-bottom:2px;}
  .sub{color:#777;margin-bottom:20px;}table{width:100%;border-collapse:collapse;margin-bottom:20px;}
  th{background:#2C3183;color:#fff;padding:6px 10px;text-align:left;font-size:10px;text-transform:uppercase;}
  td{padding:6px 10px;border-bottom:1px solid #eee;}
  .foot{margin-top:24px;color:#999;font-size:10px;border-top:1px solid #eee;padding-top:8px;}
  @media print{@page{margin:12mm;}}</style></head><body>
  <h1>Tableau de bord — ${_dashEsc(enseigne)}</h1>
  <div class="sub">${_dashEsc(r.label)} · ${_dashEsc(_dashPeriodLabel(r))}</div>
  <table><thead><tr><th>Indicateur</th><th style="text-align:right;">Valeur</th><th>Base de calcul</th></tr></thead><tbody>
  ${ligne('Achats F&B (HT)', docs.length ? _dashCHF(achats) + ' CHF' : '—',
          docs.length ? `${docs.length} bulletin(s), retours déduits` : 'aucun bulletin sur la période')}
  ${ligne('CA matière (HT)', ca > 0 ? _dashCHF(ca) + ' CHF' : '—',
          semaines.length ? `${semaines.length} semaine(s) Flash Cost validée(s)` : 'aucun CA saisi')}
  ${ligne('Coût matière', cout > 0 ? _dashCHF(cout) + ' CHF' : '—',
          semaines.length ? 'somme des semaines validées' : 'aucune semaine validée')}
  ${ligne('Food cost réel', ratio !== null ? ratio.toFixed(1) + ' %' : '—',
          ratio !== null ? `cible ${cibles.food}%` : 'CA ou semaine manquants')}
  ${ligne('Stock valorisé', stock.articles ? _dashCHF(stock.valeur) + ' CHF' : '—',
          stock.articles ? `${stock.articles} article(s), valorisation au CUMP` : 'aucun stock saisi')}
  </tbody></table>
  <div class="foot">PHAR Cost · Rapport généré le ${new Date().toLocaleString('fr-CH')}.
  Les cases « — » signalent une donnée non encore saisie : aucun chiffre n'est estimé.</div>
  <script>window.onload=()=>window.print();<\/script></body></html>`);
  win.document.close();
}

/* ─── Initialisation ────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('#dash-period-segment .segment-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.dashPeriod === _dashPeriod);
    btn.addEventListener('click', () => setDashPeriod(btn.dataset.dashPeriod));
  });
  renderDashboard();
});
