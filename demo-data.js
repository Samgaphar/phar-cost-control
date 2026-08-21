/* ============================================================
   PHAR Cost — demo-data.js
   JEU DE DÉMONSTRATION — données fictives, isolées du code métier.

   Rien ici n'est chargé automatiquement. L'application démarre
   TOUJOURS vide : tous les chiffres affichés proviennent des
   documents réellement scannés et des saisies de l'utilisateur.

   Ces données ne servent qu'à une démonstration commerciale, via
   Paramètres → Données → « Charger un jeu de démo ». Un bandeau
   « MODE DÉMO » reste visible tant qu'elles sont actives.
   ============================================================ */

const DEMO_FLAG_LS = 'phar_demo_mode_v1';

/* Toutes les clés de stockage de l'application */
const PHAR_ALL_LS_KEYS = [
  'phar_inventory_stores_v1', 'phar_stock_movements_v1', 'phar_bls_v1',
  'phar_fournisseurs_v1', 'phar_fc_articles_v1', 'phar_fc_semaine_v1',
  'phar_fc_historique_v1', 'phar_fc_factures_v1', 'phar_recipes_v1',
  'phar_custom_categories_v1', 'phar_settings_v1', 'phar_users_v1',
  'phar_clients_v1', 'phar_active_client_id_v1'
];

