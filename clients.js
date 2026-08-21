/* ============================================================
   PHAR Cost — clients.js
   Gestion des clients / établissements (modèle SaaS Phase 1)

   Ce fichier DOIT être chargé EN PREMIER (avant index.html et
   tous les autres scripts) car il expose des fonctions globales
   utilisées partout dans l'application.

   Fonctions exposées :
     getActiveClient()               → objet client actif
     renderClientHeader()            → met à jour #header-client-slot
     updateClientField(id, field, v) → modifie + persiste un champ
   ============================================================ */

/* ─── Clés localStorage ──────────────────────────────────── */
const CLIENTS_LS        = 'phar_clients_v1';
const ACTIVE_CLIENT_LS  = 'phar_active_client_id_v1';

/* ─── Modèle client par défaut ───────────────────────────────
   Fiche vierge : l'établissement est renseigné par l'utilisateur
   dans Paramètres → Entreprise. Aucun nom fictif n'est injecté.
   ──────────────────────────────────────────────────────────── */
const DEFAULT_CLIENT = {
  id:              'client_1',
  nom:             'Mon établissement',
  enseigne:        '',
  adresse:         '',
  ville:           '',
  npa:             '',
  pays:            'Suisse',
  telephone:       '',
  email:           '',
  tva_number:      '',
  devise:          'CHF',
  langue:          'fr',
  plan:            'starter',    // starter | pro | hotel | enterprise
  claude_api_key:  '',           // clé PHAR API par client (sessionStorage)
  quota_scans:     200,          // scans/mois selon plan
  scans_utilises:  0,
  created_at:      new Date().toISOString()
};

/* ─── État interne ───────────────────────────────────────── */
let _pharClients      = [];
let _activeClientId   = DEFAULT_CLIENT.id;

/* ─── Persistence ────────────────────────────────────────── */
function _loadClients() {
  try {
    const raw = localStorage.getItem(CLIENTS_LS);
    _pharClients = raw ? JSON.parse(raw) : [];
  } catch (e) {
    _pharClients = [];
  }

  // Si aucun client enregistré, créer une fiche vierge
  if (!_pharClients.length) {
    _pharClients = [JSON.parse(JSON.stringify(DEFAULT_CLIENT))];
    _saveClients();
  }

  // Restaurer le client actif
  try {
    const savedId = localStorage.getItem(ACTIVE_CLIENT_LS);
    if (savedId && _pharClients.some(c => c.id === savedId)) {
      _activeClientId = savedId;
    } else {
      _activeClientId = _pharClients[0].id;
    }
  } catch (e) {
    _activeClientId = _pharClients[0]?.id || DEFAULT_CLIENT.id;
  }
}

function _saveClients() {
  try {
    localStorage.setItem(CLIENTS_LS, JSON.stringify(_pharClients));
  } catch (e) {}
}

/* ─── API publique ───────────────────────────────────────── */

/**
 * Retourne le client actuellement actif.
 * Si pharSettings est chargé, synchronise l'enseigne depuis les paramètres.
 */
function getActiveClient() {
  const client = _pharClients.find(c => c.id === _activeClientId) || _pharClients[0] || DEFAULT_CLIENT;

  // Sync depuis pharSettings si disponible (paramètres.js)
  if (typeof pharSettings !== 'undefined' && pharSettings?.entreprise) {
    const e = pharSettings.entreprise;
    if (e.nom)      client.nom      = e.nom;
    if (e.enseigne) client.enseigne = e.enseigne;
    if (e.adresse)  client.adresse  = e.adresse;
    if (e.ville)    client.ville    = e.ville;
    if (e.npa)      client.npa      = e.npa;
    if (e.pays)     client.pays     = e.pays;
    if (e.email)    client.email    = e.email;
    if (e.telephone)client.telephone = e.telephone;
  }

  return client;
}

/**
 * Met à jour un champ du client et persiste.
 * Utilisé notamment par parametres.js pour sauvegarder la clé API.
 */
function updateClientField(clientId, field, value) {
  const client = _pharClients.find(c => c.id === clientId);
  if (!client) return;
  client[field] = value;
  _saveClients();

  // Cas spécial : clé API → aussi en sessionStorage
  if (field === 'claude_api_key' && value) {
    try { sessionStorage.setItem('phar_api_key', value); } catch (e) {}
  }

  renderClientHeader();
}

/**
 * Rend le chip établissement dans #header-client-slot.
 * Appelé au chargement, puis après chaque sauvegarde de paramètres.
 */
function renderClientHeader() {
  const slot = document.getElementById('header-client-slot');
  if (!slot) return;

  const client = getActiveClient();
  const enseigne = client.enseigne || client.nom || 'Établissement';
  const planLabels = { starter: 'Starter', pro: 'Pro', hotel: 'Hotel', enterprise: 'Enterprise' };
  const planLabel  = planLabels[client.plan] || client.plan || 'Pro';

  slot.innerHTML = `
    <div class="establishment" title="${enseigne} · Plan ${planLabel}">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
      <span style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${enseigne}</span>
      <span style="font-size:9px;font-weight:700;padding:1px 5px;border-radius:2px;background:var(--phar-navy);color:white;letter-spacing:.05em;text-transform:uppercase;flex-shrink:0;">${planLabel}</span>
    </div>`;
}

/* ─── Quota scans ────────────────────────────────────────── */

/** Incrémente le compteur de scans du client actif. */
function clientIncrementScans(count) {
  const client = _pharClients.find(c => c.id === _activeClientId);
  if (!client) return;
  client.scans_utilises = (client.scans_utilises || 0) + (count || 1);
  _saveClients();
}

/** Retourne true si le client peut encore scanner (quota non atteint). */
function clientCanScan() {
  const client = getActiveClient();
  if (!client.quota_scans) return true;   // illimité
  return (client.scans_utilises || 0) < client.quota_scans;
}

/* ─── Initialisation au chargement ──────────────────────── */
(function init() {
  _loadClients();

  // Rendre le header dès que le DOM est prêt
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderClientHeader);
  } else {
    renderClientHeader();
  }
})();
