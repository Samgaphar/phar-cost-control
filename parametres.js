/* ============================================================
   PHAR Cost — Paramètres & Éditeur d'articles (MarketMan-style)
   parametres.js
   ============================================================ */

/* ─── Constantes & modèles ───────────────────────────────────── */
const SETTINGS_LS = 'phar_settings_v1';
const USERS_LS    = 'phar_users_v1';

const USER_ROLES = {
  admin:   { label: 'Administrateur', color: '#263B8B' },
  gerant:  { label: 'Gérant',         color: '#2D7A4F' },
  chef:    { label: 'Chef de cuisine', color: '#C68A1A' },
  inventaire: { label: 'Inventariste', color: '#6B5BCC' }
};

let pharSettings  = null;
let pharUsers     = [];
let _activeUserId = 'u1';

/* ─── Données démo ───────────────────────────────────────────── */
const DEFAULT_SETTINGS = {
  entreprise: {
    nom:        'Hôtel Bellerive',
    enseigne:   'Hôtel Bellerive · Vevey',
    adresse:    'Quai de Bellerive 12',
    ville:      'Vevey',
    npa:        '1800',
    pays:       'Suisse',
    tva_number: 'CHE-123.456.789',
    telephone:  '+41 21 944 00 00',
    email:      'info@hotelbellerive.ch',
    devise:     'CHF',
    langue:     'fr',
    target_food_cost: 30,
    target_bev_cost:  20
  },
  alertes: {
    prix_variation_seuil: 10,   // %
    stock_zero:           true,
    email_journalier:     false
  }
};

const DEFAULT_USERS = [
  { id:'u1', nom:'Roduit', prenom:'Marc', role:'admin',
    email:'m.roduit@bellerive.ch', telephone:'+41 79 100 00 01',
    alertes:true, email_journalier:false, actif:true,
    modules:['recettes','achats','inventaire','flash_cost','parametres'],
    created_at: new Date().toISOString() },
  { id:'u2', nom:'Dupont', prenom:'Jean', role:'chef',
    email:'j.dupont@bellerive.ch', telephone:'',
    alertes:false, email_journalier:false, actif:true,
    modules:['recettes','achats','inventaire','flash_cost'],
    created_at: new Date().toISOString() }
];

/* ─── Persistence ────────────────────────────────────────────── */
function loadSettings() {
  try {
    const rs = localStorage.getItem(SETTINGS_LS);
    pharSettings = rs ? { ...DEFAULT_SETTINGS, ...JSON.parse(rs) } : JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  } catch(e) { pharSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS)); }
  try {
    const ru = localStorage.getItem(USERS_LS);
    pharUsers = ru ? JSON.parse(ru) : JSON.parse(JSON.stringify(DEFAULT_USERS));
  } catch(e) { pharUsers = JSON.parse(JSON.stringify(DEFAULT_USERS)); }
}
function saveSettings() {
  try { localStorage.setItem(SETTINGS_LS, JSON.stringify(pharSettings)); } catch(e) {}
}
function saveUsers() {
  try { localStorage.setItem(USERS_LS, JSON.stringify(pharUsers)); } catch(e) {}
}
function getCurrentUser() {
  return pharUsers.find(u => u.id === _activeUserId) || pharUsers[0];
}

/* ─── Module Paramètres — switch tabs ────────────────────────── */
function switchParamTab(tab) {
  document.querySelectorAll('.subtab[data-param-tab]').forEach(b =>
    b.classList.toggle('active', b.dataset.paramTab === tab));
  document.querySelectorAll('.param-tabpane').forEach(p => p.classList.remove('active'));
  const pane = document.getElementById('param-pane-' + tab);
  if (pane) pane.classList.add('active');

  if (tab === 'entreprise')   renderParamEntreprise();
  if (tab === 'utilisateurs') renderParamUsers();
  if (tab === 'mon-compte')   renderParamMonCompte();
}