/* ─── Mercuriales de démonstration (stocks fictifs) ─────────── */
const DEMO_FOOD = [{"groupe":"Food","categorie":"BH pdj","article":"Jus d'orange frais ELKA 3L","unite":"3LT","fournisseur":"Fideco","pu":11.42,"pos":{"Cuisine":0,"Economat 1":18,"Economat cuisine":0,"BH PDJ":12,"Boulangerie & BOF":0},"mois_m1":101},{"groupe":"Food","categorie":"Maison","article":"Forfait Epices 650CHF","unite":"Pce","fournisseur":"Maison","pu":650,"pos":{"Cuisine":1,"Economat 1":0,"Economat cuisine":0,"BH PDJ":0,"Boulangerie & BOF":0},"mois_m1":1},{"groupe":"Food","categorie":"Viande poisson","article":"Poulet Ragout Cuisse","unite":"Kg","fournisseur":"Fideco","pu":18.3,"pos":{"Cuisine":9,"Economat 1":0,"Economat cuisine":0,"BH PDJ":0,"Boulangerie & BOF":0},"mois_m1":43.4},{"groupe":"Food","categorie":"Viande poisson","article":"Boeuf Filet KG Prix negocie","unite":"Kg","fournisseur":"Merat","pu":34.9,"pos":{"Cuisine":62,"Economat 1":0,"Economat cuisine":0,"BH PDJ":0,"Boulangerie & BOF":0},"mois_m1":133},{"groupe":"Food","categorie":"Fonds, sauces, prod préparés","article":"Sauce Morille","unite":"lt","fournisseur":"Maison","pu":30,"pos":{"Cuisine":10,"Economat 1":0,"Economat cuisine":0,"BH PDJ":0,"Boulangerie & BOF":0},"mois_m1":18},{"groupe":"Food","categorie":"Boulangerie & BOF","article":"Trio mini beignets 25gr","unite":"Carton","fournisseur":"Chef gourmet","pu":76.49,"pos":{"Cuisine":3,"Economat 1":0,"Economat cuisine":0,"BH PDJ":0,"Boulangerie & BOF":0},"mois_m1":10},{"groupe":"Food","categorie":"Fonds, sauces, prod préparés","article":"Bouillon de Modzetta","unite":"Kg","fournisseur":"Maison","pu":8,"pos":{"Cuisine":60,"Economat 1":0,"Economat cuisine":0,"BH PDJ":0,"Boulangerie & BOF":0},"mois_m1":60},{"groupe":"Food","categorie":"Viande poisson","article":"Veau Faux-Filet KG","unite":"Kg","fournisseur":"Fideco","pu":43.1,"pos":{"Cuisine":5,"Economat 1":0,"Economat cuisine":0,"BH PDJ":0,"Boulangerie & BOF":0},"mois_m1":11},{"groupe":"Food","categorie":"Fonds, sauces, prod préparés","article":"Wrap","unite":"Kg","fournisseur":"Stettler","pu":7,"pos":{"Cuisine":4,"Economat 1":0,"Economat cuisine":0,"BH PDJ":0,"Boulangerie & BOF":0},"mois_m1":65},{"groupe":"Food","categorie":"Pâtisserie","article":"Œuf Chocolat Ganache 2kg","unite":"CAR","fournisseur":"Caromela","pu":108.69,"pos":{"Cuisine":0,"Economat 1":0,"Economat cuisine":0,"BH PDJ":0,"Boulangerie & BOF":0},"mois_m1":3.9},{"groupe":"Food","categorie":"Fonds, sauces, prod préparés","article":"Pasta maison","unite":"Kg","fournisseur":"Maison","pu":9,"pos":{"Cuisine":10,"Economat 1":0,"Economat cuisine":0,"BH PDJ":0,"Boulangerie & BOF":0},"mois_m1":50},{"groupe":"Café & Thé","categorie":"BH pdj","article":"Nescafe Smooth & Crema 12x500g","unite":"500gr","fournisseur":"Nestlé","pu":29.9,"pos":{"Cuisine":0,"Economat 1":0,"Economat cuisine":0,"BH PDJ":0,"Boulangerie & BOF":0},"mois_m1":12},{"groupe":"Food","categorie":"Viande poisson","article":"Saumon fumé Ecosse prétranché","unite":"Kg","fournisseur":"Fideco","pu":37.34,"pos":{"Cuisine":0,"Economat 1":0,"Economat cuisine":0,"BH PDJ":0,"Boulangerie & BOF":0},"mois_m1":7.55},{"groupe":"Café & Thé","categorie":"BH pdj","article":"Nespresso capsules Lungo Decafeinato 50pces","unite":"box","fournisseur":"Presto café","pu":22.5,"pos":{"Cuisine":0,"Economat 1":17,"Economat cuisine":0,"BH PDJ":2,"Boulangerie & BOF":0},"mois_m1":31},{"groupe":"Food","categorie":"Economat cuisine","article":"Sakura 0.5L","unite":"Bte","fournisseur":"Fideco/Koronekes","pu":44.3,"pos":{"Cuisine":2.5,"Economat 1":0,"Economat cuisine":0,"BH PDJ":0,"Boulangerie & BOF":0},"mois_m1":3},{"groupe":"Food","categorie":"Boulangerie & BOF","article":"Madeleine 45GX70pce","unite":"Carton","fournisseur":"Chef gourmet","pu":50.58,"pos":{"Cuisine":4,"Economat 1":0,"Economat cuisine":0,"BH PDJ":0,"Boulangerie & BOF":0},"mois_m1":9},{"groupe":"Food","categorie":"Boulangerie & BOF","article":"Fromage PDJ Maréchal KG","unite":"Kg","fournisseur":"Petit Crémier","pu":17.95,"pos":{"Cuisine":8,"Economat 1":0,"Economat cuisine":0,"BH PDJ":0,"Boulangerie & BOF":0},"mois_m1":22},{"groupe":"Food","categorie":"Pâtisserie","article":"Œuf Chocolat Praline 2kg","unite":"CAR","fournisseur":"Caromela","pu":65.63,"pos":{"Cuisine":0,"Economat 1":0,"Economat cuisine":0,"BH PDJ":0,"Boulangerie & BOF":0},"mois_m1":3.6},{"groupe":"Food","categorie":"Economat cuisine","article":"Huile d'Olive cuisson L","unite":"lt","fournisseur":"Saviva","pu":10.99,"pos":{"Cuisine":0,"Economat 1":0,"Economat cuisine":0,"BH PDJ":0,"Boulangerie & BOF":0},"mois_m1":20},{"groupe":"Food","categorie":"Boulangerie & BOF","article":"Pain au maïs 300g","unite":"Carton","fournisseur":"Chef gourmet","pu":50.24,"pos":{"Cuisine":0,"Economat 1":0,"Economat cuisine":0,"BH PDJ":0,"Boulangerie & BOF":0},"mois_m1":4},{"groupe":"Food","categorie":"Economat cuisine","article":"Bouillon Corsé Volaille Salsus","unite":"L","fournisseur":"Caromela","pu":16.44,"pos":{"Cuisine":0,"Economat 1":0,"Economat cuisine":0,"BH PDJ":0,"Boulangerie & BOF":0},"mois_m1":12},{"groupe":"Food","categorie":"Cuisine / Economat 2","article":"Huile Carlo Crisci 5L","unite":"Bidon","fournisseur":"Carlo Crisci","pu":85,"pos":{"Cuisine":0,"Economat 1":28,"Economat cuisine":0,"BH PDJ":0,"Boulangerie & BOF":0},"mois_m1":30},{"groupe":"Food","categorie":"BH pdj","article":"Beurre salé portion 10gr x 100","unite":"carton","fournisseur":"Stettler","pu":28,"pos":{"Cuisine":4,"Economat 1":0,"Economat cuisine":0,"BH PDJ":0,"Boulangerie & BOF":0},"mois_m1":10},{"groupe":"Food","categorie":"Fruits, légumes","article":"Champignon Mélange 5-7 sortes 2kg","unite":"Kg","fournisseur":"Culture","pu":13.75,"pos":{"Cuisine":0,"Economat 1":0,"Economat cuisine":0,"BH PDJ":0,"Boulangerie & BOF":0},"mois_m1":12},{"groupe":"Café & Thé","categorie":"Safran / Economat 2","article":"Thé Jasmin Dammann pearl","unite":"paq 500gr","fournisseur":"Bevanar","pu":81.7,"pos":{"Cuisine":0,"Economat 1":2,"Economat cuisine":0,"BH PDJ":0,"Boulangerie & BOF":0},"mois_m1":4},{"groupe":"Food","categorie":"Pâtisserie","article":"Beurre de Cacao Seau 3kg","unite":"Kg","fournisseur":"Caromela","pu":31.73,"pos":{"Cuisine":0,"Economat 1":0,"Economat cuisine":0,"BH PDJ":0,"Boulangerie & BOF":0},"mois_m1":4.25},{"groupe":"Food","categorie":"Pâtisserie","article":"Chocolat 40% Jivara Valrhona 3Kg","unite":"Kg","fournisseur":"Caromela","pu":23.79,"pos":{"Cuisine":3.3,"Economat 1":0,"Economat cuisine":0,"BH PDJ":0,"Boulangerie & BOF":0},"mois_m1":8.5}];

const DEMO_BEV = [{"groupe":"Bières","article":"Bière Kitchen Brew Centenniale IPA","mill":"","unite":"33cl","fournisseur":"Amstein","pu":2.66,"pos":{"Cave Min. & Bières":32,"Cave vins & spirit":0,"Safran min.":7,"Safran cave vin":0,"Living":9,"Purple":0,"Tubbo":0,"Bout.":0}},{"groupe":"Bières","article":"Bière l'Hermine","mill":"","unite":"33cl","fournisseur":"Brasserie Mine Bex","pu":2.8,"pos":{"Cave Min. & Bières":17,"Cave vins & spirit":0,"Safran min.":12,"Safran cave vin":0,"Living":4,"Purple":0,"Tubbo":0,"Bout.":0}},{"groupe":"Bières","article":"Bière Nebuleuse Diversion","mill":"","unite":"33cl","fournisseur":"Amstein","pu":2.44,"pos":{"Cave Min. & Bières":48,"Cave vins & spirit":0,"Safran min.":8,"Safran cave vin":0,"Living":0,"Purple":0,"Tubbo":0,"Bout.":0}},{"groupe":"Bières","article":"Bière S/Alcool Heineken 33cl","mill":"","unite":"33cl","fournisseur":"Amstein","pu":1.65,"pos":{"Cave Min. & Bières":42,"Cave vins & spirit":0,"Safran min.":11,"Safran cave vin":0,"Living":13,"Purple":0,"Tubbo":0,"Bout.":0}},{"groupe":"Café & Thé","article":"Café en grains Italiano 1Kg","mill":"","unite":"Kg","fournisseur":"Cuendet","pu":20.7,"pos":{"Cave Min. & Bières":0,"Cave vins & spirit":0,"Safran min.":0,"Safran cave vin":0,"Living":0,"Purple":1,"Tubbo":0,"Bout.":0}},{"groupe":"Vin","article":"Champagne Beatrice Baron 75cl FR","mill":"","unite":"75cl","fournisseur":"MonDrink","pu":14.9,"pos":{"Cave Min. & Bières":0,"Cave vins & spirit":21,"Safran min.":0,"Safran cave vin":0,"Living":0,"Purple":0,"Tubbo":0,"Bout.":0}},{"groupe":"Vin","article":"Chasselas Romand Obrist Fendant Blanc 1L","mill":"","unite":"1lt","fournisseur":"Obrist","pu":5.43,"pos":{"Cave Min. & Bières":0,"Cave vins & spirit":42,"Safran min.":0,"Safran cave vin":0,"Living":0,"Purple":0,"Tubbo":0,"Bout.":0}},{"groupe":"spirit","article":"Armagnac Marquisat","mill":"","unite":"70cl","fournisseur":"MonDrink","pu":32,"pos":{"Cave Min. & Bières":0,"Cave vins & spirit":0.7,"Safran min.":0.5,"Safran cave vin":0,"Living":0,"Purple":0,"Tubbo":0,"Bout.":0}},{"groupe":"spirit","article":"Brandy Baronet","mill":"Litre","unite":"100cl","fournisseur":"MonDrink","pu":19.35,"pos":{"Cave Min. & Bières":0,"Cave vins & spirit":1,"Safran min.":0,"Safran cave vin":0,"Living":0,"Purple":0,"Tubbo":0,"Bout.":0}},{"groupe":"Minérales","article":"Bitter Crodino Jaune s/alcool","mill":"","unite":"17cl","fournisseur":"MonDrink","pu":0.83,"pos":{"Cave Min. & Bières":29,"Cave vins & spirit":0,"Safran min.":0,"Safran cave vin":0,"Living":0,"Purple":0,"Tubbo":0,"Bout.":0}},{"groupe":"Minérales","article":"Bitter Crodino Rouge s/alcool","mill":"","unite":"17cl","fournisseur":"Amstein","pu":1.93,"pos":{"Cave Min. & Bières":72,"Cave vins & spirit":0,"Safran min.":12,"Safran cave vin":0,"Living":1,"Purple":4,"Tubbo":0,"Bout.":0}},{"groupe":"Minérales","article":"Coca Cola Zero 1.5L PET","mill":"","unite":"150cl","fournisseur":"Amstein","pu":2.2,"pos":{"Cave Min. & Bières":22,"Cave vins & spirit":0,"Safran min.":0,"Safran cave vin":0,"Living":0,"Purple":0,"Tubbo":0,"Bout.":0}},{"groupe":"Minérales","article":"Coca Cola Zero 33cl","mill":"","unite":"33cl","fournisseur":"Amstein","pu":1.07,"pos":{"Cave Min. & Bières":123,"Cave vins & spirit":0,"Safran min.":23,"Safran cave vin":0,"Living":3,"Purple":12,"Tubbo":0,"Bout.":0}},{"groupe":"spirit","article":"Amaretto Disaronno","mill":"","unite":"70cl","fournisseur":"MonDrink","pu":21.18,"pos":{"Cave Min. & Bières":0,"Cave vins & spirit":4,"Safran min.":0,"Safran cave vin":0,"Living":0.8,"Purple":0.3,"Tubbo":0,"Bout.":0}},{"groupe":"spirit","article":"Amaretto Lorenzo Inga","mill":"","unite":"70cl","fournisseur":"Swiss Wine Distri.","pu":32,"pos":{"Cave Min. & Bières":0,"Cave vins & spirit":2,"Safran min.":0.4,"Safran cave vin":1,"Living":2.2,"Purple":0,"Tubbo":0,"Bout.":0}},{"groupe":"spirit","article":"Aperol 100cl","mill":"","unite":"100cl","fournisseur":"MonDrink","pu":18.04,"pos":{"Cave Min. & Bières":0,"Cave vins & spirit":14,"Safran min.":0.5,"Safran cave vin":1,"Living":1,"Purple":6,"Tubbo":0,"Bout.":0}},{"groupe":"spirit","article":"Campari 100cl","mill":"","unite":"100cl","fournisseur":"MonDrink","pu":23.96,"pos":{"Cave Min. & Bières":0,"Cave vins & spirit":2,"Safran min.":0.5,"Safran cave vin":2,"Living":1.4,"Purple":2.6,"Tubbo":0,"Bout.":0}},{"groupe":"Vin","article":"Aigle les Murailles BLC 35cl","mill":"2024","unite":"35cl","fournisseur":"Obrist","pu":9.02,"pos":{"Cave Min. & Bières":0,"Cave vins & spirit":24,"Safran min.":6,"Safran cave vin":10,"Living":0,"Purple":0,"Tubbo":0,"Bout.":0}},{"groupe":"Vin","article":"Blanc de Merlot Empreinte La Côte 75cl","mill":"2025","unite":"75cl","fournisseur":"Cave de la Côte","pu":12.8,"pos":{"Cave Min. & Bières":0,"Cave vins & spirit":36,"Safran min.":0,"Safran cave vin":0,"Living":0,"Purple":0,"Tubbo":0,"Bout.":0}},{"groupe":"Vin","article":"Calamin Grand Cru AOC Chasselas","mill":"2025","unite":"75cl","fournisseur":"Enchères Tschopp","pu":12,"pos":{"Cave Min. & Bières":0,"Cave vins & spirit":2,"Safran min.":12,"Safran cave vin":0,"Living":0,"Purple":0,"Tubbo":0,"Bout.":0}},{"groupe":"Vin","article":"Chardonne Noble Terre 50cl","mill":"","unite":"50cl","fournisseur":"Cave Vevey MTX","pu":8,"pos":{"Cave Min. & Bières":0,"Cave vins & spirit":48,"Safran min.":8,"Safran cave vin":14,"Living":0,"Purple":0,"Tubbo":0,"Bout.":0}}];