/* ─── Tab : Entreprise ───────────────────────────────────────── */
function renderParamEntreprise() {
  const el = document.getElementById('param-pane-entreprise');
  if (!el || !pharSettings) return;
  const e = pharSettings.entreprise;
  const a = pharSettings.alertes;
  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;max-width:800px;">

      <div class="card">
        <div class="card-header"><div class="card-title">Établissement</div></div>
        <div class="card-body">
          ${paramField('Nom officiel',    'param-e-nom',     e.nom)}
          ${paramField('Enseigne / Affichage', 'param-e-enseigne', e.enseigne)}
          ${paramField('Adresse',         'param-e-adresse', e.adresse)}
          <div class="form-grid form-grid-2">
            ${paramField('NPA',  'param-e-npa',  e.npa)}
            ${paramField('Ville','param-e-ville', e.ville)}
          </div>
          ${paramField('Pays',            'param-e-pays',    e.pays)}
          ${paramField('N° TVA (IDE)',     'param-e-tva',     e.tva_number, 'CHE-xxx.xxx.xxx')}
          ${paramField('Téléphone',       'param-e-tel',     e.telephone)}
          ${paramField('E-mail',          'param-e-email',   e.email)}
          <div style="margin-top:16px;text-align:right;">
            <button class="btn btn-primary btn-sm" onclick="saveEntreprise()">Enregistrer</button>
          </div>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:16px;">
        <div class="card">
          <div class="card-header"><div class="card-title">Objectifs cost control</div></div>
          <div class="card-body">
            ${paramField('Ratio Food Cost cible (%)', 'param-fc-food', e.target_food_cost, '30', 'number')}
            ${paramField('Ratio Beverage Cost cible (%)', 'param-fc-bev', e.target_bev_cost, '20', 'number')}
            <div style="margin-top:16px;text-align:right;">
              <button class="btn btn-primary btn-sm" onclick="saveCostTargets()">Enregistrer</button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title">Alertes</div></div>
          <div class="card-body">
            ${paramField('Seuil alerte variation prix (%)', 'param-al-seuil', a.prix_variation_seuil, '10', 'number')}
            <div class="form-grid form-grid-2" style="margin-top:12px;">
              <label style="display:flex;align-items:center;gap:10px;font-size:13px;cursor:pointer;">
                <input type="checkbox" ${a.stock_zero?'checked':''} id="param-al-stock"
                       style="width:16px;height:16px;accent-color:var(--phar-navy);">
                Alerte stock zéro
              </label>
              <label style="display:flex;align-items:center;gap:10px;font-size:13px;cursor:pointer;">
                <input type="checkbox" ${a.email_journalier?'checked':''} id="param-al-email"
                       style="width:16px;height:16px;accent-color:var(--phar-navy);">
                E-mail journalier
              </label>
            </div>
            <div style="margin-top:16px;text-align:right;">
              <button class="btn btn-primary btn-sm" onclick="saveAlertes()">Enregistrer</button>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

function paramField(label, id, value, placeholder, type='text') {
  return `<div style="margin-bottom:12px;">
    <label class="field-label">${label}</label>
    <input type="${type}" id="${id}" value="${value||''}" placeholder="${placeholder||''}"
           style="${type==='number'?'max-width:120px;':''}">
  </div>`;
}

function saveEntreprise() {
  if (!pharSettings) return;
  const e = pharSettings.entreprise;
  ['nom','enseigne','adresse','npa','ville','pays','telephone','email'].forEach(f => {
    const el = document.getElementById('param-e-' + f);
    if (el) e[f] = el.value;
  });
  const tvael = document.getElementById('param-e-tva');
  if (tvael) e.tva_number = tvael.value;
  saveSettings();
  // Mettre à jour l'enseigne dans le header client
  if (typeof renderClientHeader === 'function') renderClientHeader();
  if (typeof showToast === 'function') showToast('✓ Paramètres entreprise sauvegardés', 'success');
}

function saveCostTargets() {
  if (!pharSettings) return;
  pharSettings.entreprise.target_food_cost = parseFloat(document.getElementById('param-fc-food')?.value) || 30;
  pharSettings.entreprise.target_bev_cost  = parseFloat(document.getElementById('param-fc-bev')?.value)  || 20;
  saveSettings();
  if (typeof showToast === 'function') showToast('✓ Objectifs sauvegardés', 'success');
}

function saveAlertes() {
  if (!pharSettings) return;
  pharSettings.alertes.prix_variation_seuil = parseFloat(document.getElementById('param-al-seuil')?.value) || 10;
  pharSettings.alertes.stock_zero    = document.getElementById('param-al-stock')?.checked || false;
  pharSettings.alertes.email_journalier = document.getElementById('param-al-email')?.checked || false;
  saveSettings();
  if (typeof showToast === 'function') showToast('✓ Alertes sauvegardées', 'success');
}

/* ─── Tab : Utilisateurs ─────────────────────────────────────── */
function renderParamUsers() {
  const el = document.getElementById('param-pane-utilisateurs');
  if (!el) return;

  const rows = pharUsers.map(u => {
    const roleInfo = USER_ROLES[u.role] || { label: u.role, color: '#9A9A95' };
    return `<tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:32px;height:32px;border-radius:var(--radius);background:${roleInfo.color};
               color:white;display:flex;align-items:center;justify-content:center;
               font-family:'Archivo';font-weight:700;font-size:12px;flex-shrink:0;">
            ${(u.prenom||u.nom||'?')[0].toUpperCase()}
          </div>
          <div>
            <div style="font-weight:600;">${u.prenom} ${u.nom}</div>
            <div style="font-size:11px;color:var(--gray-500);">${u.email||'—'}</div>
          </div>
        </div>
      </td>
      <td>
        <span style="font-size:11px;font-weight:700;color:${roleInfo.color};background:${roleInfo.color}22;
               padding:3px 10px;border-radius:3px;text-transform:uppercase;letter-spacing:.06em;">
          ${roleInfo.label}
        </span>
      </td>
      <td style="text-align:center;">
        ${u.actif
          ? '<span class="badge badge-success">Actif</span>'
          : '<span class="badge" style="background:var(--gray-100);color:var(--gray-500);">Inactif</span>'}
      </td>
      <td style="text-align:center;font-size:11px;">
        ${u.alertes ? '✓' : '—'}
      </td>
      <td style="text-align:center;font-size:11px;">
        ${u.email_journalier ? '✓' : '—'}
      </td>
      <td style="text-align:right;white-space:nowrap;">
        <button class="btn btn-ghost btn-sm" onclick="openUserEditor('${u.id}')">Modifier</button>
        ${pharUsers.length > 1
          ? `<button class="btn btn-ghost btn-sm" style="color:var(--danger);"
                onclick="deleteUser('${u.id}')">✕</button>` : ''}
      </td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <div style="font-size:13px;color:var(--gray-500);">${pharUsers.length} utilisateur(s) configuré(s)</div>
      <button class="btn btn-primary btn-sm" onclick="openUserEditor(null)">+ Ajouter un utilisateur</button>
    </div>
    <div class="card" style="padding:0;">
      <table class="data-table" style="font-size:13px;">
        <thead><tr>
          <th>Utilisateur</th><th>Rôle</th><th style="text-align:center;">Statut</th>
          <th style="text-align:center;">Alertes</th><th style="text-align:center;">E-mail journalier</th>
          <th></th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="alert info" style="margin-top:16px;">
      <div class="alert-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></div>
      <div class="alert-content">
        <div class="alert-title">Rôles disponibles</div>
        <div class="alert-text">
          <strong>Administrateur</strong> — accès complet + gestion utilisateurs ·
          <strong>Gérant</strong> — tous modules sauf paramètres ·
          <strong>Chef de cuisine</strong> — recettes, achats, inventaire, flash cost ·
          <strong>Inventariste</strong> — inventaire uniquement
        </div>
      </div>
    </div>`;
}

function openUserEditor(userId) {
  const u = userId ? pharUsers.find(x => x.id === userId) : null;
  const modal = document.getElementById('user-editor-modal');
  if (!modal) return;

  document.getElementById('ue-title').textContent = u ? 'Modifier l\'utilisateur' : 'Ajouter un utilisateur';
  document.getElementById('ue-id').value         = u?.id || '';
  document.getElementById('ue-prenom').value     = u?.prenom || '';
  document.getElementById('ue-nom').value        = u?.nom || '';
  document.getElementById('ue-email').value      = u?.email || '';
  document.getElementById('ue-telephone').value  = u?.telephone || '';
  document.getElementById('ue-role').value       = u?.role || 'chef';
  document.getElementById('ue-alertes').checked  = u?.alertes || false;
  document.getElementById('ue-email-jour').checked = u?.email_journalier || false;
  document.getElementById('ue-actif').checked    = u?.actif !== false;

  modal.classList.add('visible');
}

function saveUserEditor() {
  const id      = document.getElementById('ue-id').value;
  const prenom  = document.getElementById('ue-prenom').value.trim();
  const nom     = document.getElementById('ue-nom').value.trim();
  if (!prenom && !nom) {
    if (typeof showToast === 'function') showToast('Le nom est requis.', 'error');
    return;
  }
  const userData = {
    id:             id || 'u_' + Math.random().toString(36).slice(2,10),
    prenom,
    nom,
    email:          document.getElementById('ue-email').value.trim(),
    telephone:      document.getElementById('ue-telephone').value.trim(),
    role:           document.getElementById('ue-role').value,
    alertes:        document.getElementById('ue-alertes').checked,
    email_journalier: document.getElementById('ue-email-jour').checked,
    actif:          document.getElementById('ue-actif').checked,
    created_at:     id ? (pharUsers.find(u=>u.id===id)?.created_at || new Date().toISOString()) : new Date().toISOString()
  };
  if (id) {
    const idx = pharUsers.findIndex(u => u.id === id);
    if (idx >= 0) pharUsers[idx] = userData; else pharUsers.push(userData);
  } else {
    pharUsers.push(userData);
  }
  saveUsers();
  document.getElementById('user-editor-modal').classList.remove('visible');
  renderParamUsers();
  if (typeof showToast === 'function')
    showToast(`✓ Utilisateur ${prenom} ${nom} ${id?'modifié':'créé'}`, 'success');
}

function deleteUser(userId) {
  const u = pharUsers.find(x => x.id === userId);
  if (!confirm(`Supprimer l'utilisateur "${u?.prenom} ${u?.nom}" ?`)) return;
  pharUsers = pharUsers.filter(x => x.id !== userId);
  saveUsers();
  renderParamUsers();
  if (typeof showToast === 'function') showToast('Utilisateur supprimé.', '');
}

/* ─── Tab : Mon compte ───────────────────────────────────────── */
function renderParamMonCompte() {
  const el = document.getElementById('param-pane-mon-compte');
  if (!el) return;
  const u = getCurrentUser();
  if (!u) { el.innerHTML = '<div style="padding:32px;color:var(--gray-400);">Aucun utilisateur configuré.</div>'; return; }

  const roleInfo = USER_ROLES[u.role] || { label: u.role, color: '#9A9A95' };
  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;max-width:800px;">
      <div class="card">
        <div class="card-header"><div class="card-title">Détails utilisateur</div></div>
        <div class="card-body">
          <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;">
            <div style="width:56px;height:56px;border-radius:var(--radius-lg);background:${roleInfo.color};
                 color:white;display:flex;align-items:center;justify-content:center;
                 font-family:'Archivo';font-weight:800;font-size:20px;flex-shrink:0;">
              ${(u.prenom||u.nom||'?')[0].toUpperCase()}
            </div>
            <div>
              <div style="font-family:'Archivo';font-weight:700;font-size:18px;">${u.prenom} ${u.nom}</div>
              <span style="font-size:11px;font-weight:700;color:${roleInfo.color};background:${roleInfo.color}22;padding:2px 8px;border-radius:3px;">${roleInfo.label}</span>
            </div>
          </div>
          ${paramField('Prénom',    'mc-prenom',    u.prenom)}
          ${paramField('Nom',       'mc-nom',       u.nom)}
          ${paramField('E-mail',    'mc-email',     u.email)}
          ${paramField('Téléphone', 'mc-telephone', u.telephone)}
          <div style="margin-top:16px;text-align:right;">
            <button class="btn btn-primary btn-sm" onclick="saveMonCompte()">Enregistrer</button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">Alertes &amp; notifications</div></div>
        <div class="card-body">
          <div style="display:flex;flex-direction:column;gap:16px;">
            <label style="display:flex;align-items:flex-start;gap:12px;cursor:pointer;">
              <input type="checkbox" id="mc-alertes" ${u.alertes?'checked':''}
                     style="width:16px;height:16px;margin-top:2px;accent-color:var(--phar-navy);">
              <div>
                <div style="font-size:13px;font-weight:600;">Alertes en temps réel</div>
                <div style="font-size:11px;color:var(--gray-500);">Variations de prix, stock zéro, ratios dépassés</div>
              </div>
            </label>
            <label style="display:flex;align-items:flex-start;gap:12px;cursor:pointer;">
              <input type="checkbox" id="mc-email-jour" ${u.email_journalier?'checked':''}
                     style="width:16px;height:16px;margin-top:2px;accent-color:var(--phar-navy);">
              <div>
                <div style="font-size:13px;font-weight:600;">E-mail journalier</div>
                <div style="font-size:11px;color:var(--gray-500);">Résumé quotidien : achats, flash cost, alertes</div>
              </div>
            </label>
            <div style="height:1px;background:var(--gray-200);"></div>
            <div>
              <label class="field-label">Clé Claude API personnelle</label>
              <input type="password" id="mc-claude-key"
                     value="${(typeof getActiveClient === 'function' ? getActiveClient()?.claude_api_key : '') || ''}"
                     placeholder="sk-ant-api03-…" style="font-size:12px;">
              <div style="font-size:11px;color:var(--gray-500);margin-top:4px;">
                Utilisée pour le scan BL et le matching SKU.
              </div>
            </div>
            <div style="text-align:right;">
              <button class="btn btn-primary btn-sm" onclick="saveMonCompte()">Enregistrer</button>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

function saveMonCompte() {
  const u = getCurrentUser();
  if (!u) return;
  u.prenom         = document.getElementById('mc-prenom')?.value.trim() || u.prenom;
  u.nom            = document.getElementById('mc-nom')?.value.trim() || u.nom;
  u.email          = document.getElementById('mc-email')?.value.trim() || '';
  u.telephone      = document.getElementById('mc-telephone')?.value.trim() || '';
  u.alertes        = document.getElementById('mc-alertes')?.checked || false;
  u.email_journalier = document.getElementById('mc-email-jour')?.checked || false;
  saveUsers();
  // Sync clé Claude
  const keyVal = document.getElementById('mc-claude-key')?.value?.trim();
  if (keyVal && typeof updateClientField === 'function' && typeof getActiveClient === 'function') {
    updateClientField(getActiveClient()?.id, 'claude_api_key', keyVal);
  }
  if (typeof showToast === 'function') showToast('✓ Profil mis à jour', 'success');
}

/* ═══════════════════════════════════════════════════════════════
   ÉDITEUR D'ARTICLES — style MarketMan
   ═══════════════════════════════════════════════════════════════ */
let _aeArticle  = null;   // article en cours d'édition (référence directe)
let _aeMerc     = null;   // 'food' | 'bev'
let _aeIsNew    = false;  // true = création
let _aeOptsAchat = [];    // options d'achat en cours d'édition

function openArticleEditor(articleNom, merc, isNew = false) {
  _aeMerc   = merc || 'food';
  _aeIsNew  = isNew;

  if (isNew) {
    _aeArticle = {
      article: articleNom || 'Nouvel article',
      categorie: 'Autres', fournisseur: '', unite: 'kg',
      pu: 0, cump: 0, prix_reference: 0, historique_prix: [],
      lightspeed_sku: null, mois_m1: 0,
      pos: Object.fromEntries(
        (typeof POS_DEFINITIONS !== 'undefined' ? POS_DEFINITIONS[_aeMerc] : []).map(p => [p, 0])
      ),
      options_achat: []
    };
  } else {
    const store = typeof pharStores !== 'undefined' ? pharStores[merc] : [];
    _aeArticle  = store.find(a => a.article === articleNom);
    if (!_aeArticle) return;
  }

  // Initialiser options_achat si absent
  if (!Array.isArray(_aeArticle.options_achat)) {
    _aeArticle.options_achat = _aeArticle.fournisseur ? [{
      id: 'oa_' + Math.random().toString(36).slice(2,8),
      nom_produit:      _aeArticle.article,
      fournisseur:      _aeArticle.fournisseur || '',
      code_produit:     _aeArticle.lightspeed_sku || '',
      unite_commande:   _aeArticle.unite || 'kg',
      prix:             _aeArticle.pu || 0,
      variation_prix:   0,
      est_commande:     true,
      est_principal:    true,
      est_local:        false
    }] : [];
  }
  _aeOptsAchat = JSON.parse(JSON.stringify(_aeArticle.options_achat));

  _aeRender();
  document.getElementById('article-editor-panel')?.classList.add('visible');
}

function closeArticleEditor() {
  document.getElementById('article-editor-panel')?.classList.remove('visible');
}

function _aeRender() {
  const panel = document.getElementById('article-editor-panel');
  if (!panel || !_aeArticle) return;

  const cat = _aeArticle._ac_cat || _aeArticle.categorie || (typeof fcAutoCategory === 'function' ? fcAutoCategory(_aeArticle.article) : 'Autres');
  const catOpts = (typeof getAllCategories === 'function' ? getAllCategories() : FC_CATEGORIES || ['Autres']).map(c =>
    `<option value="${c}" ${c===cat?'selected':''}>${c}</option>`).join('');

  document.getElementById('ae-name-display').textContent  = _aeArticle.article || 'Nouvel article';
  document.getElementById('ae-name-input').value          = _aeArticle.article || '';
  document.getElementById('ae-categorie').innerHTML       = catOpts;

  _aeRenderOptionsTable();
}

function _aeRenderOptionsTable() {
  const tbody = document.getElementById('ae-opts-tbody');
  if (!tbody) return;

  if (!_aeOptsAchat.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:24px 16px;color:var(--gray-400);font-size:13px;">
      Aucune option d'achat — cliquez sur « + Ajouter une nouvelle option » ci-dessous.</td></tr>`;
    return;
  }

  tbody.innerHTML = _aeOptsAchat.map((o, idx) => `
    <tr style="background:${o.est_principal?'var(--phar-navy-faint)':'var(--white)'};">
      <td style="padding:6px 8px;">
        <input type="text" value="${(o.nom_produit||'').replace(/"/g,'&quot;')}"
               placeholder="Nom chez le fournisseur"
               style="min-width:160px;font-size:12px;"
               onchange="_aeOpts[${idx}]&&(_aeOpts[${idx}].nom_produit=this.value)||(_aeOptsAchat[${idx}].nom_produit=this.value)">
      </td>
      <td style="padding:6px 8px;">
        <input type="text" value="${(o.fournisseur||'').replace(/"/g,'&quot;')}"
               placeholder="Fournisseur" style="min-width:120px;font-size:12px;"
               onchange="_aeOptsAchat[${idx}].fournisseur=this.value">
      </td>
      <td style="padding:6px 8px;">
        <input type="text" value="${(o.code_produit||'').replace(/"/g,'&quot;')}"
               placeholder="SKU / Code" style="width:90px;font-size:12px;font-family:monospace;"
               onchange="_aeOptsAchat[${idx}].code_produit=this.value">
      </td>
      <td style="padding:6px 8px;">
        <input type="text" value="${o.unite_commande||'kg'}"
               style="width:60px;font-size:12px;text-align:center;"
               onchange="_aeOptsAchat[${idx}].unite_commande=this.value">
      </td>
      <td style="padding:6px 8px;">
        <input type="number" value="${o.prix||0}" step="0.01" min="0"
               style="width:80px;font-size:12px;text-align:right;font-weight:600;"
               onchange="_aeOptsAchat[${idx}].prix=parseFloat(this.value)||0;_aeUpdateVariation(${idx})">
      </td>
      <td style="padding:6px 8px;text-align:center;">
        <span style="font-size:12px;font-weight:700;color:${o.variation_prix>0?'var(--danger)':o.variation_prix<0?'var(--success)':'var(--gray-400)'};">
          ${o.variation_prix!==0?(o.variation_prix>0?'↑+':'↓')+Math.abs(o.variation_prix).toFixed(1)+'%':'—'}
        </span>
      </td>
      <td style="text-align:center;padding:6px 4px;">
        <input type="checkbox" class="bl-check" title="Utiliser pour commandes"
               ${o.est_commande?'checked':''}
               onchange="_aeOptsAchat[${idx}].est_commande=this.checked">
      </td>
      <td style="text-align:center;padding:6px 4px;">
        <input type="checkbox" class="bl-check" title="Fournisseur principal"
               ${o.est_principal?'checked':''}
               onchange="_aeSetPrincipal(${idx},this.checked)">
      </td>
      <td style="text-align:center;padding:6px 4px;">
        <input type="checkbox" class="bl-check" title="Produit local"
               ${o.est_local?'checked':''}
               onchange="_aeOptsAchat[${idx}].est_local=this.checked">
      </td>
      <td style="text-align:center;padding:6px 4px;">
        <button class="btn-remove" onclick="_aeRemoveOpt(${idx})" title="Supprimer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </td>
    </tr>`).join('');
}

function _aeUpdateVariation(idx) {
  const o = _aeOptsAchat[idx];
  if (!o) return;
  const ref = _aeArticle.pu || o.prix;
  o.variation_prix = ref > 0 ? ((o.prix - ref) / ref * 100) : 0;
  _aeRenderOptionsTable();
}

function _aeSetPrincipal(idx, checked) {
  if (checked) {
    // Un seul principal à la fois
    _aeOptsAchat.forEach((o, i) => { o.est_principal = (i === idx); });
  } else {
    _aeOptsAchat[idx].est_principal = false;
  }
  _aeRenderOptionsTable();
}

function _aeRemoveOpt(idx) {
  _aeOptsAchat.splice(idx, 1);
  _aeRenderOptionsTable();
}

function aeAddOption() {
  _aeOptsAchat.push({
    id:              'oa_' + Math.random().toString(36).slice(2,8),
    nom_produit:     _aeArticle.article || '',
    fournisseur:     '',
    code_produit:    '',
    unite_commande:  _aeArticle.unite || 'kg',
    prix:            _aeArticle.pu || 0,
    variation_prix:  0,
    est_commande:    !_aeOptsAchat.some(o => o.est_commande),
    est_principal:   !_aeOptsAchat.some(o => o.est_principal),
    est_local:       false
  });
  _aeRenderOptionsTable();
  // Focus le dernier nom
  setTimeout(() => {
    const inputs = document.querySelectorAll('#ae-opts-tbody input[type="text"]');
    if (inputs.length) inputs[inputs.length - 4]?.focus(); // nom de produit
  }, 50);
}

/** Importer les options d'achat depuis les BL scannés correspondant à cet article */
function aeImportFromBL() {
  if (!_aeArticle || typeof pharBLs === 'undefined') return;
  const nomNorm = (typeof fcNorm === 'function' ? fcNorm : s=>s.toLowerCase())(_aeArticle.article);
  let found = 0;

  pharBLs.forEach(bl => {
    (bl.articles || []).forEach(line => {
      const lineNorm = (typeof fcNorm === 'function' ? fcNorm : s=>s.toLowerCase())(line.designation || '');
      const isMatch  = lineNorm === nomNorm
        || (nomNorm.length >= 4 && (lineNorm.includes(nomNorm) || nomNorm.includes(lineNorm)));
      if (!isMatch) return;

      const pu = parseFloat(line.prix_unitaire_ht) || 0;
      const existing = _aeOptsAchat.find(o =>
        (o.fournisseur||'').toLowerCase() === (bl.fournisseur||'').toLowerCase()
      );
      if (existing) {
        // Mettre à jour le prix si changé
        if (existing.prix !== pu && pu > 0) {
          existing.variation_prix = existing.prix > 0 ? ((pu - existing.prix)/existing.prix*100) : 0;
          existing.prix = pu;
          found++;
        }
      } else if (pu > 0) {
        _aeOptsAchat.push({
          id:             'oa_bl_' + bl.id.slice(-6),
          nom_produit:    line.designation,
          fournisseur:    bl.fournisseur || '',
          code_produit:   line.ref || '',
          unite_commande: line.unite || _aeArticle.unite || 'kg',
          prix:           pu,
          variation_prix: _aeArticle.pu > 0 ? ((pu - _aeArticle.pu)/_aeArticle.pu*100) : 0,
          est_commande:   false,
          est_principal:  false,
          est_local:      false
        });
        found++;
      }
    });
  });

  _aeRenderOptionsTable();
  if (typeof showToast === 'function')
    showToast(found > 0 ? `✓ ${found} option(s) importée(s) depuis les BL` : 'Aucun BL correspondant trouvé.', found > 0 ? 'success' : '');
}

/** Importer les options depuis un Excel (colonnes: nom produit, fournisseur, code, unité, prix) */
function aeImportFromExcel() {
  const input = document.createElement('input');
  input.type  = 'file';
  input.accept = '.xlsx,.xls,.csv';
  input.onchange = (e) => {
    const file = e.target.files?.[0];
    if (!file || typeof XLSX === 'undefined') return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb   = XLSX.read(ev.target.result, { type:'array' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
        if (rows.length < 2) return;
        const hdr = rows[0].map(c => String(c).toLowerCase());
        const ci  = {
          nom:  hdr.findIndex(h => h.includes('nom') || h.includes('produit') || h.includes('designation')),
          four: hdr.findIndex(h => h.includes('fournisseur') || h.includes('supplier')),
          code: hdr.findIndex(h => h.includes('code') || h.includes('sku') || h.includes('ref')),
          unit: hdr.findIndex(h => h.includes('unit') || h.includes('mesure')),
          prix: hdr.findIndex(h => h.includes('prix') || h.includes('price') || h.includes('tarif'))
        };
        let added = 0;
        rows.slice(1).forEach(row => {
          const nom  = String(row[ci.nom  > -1 ? ci.nom  : 0] || '').trim();
          const prix = parseFloat(row[ci.prix > -1 ? ci.prix : 4]) || 0;
          if (!nom) return;
          _aeOptsAchat.push({
            id:             'oa_xl_' + Math.random().toString(36).slice(2,7),
            nom_produit:    nom,
            fournisseur:    ci.four > -1 ? String(row[ci.four]||'').trim() : '',
            code_produit:   ci.code > -1 ? String(row[ci.code]||'').trim() : '',
            unite_commande: ci.unit > -1 ? String(row[ci.unit]||'').trim() : (_aeArticle.unite||'kg'),
            prix,
            variation_prix: _aeArticle.pu > 0 && prix > 0 ? ((prix - _aeArticle.pu)/_aeArticle.pu*100) : 0,
            est_commande:   false,
            est_principal:  !_aeOptsAchat.some(o => o.est_principal),
            est_local:      false
          });
          added++;
        });
        _aeRenderOptionsTable();
        if (typeof showToast === 'function')
          showToast(`✓ ${added} option(s) importée(s) depuis ${file.name}`, 'success');
      } catch(err) {
        if (typeof showToast === 'function') showToast('Erreur : ' + err.message, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  };
  input.click();
}

/** Sauvegarder l'article édité */
function saveArticleEditor() {
  if (!_aeArticle) return;
  const nameEl = document.getElementById('ae-name-input');
  const catEl  = document.getElementById('ae-categorie');
  if (nameEl) _aeArticle.article  = nameEl.value.trim() || _aeArticle.article;
  if (catEl)  _aeArticle._ac_cat  = catEl.value;
  _aeArticle.options_achat = _aeOptsAchat;

  // Synchroniser fournisseur + pu avec l'option principale
  const principal = _aeOptsAchat.find(o => o.est_principal) || _aeOptsAchat[0];
  if (principal) {
    _aeArticle.fournisseur = principal.fournisseur || _aeArticle.fournisseur;
    if (principal.prix > 0) _aeArticle.pu = principal.prix;
    if (principal.code_produit) _aeArticle.lightspeed_sku = principal.code_produit;
    _aeArticle.unite = principal.unite_commande || _aeArticle.unite;
  }

  if (_aeIsNew && typeof pharStores !== 'undefined') {
    if (!_aeArticle.groupe) _aeArticle.groupe = _aeMerc === 'food' ? 'Food' : 'Minérales';
    if (!_aeArticle.cump)   _aeArticle.cump   = _aeArticle.pu;
    if (!_aeArticle.prix_reference) _aeArticle.prix_reference = _aeArticle.pu;
    pharStores[_aeMerc].push(_aeArticle);
  }

  if (typeof saveStores === 'function') saveStores();
  closeArticleEditor();

  // Mettre à jour le nom dans le header si on était en édition inline
  if (typeof acRenderArticles === 'function') acRenderArticles();
  if (typeof showToast === 'function')
    showToast(`✓ Article "${_aeArticle.article}" sauvegardé`, 'success');
}

/** Édite le nom directement dans le panel */
function aeToggleNameEdit() {
  const disp  = document.getElementById('ae-name-display');
  const input = document.getElementById('ae-name-input');
  if (!disp || !input) return;
  const editing = input.style.display !== 'none';
  if (editing) {
    _aeArticle.article = input.value.trim() || _aeArticle.article;
    disp.textContent   = _aeArticle.article;
    disp.style.display = 'block';
    input.style.display = 'none';
  } else {
    disp.style.display  = 'none';
    input.style.display = 'block';
    input.focus(); input.select();
  }
}

/* ─── Injection des modaux et du panel ───────────────────────── */
function injectParamModals() {
  // ── Modal éditeur utilisateur ──────────────────────────────
  const roleOptions = Object.entries(USER_ROLES).map(([v,r]) =>
    `<option value="${v}">${r.label}</option>`).join('');

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <!-- Modal : Éditeur utilisateur -->
    <div class="modal-backdrop" id="user-editor-modal">
      <div class="modal" style="max-width:500px;">
        <div class="modal-header">
          <div class="modal-title" id="ue-title">Utilisateur</div>
          <button class="modal-close" onclick="document.getElementById('user-editor-modal').classList.remove('visible')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <input type="hidden" id="ue-id">
          <div class="form-grid form-grid-2">
            ${paramField('Prénom','ue-prenom','')}
            ${paramField('Nom',   'ue-nom',   '')}
          </div>
          ${paramField('E-mail',    'ue-email',    '')}
          ${paramField('Téléphone', 'ue-telephone', '')}
          <div style="margin-bottom:12px;">
            <label class="field-label">Rôle</label>
            <select id="ue-role">${roleOptions}</select>
          </div>
          <div class="form-grid form-grid-2" style="margin-top:12px;">
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">
              <input type="checkbox" id="ue-alertes" style="accent-color:var(--phar-navy);">
              Alertes activées
            </label>
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">
              <input type="checkbox" id="ue-email-jour" style="accent-color:var(--phar-navy);">
              E-mail journalier
            </label>
          </div>
          <div style="margin-top:12px;">
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">
              <input type="checkbox" id="ue-actif" checked style="accent-color:var(--phar-navy);">
              Compte actif
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onclick="document.getElementById('user-editor-modal').classList.remove('visible')">Annuler</button>
          <button class="btn btn-primary" onclick="saveUserEditor()">Enregistrer</button>
        </div>
      </div>
    </div>

    <!-- Panel plein-écran : Éditeur d'article (MarketMan-style) -->
    <div id="article-editor-panel" style="
      position:fixed;inset:0;z-index:400;
      background:var(--white);overflow-y:auto;
      transform:translateX(100%);transition:transform .25s ease;
      display:flex;flex-direction:column;">

      <!-- Header du panel -->
      <div style="
        border-bottom:1px solid var(--gray-200);
        padding:18px 32px;
        display:flex;align-items:center;justify-content:space-between;
        background:var(--white);position:sticky;top:0;z-index:10;">
        <div style="flex:1;">
          <div style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--gray-400);margin-bottom:6px;">
            Article d'inventaire
          </div>
          <!-- Nom article éditable -->
          <div style="display:flex;align-items:center;gap:10px;">
            <h2 id="ae-name-display" style="font-family:'Archivo';font-weight:700;font-size:22px;color:var(--phar-navy);margin:0;cursor:pointer;" onclick="aeToggleNameEdit()">—</h2>
            <input type="text" id="ae-name-input"
                   style="display:none;font-family:'Archivo';font-weight:700;font-size:22px;color:var(--phar-navy);border:none;border-bottom:2px solid var(--phar-navy);outline:none;background:transparent;padding-bottom:2px;min-width:300px;"
                   onblur="aeToggleNameEdit()" onkeydown="if(event.key==='Enter')aeToggleNameEdit()">
            <button onclick="aeToggleNameEdit()" title="Modifier le nom" style="background:none;border:none;cursor:pointer;color:var(--phar-navy);opacity:.6;padding:2px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;">
          <button class="btn btn-primary" onclick="saveArticleEditor()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>
            Sauvegarder
          </button>
          <button onclick="closeArticleEditor()" style="
            background:none;border:1px solid var(--gray-300);border-radius:var(--radius);
            width:36px;height:36px;display:flex;align-items:center;justify-content:center;
            cursor:pointer;color:var(--gray-500);transition:all .15s;"
            onmouseover="this.style.background='var(--gray-100)'"
            onmouseout="this.style.background='none'">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>

      <!-- Corps du panel -->
      <div style="padding:28px 32px;flex:1;">

        <!-- Catégorie + mercuriale -->
        <div style="display:flex;align-items:flex-end;gap:20px;margin-bottom:28px;">
          <div style="min-width:260px;">
            <label class="field-label">Catégorie d'articles en stock *</label>
            <select id="ae-categorie" style="font-size:13px;"></select>
            <div style="font-size:11px;color:var(--gray-400);margin-top:4px;">Par exemple : viande, vin, épicerie…</div>
          </div>
          <div>
            <label class="field-label">Mercuriale</label>
            <select id="ae-merc" style="width:140px;" onchange="_aeMerc=this.value">
              <option value="food">Food</option>
              <option value="bev">Boissons</option>
            </select>
          </div>
          <div>
            <label class="field-label">Unité de base</label>
            <input type="text" id="ae-unite" style="width:80px;" placeholder="kg"
                   onchange="_aeArticle&&(_aeArticle.unite=this.value)">
          </div>
        </div>

        <!-- Tabs -->
        <div style="border-bottom:2px solid var(--gray-200);margin-bottom:24px;display:flex;gap:0;">
          <div style="padding:10px 20px;font-weight:700;font-size:13px;letter-spacing:.06em;text-transform:uppercase;
               border-bottom:3px solid var(--phar-navy);margin-bottom:-2px;color:var(--phar-navy);cursor:default;">
            Achats et Inventaire
          </div>
        </div>

        <!-- Options d'achat -->
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
            <div style="font-family:'Archivo';font-weight:700;font-size:15px;">Options d'achat</div>
            <div style="display:flex;gap:8px;">
              <button class="btn btn-ghost btn-sm" onclick="aeImportFromBL()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width:13px;height:13px;stroke-width:2;"><path d="M3 4v16a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V4"/><path d="M9 21V9M15 21V9M3 9h18"/></svg>
                Depuis BL scannés
              </button>
              <button class="btn btn-ghost btn-sm" onclick="aeImportFromExcel()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width:13px;height:13px;stroke-width:2;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                Importer Excel
              </button>
            </div>
          </div>

          <div style="border:1px solid var(--gray-200);border-radius:var(--radius-lg);overflow:hidden;">
            <div style="overflow-x:auto;">
              <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:900px;">
                <thead>
                  <tr style="background:var(--phar-navy);">
                    <th style="padding:10px 8px;text-align:left;color:white;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;min-width:180px;">Nom de produit</th>
                    <th style="padding:10px 8px;text-align:left;color:white;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;min-width:130px;">Fournisseur</th>
                    <th style="padding:10px 8px;text-align:left;color:white;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;">Code produit</th>
                    <th style="padding:10px 8px;text-align:left;color:white;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;">Unité</th>
                    <th style="padding:10px 8px;text-align:right;color:white;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;">Prix</th>
                    <th style="padding:10px 8px;text-align:center;color:white;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;">Variation</th>
                    <th style="padding:10px 8px;text-align:center;color:white;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;" title="Option de commande par défaut">Commande</th>
                    <th style="padding:10px 8px;text-align:center;color:white;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;" title="Fournisseur principal">Principal</th>
                    <th style="padding:10px 8px;text-align:center;color:white;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;" title="Produit local / régional">Local</th>
                    <th style="width:32px;"></th>
                  </tr>
                </thead>
                <tbody id="ae-opts-tbody"></tbody>
              </table>
            </div>
            <!-- Ligne + Ajouter -->
            <div onclick="aeAddOption()" style="
              padding:12px 16px;cursor:pointer;display:flex;align-items:center;gap:8px;
              color:var(--phar-navy);font-weight:600;font-size:13px;border-top:1px solid var(--gray-200);
              background:var(--gray-50);transition:background .12s;"
              onmouseover="this.style.background='var(--phar-navy-faint)'"
              onmouseout="this.style.background='var(--gray-50)'">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
              Ajouter une nouvelle option d'achat
            </div>
          </div>

          <div style="margin-top:12px;font-size:11px;color:var(--gray-400);">
            <strong>Commande</strong> — option sélectionnée lors d'une commande ·
            <strong>Principal</strong> — fournisseur habituel (définit le prix de référence) ·
            <strong>Local</strong> — produit régional / circuit court
          </div>
        </div>

      </div>
    </div>`;

  document.body.appendChild(wrap);

  // CSS pour l'animation du panel
  const style = document.createElement('style');
  style.textContent = `
    #article-editor-panel.visible { transform: translateX(0) !important; }
    #article-editor-panel input[type="checkbox"].bl-check {
      width:16px;height:16px;accent-color:var(--phar-navy);cursor:pointer;
    }
  `;
  document.head.appendChild(style);

  // Fermeture ESC
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const p = document.getElementById('article-editor-panel');
      if (p?.classList.contains('visible')) closeArticleEditor();
    }
  });

  // Backdrop click pour modal user
  document.getElementById('user-editor-modal')?.addEventListener('click', e => {
    if (e.target.id === 'user-editor-modal') e.target.classList.remove('visible');
  });
}

/* ─── Override acNewArticle ──────────────────────────────────── */
// Remplace le prompt() par le vrai éditeur
window.acNewArticle = function() {
  const merc = document.getElementById('ac-filter-merc')?.value;
  openArticleEditor('', merc === 'bev' ? 'bev' : 'food', true);
  // Pré-remplir unité
  setTimeout(() => {
    const uniteEl = document.getElementById('ae-unite');
    if (uniteEl) uniteEl.value = 'kg';
    const mercEl = document.getElementById('ae-merc');
    if (mercEl) mercEl.value = merc === 'bev' ? 'bev' : 'food';
  }, 50);
};

/* ═══════════════════════════════════════════════════════════════
   IMPORTEUR D'ARTICLES — compatible exports de logiciels de stock
   Détecte automatiquement les colonnes, codes catégorie, TVA
   ═══════════════════════════════════════════════════════════════ */

/* ─── Mapping codes catégorie → FC_CATEGORIES ────────────────── */
// Basé sur les codes standards rencontrés dans les exports F&B hôteliers
const CAT_CODE_MAP = {
  // Vins
  '201':'Vins','202':'Vins','203':'Vins','204':'Vins','205':'Vins',
  '206':'Champagnes & Mousseux','207':'Champagnes & Mousseux','208':'Champagnes & Mousseux',
  // Spiritueux & eaux-de-vie
  '250':'Spiritueux','251':'Spiritueux','252':'Spiritueux','253':'Spiritueux',
  '2500':'Spiritueux','2506':'Spiritueux','2507':'Spiritueux','2508':'Spiritueux',
  // Bières
  '260':'Bières','261':'Bières','262':'Bières','2600':'Bières','2601':'Bières',
  // Boissons sans alcool / minérales
  '270':'Boissons sans alcool','271':'Boissons sans alcool','272':'Boissons sans alcool',
  '2700':'Boissons sans alcool','2701':'Boissons sans alcool',
  // Café & Thé
  '190':'Café & Thé','191':'Café & Thé','1900':'Café & Thé','1901':'Café & Thé',
  // Viande
  '410':'Viande','411':'Viande','412':'Viande','413':'Viande','4100':'Viande','4101':'Viande','4102':'Viande',
  // Poisson
  '420':'Poisson & Fruits de mer','421':'Poisson & Fruits de mer','4200':'Poisson & Fruits de mer',
  // Légumes & Fruits
  '130':'Légumes & Fruits','131':'Légumes & Fruits','132':'Légumes & Fruits',
  '1300':'Légumes & Fruits','1301':'Légumes & Fruits','1302':'Légumes & Fruits',
  '140':'Légumes & Fruits','141':'Légumes & Fruits','142':'Légumes & Fruits',
  '1400':'Légumes & Fruits','1401':'Légumes & Fruits','1402':'Légumes & Fruits',
  // Laitier & BOF
  '150':'Laitier & BOF','151':'Laitier & BOF','152':'Laitier & BOF',
  '1500':'Laitier & BOF','1501':'Laitier & BOF','1502':'Laitier & BOF',
  // Boulangerie & Pâtisserie
  '160':'Boulangerie & Pâtisserie','161':'Boulangerie & Pâtisserie',
  '1600':'Boulangerie & Pâtisserie','1601':'Boulangerie & Pâtisserie','1602':'Boulangerie & Pâtisserie',
  // Épicerie sèche / Economat
  '169':'Épicerie sèche','170':'Épicerie sèche','1699':'Épicerie sèche',
  '1700':'Épicerie sèche','1701':'Épicerie sèche','1702':'Épicerie sèche',
  // Condiments & Sauces
  '175':'Condiments & Sauces','1750':'Condiments & Sauces',
  // Nettoyage & Entretien
  '430':'Nettoyage','4300':'Nettoyage','4301':'Nettoyage',
  // Autres
  '999':'Autres','9999':'Autres'
};

/* Mapping clés colonnes → champs internes (ordre de priorité) */
const COL_DETECT = {
  article:       ['nom','article','libellé','libelle','désignation','designation','name','produit','description','référence'],
  fournisseur:   ['fournisseur','supplier','vendeur','vendor','fournisseur principal'],
  categorie:     ['catégorie','categorie','category','famille','group','groupe','type','rayon','department'],
  prix:          ['prix par udm','prix/udm','prix unitaire','pu ht','prix ht','prix','price','tarif','coût unitaire','cout'],
  unite:         ['unité','unite','uom','um','udm','unit de mesure','unité de mesure'],
  min_stock:     ['min stock','stock min','minimum','min','niveau mini','reorder'],
  stock_optimal: ['niveau optimal','optimal','stock max','stock cible','niveau max'],
  stock_actuel:  ['en stock','stock actuel','stock','quantité','qte','qty','quantity','inventaire actuel','dernier inventaire'],
  tva:           ["taux d'impos","taux d'imposition",'tva','vat','tax rate','taux tvà','tax','impôt'],
  statut:        ['commande','statut','status','actif','active','state']
};

/* Parse un taux TVA depuis différents formats */
function _parseTVA(val) {
  if (val === null || val === undefined || val === '') return null;
  const s = String(val).toLowerCase().replace(',','.');
  if (s.includes('8.1') || s.includes('8,1')) return 8.1;
  if (s.includes('7.7') || s.includes('7,7')) return 7.7; // ancien taux CH
  if (s.includes('3.8') || s.includes('3,8')) return 3.8;
  if (s.includes('2.6') || s.includes('2,6')) return 2.6;
  if (s === '0' || s.includes('0%') || s.includes('0 vat') || s.includes('exonéré')) return 0;
  const n = parseFloat(s.replace(/[^\d.]/g,''));
  if (!isNaN(n) && n <= 100) return n;
  return null;
}

/* Parse un code catégorie "205 - Vin Rouge" → FC_CATEGORIES */
function _parseCatCode(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  // Tenter de trouver le code numérique en début de chaîne
  const mCode = s.match(/^(\d+)\s*[-–·]/);
  if (mCode) {
    const code = mCode[1];
    // Chercher code exact puis préfixe progressif
    if (CAT_CODE_MAP[code]) return CAT_CODE_MAP[code];
    // Essayer les 3, 2 premiers chiffres
    if (code.length > 3 && CAT_CODE_MAP[code.slice(0,3)]) return CAT_CODE_MAP[code.slice(0,3)];
    if (code.length > 2 && CAT_CODE_MAP[code.slice(0,2)]) return CAT_CODE_MAP[code.slice(0,2)];
  }
  // Sinon utiliser le texte après le tiret
  const mText = s.match(/[-–·]\s*(.+)$/);
  const text  = mText ? mText[1].trim() : s;
  if (typeof fcAutoCategory === 'function') return fcAutoCategory(text);
  return null;
}

/* Détecter si un article est boisson (→ mercuriale bev) */
function _detectMerc(article, categorie) {
  const bevCats = new Set(['Vins','Champagnes & Mousseux','Spiritueux','Bières','Boissons sans alcool','Café & Thé']);
  if (bevCats.has(categorie)) return 'bev';
  const t = (article + ' ' + (categorie||'')).toLowerCase();
  const bevKw = ['vin','champagne','prosecco','whisky','vodka','gin','rhum','cognac','liqueur',
    'aperol','campari','bière','beer','eau-de-vie','porto','grappa','tequila',
    'coca','cola','fanta','sprite','jus ','sirop','eau minérale','café','thé ','tea ','nespresso'];
  if (bevKw.some(kw => t.includes(kw))) return 'bev';
  return 'food';
}

/* ─── État de l'import ───────────────────────────────────────── */
let _importRawRows   = [];   // lignes brutes de l'Excel
let _importHeaders   = [];   // en-têtes normalisés
let _importColMap    = {};   // { article: colIdx, prix: colIdx, ... }
let _importPreview   = [];   // lignes parsées (preview)
let _importStep      = 1;

function openArticleImport() {
  _importRawRows = []; _importHeaders = []; _importColMap = {};
  _importPreview = []; _importStep = 1;
  const modal = document.getElementById('article-import-modal');
  if (!modal) return;
  _impShowStep(1);
  modal.classList.add('visible');
}
function closeArticleImport() {
  document.getElementById('article-import-modal')?.classList.remove('visible');
}

function _impShowStep(n) {
  _importStep = n;
  [1,2,3].forEach(i => {
    const el = document.getElementById(`imp-step-${i}`);
    if (el) el.style.display = (i === n) ? 'block' : 'none';
  });
  const prev = document.getElementById('imp-prev-btn');
  const next = document.getElementById('imp-next-btn');
  if (prev) prev.style.display = n > 1 ? 'inline-flex' : 'none';
  if (next) {
    next.textContent = n === 3 ? 'Lancer l\'import' : 'Suivant →';
    next.onclick = n === 3 ? _impExecute : _impNext;
    next.disabled = n === 1;
  }
}

function _impNext() {
  if (_importStep === 1) _impBuildMapping();
  else if (_importStep === 2) _impBuildPreview();
  _impShowStep(_importStep + 1);
}

/* Étape 1 : Upload fichier */
function handleImportFile(event) {
  const file = event.target.files?.[0];
  if (!file || typeof XLSX === 'undefined') return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const wb   = XLSX.read(ev.target.result, { type:'array' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      _importRawRows = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
      if (_importRawRows.length < 2) { alert('Fichier vide.'); return; }
      _importHeaders = _importRawRows[0].map((c,i) => ({
        label: String(c).trim(),
        norm:  String(c).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,''),
        idx:   i
      }));
      // Auto-détection des colonnes
      _importColMap = {};
      Object.entries(COL_DETECT).forEach(([field, aliases]) => {
        const found = _importHeaders.find(h => aliases.some(a => h.norm.includes(a)));
        if (found) _importColMap[field] = found.idx;
      });
      const nbData = _importRawRows.length - 1;
      document.getElementById('imp-file-info').innerHTML =
        `<strong>${nbData}</strong> article(s) détectés · ${_importHeaders.length} colonnes`;
      document.getElementById('imp-next-btn').disabled = false;
      _impRenderColMapping();
    } catch(e) { alert('Erreur lecture : ' + e.message); }
  };
  reader.readAsArrayBuffer(file);
}

/* Affiche les colonnes détectées avec selects pour ajustement */
function _impRenderColMapping() {
  const wrap = document.getElementById('imp-col-map-wrap');
  if (!wrap) return;
  const fields = {
    article:'Nom article *', fournisseur:'Fournisseur', categorie:'Catégorie / Code',
    prix:'Prix unitaire HT', unite:'Unité', tva:'Taux TVA',
    stock_actuel:'Stock actuel', min_stock:'Stock minimum', stock_optimal:'Stock optimal', statut:'Statut'
  };
  const opts = ['<option value="-1">— Ne pas importer —</option>',
    ..._importHeaders.map(h => `<option value="${h.idx}">${h.label}</option>`)
  ].join('');

  wrap.innerHTML = `
    <div style="font-size:11px;color:var(--gray-500);margin-bottom:12px;">
      Colonnes auto-détectées — vérifiez et ajustez si besoin.
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      ${Object.entries(fields).map(([f,lbl]) => {
        const sel = _importColMap[f] !== undefined ? _importColMap[f] : -1;
        return `<div>
          <label class="field-label">${lbl}</label>
          <select id="imp-col-${f}" onchange="_importColMap['${f}']=parseInt(this.value)">
            ${opts.replace(`value="${sel}"`,`value="${sel}" selected`)}
          </select>
        </div>`;
      }).join('')}
    </div>`;
}

/* Étape 2 : Mapping catégories */
function _impBuildMapping() {
  // Relire les selects
  Object.keys(COL_DETECT).forEach(f => {
    const el = document.getElementById(`imp-col-${f}`);
    if (el) _importColMap[f] = parseInt(el.value);
  });

  const catCol = _importColMap['categorie'];
  if (catCol === undefined || catCol < 0) { _impShowStep(3); _impBuildPreview(); return; }

  // Collecter les catégories uniques du fichier
  const rawCats = new Set();
  _importRawRows.slice(1).forEach(r => {
    const v = String(r[catCol] || '').trim();
    if (v) rawCats.add(v);
  });

  const catOpts = (typeof getAllCategories === 'function' ? getAllCategories() : FC_CATEGORIES || ['Autres']).map(c =>
    `<option value="${c}">${c}</option>`).join('');

  const rows = [...rawCats].sort().map(raw => {
    const detected = _parseCatCode(raw) || (typeof fcAutoCategory === 'function' ? fcAutoCategory(raw) : 'Autres');
    return `<tr>
      <td style="font-size:12px;max-width:220px;padding:6px 10px;">${raw}</td>
      <td style="padding:6px 4px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             style="color:var(--phar-navy);"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
      </td>
      <td style="padding:6px 4px;">
        <select data-raw="${raw.replace(/"/g,'&quot;')}"
                style="font-size:12px;padding:4px 6px;border:1px solid var(--gray-200);border-radius:3px;width:100%;">
          ${catOpts.replace(`value="${detected}"`,`value="${detected}" selected`)}
        </select>
      </td>
    </tr>`;
  }).join('');

  const el = document.getElementById('imp-step-2');
  if (el) el.innerHTML = `
    <div style="font-size:13px;font-weight:600;margin-bottom:14px;">
      Correspondance des catégories (${rawCats.size} uniques détectées)
    </div>
    <div style="font-size:11px;color:var(--gray-500);margin-bottom:12px;">
      Les catégories ont été auto-mappées d'après leurs codes. Ajustez si nécessaire.
    </div>
    <div style="max-height:380px;overflow-y:auto;border:1px solid var(--gray-200);border-radius:var(--radius-lg);">
      <table class="data-table" style="font-size:12px;">
        <thead><tr>
          <th>Catégorie source</th><th style="width:30px;"></th><th>Catégorie PHAR Cost</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

/* Récupérer le mapping catégories validé par l'utilisateur */
function _impGetCatMapping() {
  const map = {};
  document.querySelectorAll('#imp-step-2 select[data-raw]').forEach(sel => {
    map[sel.dataset.raw] = sel.value;
  });
  return map;
}

/* Étape 3 : Prévisualisation des articles à importer */
function _impBuildPreview() {
  const catMap = _impGetCatMapping();
  const cm = _importColMap;
  _importPreview = [];

  _importRawRows.slice(1).forEach((row, i) => {
    const nom = String(row[cm.article] !== undefined && cm.article >= 0 ? row[cm.article] : '').trim();
    if (!nom) return;

    const rawCat  = cm.categorie >= 0 ? String(row[cm.categorie]||'').trim() : '';
    const cat     = catMap[rawCat] || _parseCatCode(rawCat) || (typeof fcAutoCategory === 'function' ? fcAutoCategory(nom) : 'Autres');
    const merc    = _detectMerc(nom, cat);
    const prix    = parseFloat(String(row[cm.prix >= 0 ? cm.prix : -1]||'').replace(',','.')) || 0;
    const unite   = cm.unite >= 0 ? String(row[cm.unite]||'').trim() || 'pce' : 'pce';
    const four    = cm.fournisseur >= 0 ? String(row[cm.fournisseur]||'').trim() : '';
    const tvaRaw  = cm.tva >= 0 ? row[cm.tva] : null;
    const tva     = _parseTVA(tvaRaw) ?? (typeof fcAutoTVA === 'function' ? fcAutoTVA(nom, cat) : 2.6);
    const stock   = cm.stock_actuel >= 0 ? (parseFloat(String(row[cm.stock_actuel]||'').replace(',','.')) || 0) : 0;
    const minSt   = cm.min_stock >= 0 ? (parseFloat(String(row[cm.min_stock]||'').replace(',','.')) || 0) : 0;
    const optSt   = cm.stock_optimal >= 0 ? (parseFloat(String(row[cm.stock_optimal]||'').replace(',','.')) || 0) : 0;

    // Vérifier si l'article existe déjà
    const store   = typeof pharStores !== 'undefined' ? pharStores[merc] : [];
    const exists  = store.some(a => a.article.toLowerCase() === nom.toLowerCase());

    _importPreview.push({ nom, cat, merc, prix, unite, fournisseur: four,
      tva, stock, min_stock: minSt, stock_optimal: optSt,
      exists, import: true });
  });

  const nbNew = _importPreview.filter(a => !a.exists).length;
  const nbUpd = _importPreview.filter(a => a.exists).length;
  const nbFood = _importPreview.filter(a => a.merc === 'food').length;
  const nbBev  = _importPreview.filter(a => a.merc === 'bev').length;

  const rows = _importPreview.map((a, i) => `
    <tr style="background:${a.exists?'var(--warning-light)':'var(--white)'};">
      <td style="text-align:center;padding:6px 4px;">
        <input type="checkbox" class="bl-check" checked
               onchange="_importPreview[${i}].import=this.checked">
      </td>
      <td style="font-weight:600;font-size:12px;max-width:200px;">${a.nom}</td>
      <td>
        <span class="badge ${a.merc==='bev'?'badge-info':'badge-success'}" style="font-size:10px;">
          ${a.merc==='bev'?'Boissons':'Food'}
        </span>
      </td>
      <td style="font-size:11px;color:var(--gray-500);">${a.cat}</td>
      <td style="font-size:11px;color:var(--gray-500);">${a.fournisseur||'—'}</td>
      <td style="text-align:right;font-size:12px;font-weight:600;">${a.prix>0?a.prix.toFixed(2)+'':'—'}</td>
      <td style="text-align:center;font-size:11px;">${a.unite}</td>
      <td style="text-align:center;">
        <span class="badge ${a.tva>3?'badge-warning':'badge-success'}" style="font-size:10px;">${a.tva}%</span>
      </td>
      <td style="text-align:right;font-size:11px;color:var(--gray-500);">${a.stock!==0?a.stock:''}</td>
      <td style="text-align:center;">
        ${a.exists
          ? '<span class="badge badge-warning" style="font-size:10px;">Mise à jour</span>'
          : '<span class="badge badge-success" style="font-size:10px;">Nouveau</span>'}
      </td>
    </tr>`).join('');

  const el = document.getElementById('imp-step-3');
  if (el) el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px;">
      <div class="kpi" style="padding:12px;"><div class="kpi-label">Total</div><div class="kpi-value" style="font-size:20px;">${_importPreview.length}</div></div>
      <div class="kpi kpi-success" style="padding:12px;"><div class="kpi-label">Nouveaux</div><div class="kpi-value" style="font-size:20px;">${nbNew}</div></div>
      <div class="kpi kpi-warning" style="padding:12px;"><div class="kpi-label">Mises à jour</div><div class="kpi-value" style="font-size:20px;">${nbUpd}</div></div>
      <div class="kpi" style="padding:12px;"><div class="kpi-label">Food / Boissons</div><div class="kpi-value" style="font-size:16px;">${nbFood} / ${nbBev}</div></div>
    </div>
    <div style="font-size:12px;color:var(--gray-500);margin-bottom:10px;">
      <span style="background:var(--warning-light);padding:2px 6px;border-radius:3px;">Fond orangé</span> = article existant (sera mis à jour)
    </div>
    <div style="max-height:360px;overflow-y:auto;border:1px solid var(--gray-200);border-radius:var(--radius-lg);">
      <table class="data-table" style="font-size:12px;">
        <thead><tr>
          <th style="width:34px;"><input type="checkbox" class="bl-check" checked
              onchange="document.querySelectorAll('#imp-step-3 input[type=checkbox]:not(thead *)').forEach(c=>c.checked=this.checked);_importPreview.forEach(a=>a.import=this.checked)"></th>
          <th>Nom article</th><th>Merc.</th><th>Catégorie</th><th>Fournisseur</th>
          <th class="num">Prix HT</th><th style="text-align:center;">Unité</th>
          <th style="text-align:center;">TVA</th><th class="num">Stock</th><th>Statut</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

/* Exécuter l'import */
function _impExecute() {
  if (typeof pharStores === 'undefined') return;
  const toImport = _importPreview.filter(a => a.import);
  if (!toImport.length) {
    if (typeof showToast === 'function') showToast('Aucun article sélectionné.', 'error');
    return;
  }

  let created = 0, updated = 0;

  toImport.forEach(a => {
    const store = pharStores[a.merc];
    const existing = store.find(e => e.article.toLowerCase() === a.nom.toLowerCase());

    if (existing) {
      // Mise à jour du prix et des métadonnées
      if (a.prix > 0) { existing.pu = a.prix; existing.prix_reference = a.prix; }
      if (a.fournisseur && a.fournisseur !== '(Plusieurs)') existing.fournisseur = a.fournisseur;
      if (a.unite) existing.unite = a.unite;
      existing._ac_cat = a.cat;
      existing._tva_achat = a.tva;
      if (a.min_stock > 0) existing.min_stock = a.min_stock;
      if (a.stock_optimal > 0) existing.stock_optimal = a.stock_optimal;
      updated++;
    } else {
      // Création
      const pos = Object.fromEntries(
        (typeof POS_DEFINITIONS !== 'undefined' ? POS_DEFINITIONS[a.merc] : []).map(p => [p, 0])
      );
      // Si on a un stock actuel, le mettre dans le premier POS
      if (a.stock > 0 && Object.keys(pos).length > 0) {
        pos[Object.keys(pos)[0]] = a.stock;
      }
      const newItem = {
        groupe:          a.merc === 'food' ? 'Food' : 'Minérales',
        categorie:       a.cat,
        article:         a.nom,
        unite:           a.unite,
        fournisseur:     a.fournisseur !== '(Plusieurs)' ? a.fournisseur : '',
        pu:              a.prix,
        cump:            a.prix,
        prix_reference:  a.prix,
        historique_prix: [],
        lightspeed_sku:  null,
        mois_m1:         0,
        pos,
        options_achat:   a.fournisseur && a.fournisseur !== '(Plusieurs)' ? [{
          id:             'oa_imp_' + Math.random().toString(36).slice(2,7),
          nom_produit:    a.nom,
          fournisseur:    a.fournisseur,
          code_produit:   '',
          unite_commande: a.unite,
          prix:           a.prix,
          variation_prix: 0,
          est_commande:   true,
          est_principal:  true,
          est_local:      false
        }] : [],
        _ac_cat:         a.cat,
        _tva_achat:      a.tva,
        min_stock:       a.min_stock,
        stock_optimal:   a.stock_optimal
      };
      store.push(newItem);
      created++;
    }
  });

  if (typeof saveStores === 'function') saveStores();
  closeArticleImport();
  if (typeof acRenderArticles === 'function') acRenderArticles();
  if (typeof showToast === 'function')
    showToast(`✓ Import terminé · ${created} créé(s) · ${updated} mis à jour`, 'success');
}

/* Injection du modal import */
function _injectImportModal() {
  const el = document.createElement('div');
  el.innerHTML = `
    <div class="modal-backdrop" id="article-import-modal">
      <div class="modal" style="max-width:920px;width:95vw;">
        <div class="modal-header">
          <div>
            <div class="modal-title">Import d'articles — Autre logiciel de stock</div>
            <div style="font-size:12px;color:var(--gray-500);margin-top:2px;">
              Compatible : MarketMan · Lightspeed · Hotelkit · Excel générique
            </div>
          </div>
          <button class="modal-close" onclick="closeArticleImport()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <!-- Indicateur d'étapes -->
        <div style="display:flex;align-items:center;padding:14px 28px;border-bottom:1px solid var(--gray-200);gap:0;">
          ${[['1','Fichier'],['2','Catégories'],['3','Confirmation']].map(([n,lbl],i) => `
            <div style="display:flex;align-items:center;gap:0;flex:1;">
              <div id="imp-step-dot-${n}" style="
                width:28px;height:28px;border-radius:50%;
                background:${i===0?'var(--phar-navy)':'var(--gray-200)'};
                color:${i===0?'white':'var(--gray-500)'};
                display:flex;align-items:center;justify-content:center;
                font-family:'Archivo';font-weight:700;font-size:12px;flex-shrink:0;">
                ${n}
              </div>
              <div style="font-size:12px;font-weight:${i===0?700:500};color:${i===0?'var(--phar-navy)':'var(--gray-500)'};margin-left:6px;">${lbl}</div>
              ${i<2?'<div style="flex:1;height:1px;background:var(--gray-200);margin:0 12px;"></div>':''}
            </div>`).join('')}
        </div>

        <div class="modal-body" style="max-height:calc(85vh - 160px);overflow-y:auto;min-height:320px;">

          <!-- Étape 1 : Upload + mapping colonnes -->
          <div id="imp-step-1">
            <input type="file" id="imp-file-input" accept=".xlsx,.xls,.csv"
                   style="display:none;" onchange="handleImportFile(event)">
            <div class="upload-zone" onclick="document.getElementById('imp-file-input').click()"
                 style="padding:32px;margin-bottom:16px;">
              <div class="upload-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
              </div>
              <div class="upload-title">Export Excel de votre logiciel de stock</div>
              <div class="upload-hint">Colonnes recommandées : Nom · Fournisseur · Catégorie · Prix/UdM · Unité · TVA · Stock</div>
            </div>
            <div style="font-size:13px;color:var(--gray-500);margin-bottom:16px;" id="imp-file-info">Aucun fichier sélectionné</div>
            <div id="imp-col-map-wrap"></div>
          </div>

          <!-- Étape 2 : Mapping catégories (rempli dynamiquement) -->
          <div id="imp-step-2" style="display:none;"></div>

          <!-- Étape 3 : Prévisualisation (rempli dynamiquement) -->
          <div id="imp-step-3" style="display:none;"></div>

        </div>

        <div class="modal-footer" style="justify-content:space-between;">
          <button class="btn btn-ghost" id="imp-prev-btn" style="display:none;"
                  onclick="_impShowStep(_importStep - 1)">← Retour</button>
          <button class="btn btn-primary" id="imp-next-btn" disabled
                  onclick="_impNext()">Suivant →</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(el);
  document.getElementById('article-import-modal')?.addEventListener('click', e => {
    if (e.target.id === 'article-import-modal') e.target.classList.remove('visible');
  });
}

/* ─── Init ───────────────────────────────────────────────────── */
loadSettings();

document.addEventListener('DOMContentLoaded', () => {
  injectParamModals();
  _injectImportModal();
  // Déclencher le rendu entreprise si on atterrit sur paramètres
  if (typeof _navActivateModule === 'function') {
    const origSwitchACTab = window.switchACTab;
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GESTION DES FOURNISSEURS
// ══════════════════════════════════════════════════════════════════════════════

(function() {
  // Inject modal HTML
  function injectFourModal() {
    if (document.getElementById('fournisseurs-modal')) return;
    const div = document.createElement('div');
    div.innerHTML = `
      <div class="modal-backdrop" id="fournisseurs-modal">
        <div class="modal" style="max-width:680px;width:100%;">
          <div class="modal-header">
            <div class="modal-title">Gestion des fournisseurs</div>
            <button class="modal-close" onclick="document.getElementById('fournisseurs-modal').classList.remove('visible')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div class="modal-body" style="max-height:65vh;overflow-y:auto;">
            <div id="four-modal-content"></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="document.getElementById('fournisseurs-modal').classList.remove('visible')">Fermer</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(div);
    document.getElementById('fournisseurs-modal').addEventListener('click', e => {
      if (e.target.id === 'fournisseurs-modal') e.target.classList.remove('visible');
    });
  }

  // Override nav-fournisseurs handler
  function patchNavFournisseurs() {
    const btn = document.getElementById('nav-fournisseurs');
    if (!btn) return;
    // Clone to remove existing handlers
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', () => window.openFournisseursModal());
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { injectFourModal(); patchNavFournisseurs(); });
  } else {
    setTimeout(() => { injectFourModal(); patchNavFournisseurs(); }, 0);
  }
})();

// Global state for supplier management
let _fourList = [];
let _fourMergeSrc = null;

function _fourGetStores() {
  return {
    food: (typeof pharStores !== 'undefined' && pharStores.food) ? pharStores.food : [],
    bev:  (typeof pharStores !== 'undefined' && pharStores.bev)  ? pharStores.bev  : []
  };
}

function _fourGetAll() {
  const { food, bev } = _fourGetStores();
  const names = new Set();
  [...food, ...bev].forEach(item => {
    if (item.fournisseur) names.add(item.fournisseur);
    (item.options_achat || []).forEach(o => { if (o.fournisseur) names.add(o.fournisseur); });
  });
  try {
    const fc = JSON.parse(localStorage.getItem('phar_fc_articles_v1') || '[]');
    fc.forEach(a => { if (a.fournisseur) names.add(a.fournisseur); });
  } catch(e) {}
  return [...names].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
}

function _fourCountArticles(name) {
  const { food, bev } = _fourGetStores();
  let n = 0;
  [...food, ...bev].forEach(item => {
    if (item.fournisseur === name) n++;
    (item.options_achat || []).forEach(o => { if (o.fournisseur === name) n++; });
  });
  try {
    const fc = JSON.parse(localStorage.getItem('phar_fc_articles_v1') || '[]');
    fc.forEach(a => { if (a.fournisseur === name) n++; });
  } catch(e) {}
  return n;
}

function _fourApplyRenames(renames) {
  const { food, bev } = _fourGetStores();
  function updateArr(arr) {
    arr.forEach(item => {
      if (item.fournisseur != null && Object.prototype.hasOwnProperty.call(renames, item.fournisseur))
        item.fournisseur = renames[item.fournisseur];
      (item.options_achat || []).forEach(o => {
        if (o.fournisseur != null && Object.prototype.hasOwnProperty.call(renames, o.fournisseur))
          o.fournisseur = renames[o.fournisseur];
      });
    });
  }
  updateArr(food);
  updateArr(bev);

  // Save pharStores — try known save functions, fallback to direct localStorage
  if      (typeof saveStores     === 'function') saveStores();
  else if (typeof saveInventaire === 'function') saveInventaire();
  else if (typeof saveMercuriale === 'function') { saveMercuriale('food'); saveMercuriale('bev'); }
  else {
    try { localStorage.setItem('phar_stores_food', JSON.stringify(food)); } catch(e) {}
    try { localStorage.setItem('phar_stores_bev',  JSON.stringify(bev));  } catch(e) {}
  }

  // Update flash cost articles
  if (typeof fcArticles !== 'undefined') {
    fcArticles.forEach(a => {
      if (a.fournisseur != null && Object.prototype.hasOwnProperty.call(renames, a.fournisseur))
        a.fournisseur = renames[a.fournisseur];
    });
    if (typeof fcSaveAll === 'function') fcSaveAll();
  }
  try {
    const fc = JSON.parse(localStorage.getItem('phar_fc_articles_v1') || '[]');
    let changed = false;
    fc.forEach(a => {
      if (a.fournisseur != null && Object.prototype.hasOwnProperty.call(renames, a.fournisseur)) {
        a.fournisseur = renames[a.fournisseur];
        changed = true;
      }
    });
    if (changed) localStorage.setItem('phar_fc_articles_v1', JSON.stringify(fc));
  } catch(e) {}
}

function openFournisseursModal() {
  _fourMergeSrc = null;
  const modal = document.getElementById('fournisseurs-modal');
  if (!modal) return;
  modal.classList.add('visible');
  _renderFournisseursList();
}

function _renderFournisseursList() {
  const el = document.getElementById('four-modal-content');
  if (!el) return;
  _fourList = _fourGetAll();

  if (!_fourList.length) {
    el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--gray-400);">Aucun fournisseur référencé dans les articles.</div>';
    return;
  }

  const mergeBanner = _fourMergeSrc
    ? `<div style="background:#FFF3CD;border:1px solid #FFD86B;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:13px;display:flex;align-items:center;gap:10px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#856404" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span>Fusion en cours : <strong style="color:#856404;">${_escH(_fourMergeSrc)}</strong> — cliquez sur <strong>Fusionner</strong> du fournisseur cible, ou <button onclick="_fourCancelMerge()" style="background:none;border:none;cursor:pointer;color:#856404;text-decoration:underline;font-size:13px;padding:0;">annuler</button></span>
      </div>`
    : '';

  const rows = _fourList.map((name, idx) => {
    const count = _fourCountArticles(name);
    const isSrc = _fourMergeSrc === name;
    const initials = name.replace(/[^a-zA-ZÀ-ÿ0-9]/g,'').slice(0,2).toUpperCase() || name.slice(0,2).toUpperCase();
    return `<tr style="${isSrc ? 'background:#EEF1FB;' : 'background:white;'}border-bottom:1px solid var(--gray-100);">
      <td style="padding:12px 14px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:34px;height:34px;border-radius:6px;background:var(--phar-navy,#2E3192);color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;font-family:'Archivo',sans-serif;flex-shrink:0;">${_escH(initials)}</div>
          <input type="text" id="four-inp-${idx}"
                 value="${_escA(name)}"
                 style="font-size:13px;font-weight:600;color:var(--phar-navy,#2E3192);border:1.5px solid var(--gray-200,#E5E5E3);border-radius:6px;padding:7px 10px;min-width:170px;flex:1;outline:none;background:white;transition:border-color .15s;"
                 onfocus="this.style.borderColor='var(--phar-navy,#2E3192)'"
                 onblur="this.style.borderColor='var(--gray-200,#E5E5E3)'"
                 onkeydown="if(event.key==='Enter')fourValider(${idx})">
        </div>
      </td>
      <td style="padding:12px 8px;text-align:center;width:90px;">
        <span style="font-size:11px;font-weight:700;background:var(--gray-100,#F4F3F3);color:var(--gray-500,#7E7E79);padding:3px 9px;border-radius:4px;">${count} art.</span>
      </td>
      <td style="padding:12px 10px;text-align:right;white-space:nowrap;">
        <button class="btn btn-primary btn-sm" onclick="fourValider(${idx})" title="Enregistrer le nouveau nom">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width:12px;height:12px;stroke-width:2.5;margin-right:3px;"><polyline points="20 6 9 17 4 12"/></svg>
          Valider
        </button>
        <button class="btn btn-ghost btn-sm"
                style="${isSrc ? 'background:var(--phar-navy,#2E3192);color:white;' : _fourMergeSrc ? 'border-color:var(--phar-navy,#2E3192);color:var(--phar-navy,#2E3192);font-weight:700;' : ''}"
                onclick="fourMerge(${idx})"
                title="${isSrc ? 'Annuler la fusion' : _fourMergeSrc ? 'Fusionner '+_escA(_fourMergeSrc)+' dans ce fournisseur' : 'Sélectionner pour fusion'}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width:12px;height:12px;stroke-width:2;margin-right:3px;"><path d="M8 7H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3m-1-4-4 4-4-4m4-4v13"/></svg>
          ${isSrc ? 'Annuler' : _fourMergeSrc ? '← Fusionner ici' : 'Fusionner'}
        </button>
        <button class="btn btn-ghost btn-sm" style="color:var(--danger,#B23B2A);" onclick="fourDelete(${idx})" title="Retirer ce fournisseur de tous les articles">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width:12px;height:12px;stroke-width:2;margin-right:2px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
          Supprimer
        </button>
      </td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <div style="font-size:13px;color:var(--gray-500,#7E7E79);margin-bottom:12px;">${_fourList.length} fournisseur${_fourList.length !== 1 ? 's' : ''} référencé${_fourList.length !== 1 ? 's' : ''}</div>
    ${mergeBanner}
    <div class="card" style="padding:0;overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:var(--phar-navy,#2E3192);">
            <th style="padding:10px 14px;text-align:left;color:white;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;">Fournisseur</th>
            <th style="padding:10px 8px;text-align:center;color:white;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;">Articles</th>
            <th style="padding:10px 10px;text-align:right;color:white;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;">Actions</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="margin-top:14px;padding:10px 14px;background:var(--gray-50,#F9F9F8);border-radius:8px;font-size:11.5px;color:var(--gray-500,#7E7E79);line-height:1.6;">
      <strong style="color:var(--gray-700,#444);">Valider</strong> — modifie le nom et met à jour tous les articles liés ·
      <strong style="color:var(--gray-700,#444);">Fusionner</strong> — regroupe deux fournisseurs en un seul ·
      <strong style="color:var(--gray-700,#444);">Supprimer</strong> — retire le fournisseur de tous les articles
    </div>`;
}

function _escH(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function _escA(s) { return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;'); }

function _fourCancelMerge() {
  _fourMergeSrc = null;
  _renderFournisseursList();
}

function fourValider(idx) {
  const origName = _fourList[idx];
  if (origName === undefined) return;
  const input = document.getElementById('four-inp-' + idx);
  if (!input) return;
  const newName = input.value.trim();
  if (!newName) {
    if (typeof showToast === 'function') showToast('Le nom ne peut pas être vide.', 'error');
    input.focus();
    return;
  }
  if (newName === origName) {
    if (typeof showToast === 'function') showToast('Aucun changement détecté.', '');
    return;
  }
  _fourApplyRenames({ [origName]: newName });
  if (typeof showToast === 'function') showToast(`✓ Renommé : "${origName}" → "${newName}"`, 'success');
  if (_fourMergeSrc === origName) _fourMergeSrc = null;
  _renderFournisseursList();
}

function fourDelete(idx) {
  const name = _fourList[idx];
  if (name === undefined) return;
  const count = _fourCountArticles(name);
  if (!confirm(`Supprimer le fournisseur "${name}" ?\n\nCela retirera ce fournisseur de ${count} article${count !== 1 ? 's' : ''}.`)) return;
  _fourApplyRenames({ [name]: '' });
  if (_fourMergeSrc === name) _fourMergeSrc = null;
  if (typeof showToast === 'function') showToast(`Fournisseur "${name}" supprimé.`, '');
  _renderFournisseursList();
}

function fourMerge(idx) {
  const name = _fourList[idx];
  if (name === undefined) return;

  if (!_fourMergeSrc) {
    _fourMergeSrc = name;
    _renderFournisseursList();
    if (typeof showToast === 'function') showToast(`"${name}" sélectionné — cliquez sur "← Fusionner ici" d'un autre fournisseur.`, '');
    return;
  }
  if (_fourMergeSrc === name) {
    _fourMergeSrc = null;
    _renderFournisseursList();
    return;
  }
  const src = _fourMergeSrc;
  const countSrc = _fourCountArticles(src);
  if (!confirm(`Fusionner "${src}" dans "${name}" ?\n\n${countSrc} article${countSrc !== 1 ? 's' : ''} sera${countSrc !== 1 ? 'ont' : ''} mis à jour.\nCette action est irréversible.`)) return;
  _fourApplyRenames({ [src]: name });
  _fourMergeSrc = null;
  if (typeof showToast === 'function') showToast(`✓ Fusionné : "${src}" → "${name}"`, 'success');
  _renderFournisseursList();
}