/* ─── Articles leaders de démonstration ─────────────────────── */
const DEMO_FC_ARTICLES = [
  { id:'fca_1', nom:'Filet de bœuf CH', famille:'Viande',          fournisseur:'Merat',    unite:'kg',  prix_cible:34.90, seuil_alerte:10 },
  { id:'fca_2', nom:'Veau faux-filet',  famille:'Viande',          fournisseur:'Fideco',   unite:'kg',  prix_cible:43.10, seuil_alerte:8  },
  { id:'fca_3', nom:'Saumon fumé Ecosse', famille:'Poisson',       fournisseur:'Fideco',   unite:'kg',  prix_cible:37.34, seuil_alerte:8  },
  { id:'fca_4', nom:'Bolets frais',     famille:'Épicerie',        fournisseur:'Culture',  unite:'kg',  prix_cible:38.00, seuil_alerte:15 },
  { id:'fca_5', nom:'Champignons mélange', famille:'Épicerie',     fournisseur:'Culture',  unite:'kg',  prix_cible:13.75, seuil_alerte:15 },
  { id:'fca_6', nom:'Parmesan AOP 24m', famille:'Boulangerie-BOF', fournisseur:'Fideco',   unite:'kg',  prix_cible:42.00, seuil_alerte:10 },
  { id:'fca_7', nom:'Beurre AOP',       famille:'Boulangerie-BOF', fournisseur:'Stettler', unite:'kg',  prix_cible:14.00, seuil_alerte:12 },
  { id:'fca_8', nom:'Champagne Beatrice Baron', famille:'Boissons',fournisseur:'MonDrink', unite:'btl', prix_cible:14.90, seuil_alerte:10 },
  { id:'fca_9', nom:'Chasselas Romand Obrist',  famille:'Boissons',fournisseur:'Obrist',   unite:'btl', prix_cible: 5.43, seuil_alerte:10 },
  { id:'fca_10',nom:'Aperol 100cl',     famille:'Boissons',        fournisseur:'MonDrink', unite:'btl', prix_cible:18.04, seuil_alerte:10 }
];

/* ─── Semaine de démonstration ──────────────────────────────── */
function _demoSemaine() {
  return {
    semaine: '2026-W23',
    debut: '01.06.2026',
    fin: '07.06.2026',
    ca_ht: 28000,
    stock_ouverture: { fca_1:8.5, fca_2:4.0, fca_3:2.1, fca_4:1.5, fca_5:3.2, fca_6:1.2, fca_7:2.0, fca_8:12, fca_9:36, fca_10:3 },
    achats:          { fca_1:12.0,fca_2:5.0, fca_3:3.5, fca_4:2.0, fca_5:6.0, fca_6:2.0, fca_7:3.0, fca_8:24, fca_9:48, fca_10:6 },
    achats_valeur:   { fca_1:12.0*34.90, fca_2:5.0*43.10, fca_3:3.5*37.34, fca_4:2.0*38.00, fca_5:6.0*13.75,
                       fca_6:2.0*42.00, fca_7:3.0*14.00, fca_8:24*14.90, fca_9:48*5.43, fca_10:6*18.04 },
    stock_fermeture: {},
    bls: []
  };
}

/* ─── Historique de démonstration ───────────────────────────── */
const DEMO_FC_HISTORIQUE = [
  { id:'fch_1', semaine:'2026-W22', debut:'25.05.2026', fin:'31.05.2026', ca_ht:26500, cout_total:7800, ratio:29.4, detail:[] },
  { id:'fch_2', semaine:'2026-W21', debut:'18.05.2026', fin:'24.05.2026', ca_ht:24800, cout_total:7688, ratio:31.0, detail:[] },
  { id:'fch_3', semaine:'2026-W20', debut:'11.05.2026', fin:'17.05.2026', ca_ht:27200, cout_total:7888, ratio:29.0, detail:[] },
  { id:'fch_4', semaine:'2026-W19', debut:'04.05.2026', fin:'10.05.2026', ca_ht:25600, cout_total:8140, ratio:31.8, detail:[] },
  { id:'fch_5', semaine:'2026-W18', debut:'27.04.2026', fin:'03.05.2026', ca_ht:29100, cout_total:8118, ratio:27.9, detail:[] },
  { id:'fch_6', semaine:'2026-W17', debut:'20.04.2026', fin:'26.04.2026', ca_ht:23400, cout_total:7254, ratio:31.0, detail:[] }
];

/* ─── Recette de démonstration ──────────────────────────────── */
const DEMO_RECIPE = {
  id: 'rec_demo',
  nom: 'Risotto aux bolets',
  categorie: 'Plat principal',
  portions: 10,
  ratio_cible: 30,
  prix_vente: 32,
  ingredients: [
    { name: 'Riz Carnaroli',                qty: 1.20, unit: 'kg', price:  8.50 },
    { name: 'Bolets frais',                 qty: 0.80, unit: 'kg', price: 38.00 },
    { name: 'Parmesan AOP 24 mois',         qty: 0.30, unit: 'kg', price: 42.00 },
    { name: 'Bouillon de volaille maison',  qty: 2.50, unit: 'L',  price:  3.20 },
    { name: 'Vin blanc Chasselas',          qty: 0.40, unit: 'L',  price: 18.00 },
    { name: 'Échalote',                     qty: 0.20, unit: 'kg', price:  6.50 },
    { name: 'Beurre AOP',                   qty: 0.15, unit: 'kg', price: 14.00 },
    { name: "Huile d'olive extra vierge",   qty: 0.05, unit: 'L',  price: 22.00 }
  ]
};

/* ─── Établissement & utilisateurs de démonstration ─────────── */
const DEMO_SETTINGS = {
  entreprise: {
    nom: 'Hôtel Bellerive', enseigne: 'Hôtel Bellerive · Vevey',
    adresse: 'Quai de Bellerive 12', ville: 'Vevey', npa: '1800', pays: 'Suisse',
    tva_number: 'CHE-123.456.789', telephone: '+41 21 944 00 00',
    email: 'info@hotelbellerive.ch', devise: 'CHF', langue: 'fr',
    target_food_cost: 30, target_bev_cost: 20
  },
  alertes: { prix_variation_seuil: 10, stock_zero: true, email_journalier: false }
};

const DEMO_USERS = [
  { id:'u1', nom:'Roduit', prenom:'Marc', role:'admin',
    email:'m.roduit@bellerive.ch', telephone:'+41 79 100 00 01',
    alertes:true, email_journalier:false, actif:true,
    modules:['recettes','achats','inventaire','flash_cost','parametres'],
    created_at: '2026-01-15T08:00:00.000Z' },
  { id:'u2', nom:'Dupont', prenom:'Jean', role:'chef',
    email:'j.dupont@bellerive.ch', telephone:'',
    alertes:false, email_journalier:false, actif:true,
    modules:['recettes','achats','inventaire','flash_cost'],
    created_at: '2026-01-15T08:00:00.000Z' }
];

const DEMO_CLIENT = {
  id: 'client_demo', nom: 'Hôtel Bellerive', enseigne: 'Hôtel Bellerive · Vevey',
  adresse: 'Quai de Bellerive 12', ville: 'Vevey', npa: '1800', pays: 'Suisse',
  telephone: '+41 21 944 00 00', email: 'info@hotelbellerive.ch',
  tva_number: 'CHE-123.456.789', devise: 'CHF', langue: 'fr', plan: 'pro',
  claude_api_key: '', quota_scans: 200, scans_utilises: 0,
  created_at: '2026-01-15T08:00:00.000Z'
};

/* ════════════════════════════════════════════════════════════
   Chargement / retrait du jeu de démo
   ════════════════════════════════════════════════════════════ */

function pharIsDemoMode() {
  try { return localStorage.getItem(DEMO_FLAG_LS) === '1'; } catch (e) { return false; }
}

/** Écrase toutes les données locales par le jeu de démonstration. */
function pharLoadDemoData() {
  const msg = 'Charger le jeu de démonstration ?\n\n'
    + '⚠ Toutes vos données actuelles (bulletins scannés, inventaire, '
    + 'semaines Flash Cost, recettes, paramètres) seront REMPLACÉES par '
    + 'des données fictives.\n\nCette action est irréversible.';
  if (typeof confirm === 'function' && !confirm(msg)) return;

  try {
    localStorage.setItem('phar_inventory_stores_v1', JSON.stringify({ food: DEMO_FOOD, bev: DEMO_BEV }));
    localStorage.setItem('phar_stock_movements_v1', JSON.stringify([]));
    localStorage.setItem('phar_bls_v1',             JSON.stringify([]));
    localStorage.setItem('phar_fournisseurs_v1',    JSON.stringify([]));
    localStorage.setItem('phar_fc_articles_v1',     JSON.stringify(DEMO_FC_ARTICLES));
    localStorage.setItem('phar_fc_semaine_v1',      JSON.stringify(_demoSemaine()));
    localStorage.setItem('phar_fc_historique_v1',   JSON.stringify(DEMO_FC_HISTORIQUE));
    localStorage.setItem('phar_fc_factures_v1',     JSON.stringify([]));
    localStorage.setItem('phar_recipes_v1',         JSON.stringify([DEMO_RECIPE]));
    localStorage.setItem('phar_settings_v1',        JSON.stringify(DEMO_SETTINGS));
    localStorage.setItem('phar_users_v1',           JSON.stringify(DEMO_USERS));
    localStorage.setItem('phar_clients_v1',         JSON.stringify([DEMO_CLIENT]));
    localStorage.setItem('phar_active_client_id_v1', DEMO_CLIENT.id);
    localStorage.setItem(DEMO_FLAG_LS, '1');
  } catch (e) {
    alert('Impossible d\'écrire dans le stockage local du navigateur.');
    return;
  }
  location.reload();
}

/** Efface toutes les données locales et repart d'une base vide. */
function pharResetAllData(skipConfirm) {
  const msg = 'Effacer toutes les données locales ?\n\n'
    + 'Bulletins scannés, inventaire, semaines Flash Cost, recettes, '
    + 'fournisseurs et paramètres seront supprimés définitivement.\n\n'
    + 'L\'application repartira vide.';
  if (!skipConfirm && typeof confirm === 'function' && !confirm(msg)) return;

  try {
    PHAR_ALL_LS_KEYS.forEach(k => localStorage.removeItem(k));
    localStorage.removeItem(DEMO_FLAG_LS);
  } catch (e) {}
  location.reload();
}

/** Bandeau permanent tant que le jeu de démo est actif. */
function pharRenderDemoBanner() {
  const host = document.getElementById('demo-banner-slot');
  if (!host) return;
  if (!pharIsDemoMode()) { host.innerHTML = ''; host.style.display = 'none'; return; }
  host.style.display = 'block';
  host.innerHTML = '<div class="demo-banner">'
    + '<strong>MODE DÉMO</strong>'
    + '<span>Les chiffres affichés proviennent d\'un jeu de données fictives, pas de votre établissement.</span>'
    + '<button class="btn btn-sm" onclick="pharResetAllData()">Repartir sur des données réelles</button>'
    + '</div>';
}

document.addEventListener('DOMContentLoaded', pharRenderDemoBanner);
