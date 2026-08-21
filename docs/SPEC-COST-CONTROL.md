# PHAR Cost Control — Spécification technique

> **Statut** : v1.0 — spécification de référence
> **Usage** : document source pour l'implémentation. À référencer depuis `CLAUDE.md`.
> **Règle** : en cas de contradiction entre ce document et une décision d'implémentation antérieure, ce document fait foi. Toute divergence assumée doit être documentée dans `DECISIONS.md`.

---

## 1. Périmètre

Plateforme SaaS de cost control F&B pour établissements hôteliers multi-points de vente, marché suisse.

**Cinq modules :**

| Module | Fonction |
|---|---|
| Référentiel | Articles, unités, conditionnements, fournisseurs — socle transverse |
| Achats | Ingestion BL/factures, extraction, rapprochement, contrôle d'écart prix |
| Recettes | Fiches techniques multi-niveaux, food cost, prix de vente suggéré |
| Inventaire | Journal de mouvements, CUMP, écarts théorique/physique |
| Dashboard | Food cost %, beverage cost %, décomposition d'écart, reporting |
| Comparateur | Prix multi-fournisseurs, appels d'offres, suivi des prix contractuels |

**Hors périmètre — ne jamais implémenter sans validation explicite :**
caisse/POS, RH et planning, réservation, HACCP complet, comptabilité générale, paiement fournisseur.

---

## 2. Glossaire métier et formules

Ces formules sont normatives. Toute implémentation qui s'en écarte est un bug.

### 2.1 CUMP — Coût Unitaire Moyen Pondéré

Méthode de valorisation par défaut. Recalculé à **chaque entrée en stock**, jamais à la sortie.

```
CUMP_après_entrée = (Valeur_stock_avant + Qté_entrée × PU_entrée)
                    / (Qté_stock_avant + Qté_entrée)
```

Règles :
- Les **sorties** sont valorisées au CUMP en vigueur à la date du mouvement et ne modifient pas le CUMP.
- Si `Qté_stock_avant + Qté_entrée = 0`, le CUMP reste inchangé (ne jamais diviser par zéro, ne jamais remettre à 0).
- Un stock négatif est **autorisé** en base (livraison saisie après consommation) mais doit lever un flag `stock_negatif` visible dans l'UI. Le CUMP est alors gelé jusqu'à retour en positif.
- Le CUMP est calculé **par article et par point de vente** si le paramétrage client est en valorisation décentralisée, sinon au niveau établissement. Paramètre : `valorisation_scope ∈ {etablissement, point_de_vente}`.
- Précision de stockage : `NUMERIC(14,6)` sur les CUMP et prix unitaires, `NUMERIC(14,3)` sur les quantités. Arrondi à 2 décimales **uniquement à l'affichage**.

**Alternative FIFO** : à prévoir dans le modèle (`methode_valorisation ∈ {CUMP, FIFO}`) mais **CUMP seul est implémenté en v1**. Le journal de mouvements doit permettre un recalcul FIFO ultérieur sans migration.

### 2.2 Rendement et coût net

```
Coût_unité_utilisable = Prix_achat_unité_brute / Taux_rendement
```

Exemple : filet de bœuf à 48 CHF/kg brut, rendement 78% après parage → coût matière réel 61,54 CHF/kg utilisable.

Le taux de rendement est porté par l'**article**, avec surcharge possible au niveau **ligne de fiche technique** (un même produit peut avoir deux rendements selon la préparation).

### 2.3 Food cost et beverage cost

**Coût matière réel consommé sur une période :**
```
Conso_réelle = Stock_initial + Achats + Transferts_entrants
               − Transferts_sortants − Stock_final
```
Les sorties identifiées (casse, offert, staff food, banquet interne) sont **isolées** et non incluses dans la conso vendue :
```
Conso_vendue = Conso_réelle − Sorties_identifiées_non_vente
```

**Coût matière théorique :**
```
Conso_théorique = Σ (Qté_vendue_article_POS × Coût_fiche_technique_à_date)
```

**Ratios :**
```
Food cost %      = Conso_vendue_food / CA_HT_food × 100
Beverage cost %  = Conso_vendue_beverage / CA_HT_beverage × 100
```

Le CA est toujours **hors taxes**. La ventilation food/beverage se fait par famille d'article, paramétrable par client.

### 2.4 Écarts d'inventaire

```
Écart_quantité = Stock_physique_compté − Stock_théorique
Écart_valeur   = Écart_quantité × CUMP_à_date
Écart_%        = Écart_valeur / Valeur_stock_théorique × 100
```

Un écart **négatif** = manquant (démarque). Un écart **positif** = surplus (souvent une erreur de saisie amont, à traiter comme une anomalie et non comme un gain).

### 2.5 Décomposition de l'écart de coût matière

C'est le livrable analytique différenciant. Écart total = réel − théorique, décomposé en trois blocs :

```
Écart_prix     = Σ Qté_réelle_consommée × (PU_réel_CUMP − PU_standard_fiche)
Écart_quantité = Σ (Qté_réelle_consommée − Qté_théorique) × PU_standard_fiche
Écart_résiduel = Écart_total − Écart_prix − Écart_quantité
```

L'`Écart_quantité` est ensuite ventilé entre :
- **sorties identifiées** (casse, offert, staff) — connues et tracées
- **démarque inconnue** — le reste, qui est l'indicateur de pilotage réel

Le `PU_standard_fiche` est le prix figé à la version de la fiche technique en vigueur sur la période.

### 2.6 Prix de vente suggéré

```
PV_HT  = Coût_matière_recette / Ratio_cible
PV_TTC = PV_HT × (1 + Taux_TVA)
```

**TVA suisse** (à vérifier annuellement, valeurs en vigueur depuis 01.01.2024) :
| Contexte | Taux |
|---|---|
| Restauration sur place | 8,1% (taux normal) |
| Vente à l'emporter / denrées | 2,6% (taux réduit) |
| Hébergement | 3,8% (taux spécial) |

Le taux est porté par le **point de vente** avec surcharge possible par article. Ne jamais coder un taux en dur.

---

## 3. Invariants systèmes

Règles absolues. Un test de non-régression doit exister pour chacune.

| # | Invariant |
|---|---|
| INV-1 | Un mouvement de stock validé n'est **jamais** modifié ni supprimé. Correction = contre-passation par un mouvement inverse lié. |
| INV-2 | Tout prix est stocké **avec sa devise** (CHF par défaut) et **normalisé** en CHF par unité de référence (kg, L, pce). |
| INV-3 | Toute quantité est stockée **avec son unité** et le facteur de conversion appliqué. Jamais de nombre nu. |
| INV-4 | Aucune ligne de document importé ne disparaît silencieusement : elle est rattachée, ou elle est en file d'exception. |
| INV-5 | Le CUMP à toute date est **recalculable intégralement** en rejouant le journal de mouvements depuis l'origine. |
| INV-6 | Une fiche technique est **versionnée** : le calcul d'octobre utilise la version d'octobre. |
| INV-7 | Toute écriture est horodatée (`created_at`) et attribuée (`created_by`). Le journal d'audit est append-only. |
| INV-8 | Aucune donnée d'un établissement n'est lisible depuis le contexte d'un autre établissement (isolation multi-tenant stricte au niveau requête). |

---

## 4. Modèle de données

Cible : PostgreSQL ou Cloudflare D1. Le stockage clé-valeur est **inadapté** au journal de stock et au rapprochement — ne pas l'utiliser pour ces entités.

### 4.1 Référentiel

```sql
-- Unités de mesure canoniques
CREATE TABLE unite (
  code            TEXT PRIMARY KEY,          -- 'kg','g','l','ml','pce'
  dimension       TEXT NOT NULL,             -- 'masse','volume','comptage'
  facteur_base    NUMERIC(14,6) NOT NULL     -- vers l'unité de base de la dimension
);

-- Article pivot PHAR — clé de voûte, partagé avec la Marketplace
CREATE TABLE article (
  id                  UUID PRIMARY KEY,
  code_pivot          TEXT UNIQUE NOT NULL,  -- code PHAR stable, partagé Marketplace
  libelle             TEXT NOT NULL,
  famille_id          UUID REFERENCES famille(id),
  categorie_cout      TEXT NOT NULL,         -- 'food' | 'beverage' | 'autre'
  unite_stock         TEXT NOT NULL REFERENCES unite(code),
  unite_reference_prix TEXT NOT NULL REFERENCES unite(code), -- pour la normalisation
  taux_rendement      NUMERIC(5,4) DEFAULT 1.0 CHECK (taux_rendement > 0 AND taux_rendement <= 1),
  actif               BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE fournisseur (
  id          UUID PRIMARY KEY,
  nom         TEXT NOT NULL,
  etablissement_id UUID,                     -- NULL = fournisseur global PHAR
  actif       BOOLEAN DEFAULT TRUE
);

-- Rattachement article ↔ référence fournisseur (1 article = n références)
CREATE TABLE article_fournisseur (
  id                  UUID PRIMARY KEY,
  article_id          UUID NOT NULL REFERENCES article(id),
  fournisseur_id      UUID NOT NULL REFERENCES fournisseur(id),
  reference_fourn     TEXT,
  libelle_fourn       TEXT NOT NULL,         -- libellé tel qu'imprimé sur le BL
  unite_achat         TEXT NOT NULL REFERENCES unite(code),
  facteur_conditionnement NUMERIC(14,6) NOT NULL, -- 1 unité_achat = n unite_stock
  valide_du           DATE NOT NULL,
  valide_au           DATE,                  -- NULL = en cours
  UNIQUE (fournisseur_id, reference_fourn, valide_du)
);

-- Historique de prix, alimente aussi la Marketplace
CREATE TABLE prix_article (
  id                  UUID PRIMARY KEY,
  article_fournisseur_id UUID NOT NULL REFERENCES article_fournisseur(id),
  prix_unite_achat    NUMERIC(14,6) NOT NULL,
  prix_normalise      NUMERIC(14,6) NOT NULL, -- CHF par unite_reference_prix
  devise              TEXT NOT NULL DEFAULT 'CHF',
  source              TEXT NOT NULL,          -- 'catalogue'|'bl'|'facture'|'appel_offres'
  date_effet          DATE NOT NULL,
  document_id         UUID,                   -- traçabilité vers le BL source
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 4.2 Journal de stock

```sql
CREATE TABLE point_de_vente (
  id                UUID PRIMARY KEY,
  etablissement_id  UUID NOT NULL,
  nom               TEXT NOT NULL,           -- 'Cuisine', 'Bar', 'Buvette Nord'
  taux_tva_defaut   NUMERIC(4,3) NOT NULL
);

CREATE TABLE mouvement_stock (
  id                UUID PRIMARY KEY,
  etablissement_id  UUID NOT NULL,
  point_de_vente_id UUID NOT NULL REFERENCES point_de_vente(id),
  article_id        UUID NOT NULL REFERENCES article(id),
  type_mouvement    TEXT NOT NULL,
  -- 'entree_achat','sortie_vente','sortie_casse','sortie_offert',
  -- 'sortie_staff','transfert_sortant','transfert_entrant',
  -- 'ajustement_inventaire','contrepassation'
  quantite          NUMERIC(14,3) NOT NULL,  -- signée : + entrée, − sortie
  unite             TEXT NOT NULL REFERENCES unite(code),
  quantite_unite_stock NUMERIC(14,3) NOT NULL, -- après conversion
  pu_valorisation   NUMERIC(14,6) NOT NULL,  -- PU réel si entrée, CUMP si sortie
  valeur            NUMERIC(14,2) NOT NULL,
  cump_apres        NUMERIC(14,6) NOT NULL,  -- snapshot après application
  date_mouvement    DATE NOT NULL,
  document_id       UUID,
  mouvement_annule_id UUID REFERENCES mouvement_stock(id), -- contre-passation
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID NOT NULL
);
-- INV-1 : aucun UPDATE ni DELETE autorisé sur cette table.
-- À protéger par trigger ou par convention de couche d'accès.

CREATE INDEX idx_mvt_recalc
  ON mouvement_stock (article_id, point_de_vente_id, date_mouvement, created_at);
```

### 4.3 Achats

```sql
CREATE TABLE document_achat (
  id                UUID PRIMARY KEY,
  etablissement_id  UUID NOT NULL,
  fournisseur_id    UUID REFERENCES fournisseur(id),
  type_document     TEXT NOT NULL,           -- 'bl'|'facture'|'avoir'
  numero            TEXT,
  date_document     DATE,
  montant_ht        NUMERIC(14,2),
  montant_tva       NUMERIC(14,2),
  montant_ttc       NUMERIC(14,2),
  statut            TEXT NOT NULL,
  -- 'recu','extrait','en_exception','valide','comptabilise'
  canal_reception   TEXT NOT NULL,           -- 'email'|'upload'|'photo_mobile'
  fichier_uri       TEXT NOT NULL,
  hash_fichier      TEXT NOT NULL,           -- déduplication
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (etablissement_id, hash_fichier)
);

CREATE TABLE ligne_document_achat (
  id                UUID PRIMARY KEY,
  document_id       UUID NOT NULL REFERENCES document_achat(id),
  numero_ligne      INT NOT NULL,
  libelle_brut      TEXT NOT NULL,           -- texte OCR non retouché
  reference_brute   TEXT,
  quantite_brute    NUMERIC(14,3),
  unite_brute       TEXT,
  pu_brut           NUMERIC(14,6),
  montant_brut      NUMERIC(14,2),
  article_fournisseur_id UUID REFERENCES article_fournisseur(id),
  score_confiance   NUMERIC(4,3),            -- 0..1, min des scores par champ
  statut_ligne      TEXT NOT NULL,           -- 'auto'|'exception'|'valide'|'rejetee'
  ecart_prix_pct    NUMERIC(6,3),            -- vs dernier prix connu
  mouvement_id      UUID REFERENCES mouvement_stock(id)
);
```

### 4.4 Recettes

```sql
CREATE TABLE fiche_technique (
  id                UUID PRIMARY KEY,
  etablissement_id  UUID NOT NULL,
  code              TEXT NOT NULL,
  libelle           TEXT NOT NULL,
  type_fiche        TEXT NOT NULL,           -- 'plat'|'sous_recette'|'menu'
  rendement_qte     NUMERIC(14,3) NOT NULL,  -- production de la fiche
  rendement_unite   TEXT NOT NULL REFERENCES unite(code),
  nb_portions       NUMERIC(8,2),
  code_pos          TEXT,                    -- clé de liaison Simphony
  UNIQUE (etablissement_id, code)
);

CREATE TABLE fiche_technique_version (
  id                UUID PRIMARY KEY,
  fiche_id          UUID NOT NULL REFERENCES fiche_technique(id),
  version           INT NOT NULL,
  valide_du         DATE NOT NULL,
  valide_au         DATE,                    -- NULL = version courante
  cout_matiere      NUMERIC(14,4),           -- calculé et figé à la publication
  prix_vente_ht     NUMERIC(14,2),
  ratio_cible       NUMERIC(5,4),
  UNIQUE (fiche_id, version)
);

CREATE TABLE ligne_fiche_technique (
  id                UUID PRIMARY KEY,
  version_id        UUID NOT NULL REFERENCES fiche_technique_version(id),
  article_id        UUID REFERENCES article(id),
  sous_fiche_id     UUID REFERENCES fiche_technique(id),
  quantite          NUMERIC(14,4) NOT NULL,
  unite             TEXT NOT NULL REFERENCES unite(code),
  taux_rendement_surcharge NUMERIC(5,4),     -- surcharge du rendement article
  CHECK ((article_id IS NOT NULL) <> (sous_fiche_id IS NOT NULL))
);
```

**Règle anti-cycle** : une sous-recette ne peut pas se référencer elle-même, directement ou indirectement. À vérifier par parcours de graphe à l'enregistrement, profondeur max 5 niveaux.

### 4.5 Inventaire

```sql
CREATE TABLE inventaire (
  id                UUID PRIMARY KEY,
  etablissement_id  UUID NOT NULL,
  point_de_vente_id UUID REFERENCES point_de_vente(id),
  date_inventaire   DATE NOT NULL,
  type_inventaire   TEXT NOT NULL,           -- 'complet'|'tournant'
  statut            TEXT NOT NULL,           -- 'brouillon'|'en_cours'|'cloture'
  cloture_at        TIMESTAMPTZ
);

CREATE TABLE ligne_inventaire (
  id                UUID PRIMARY KEY,
  inventaire_id     UUID NOT NULL REFERENCES inventaire(id),
  article_id        UUID NOT NULL REFERENCES article(id),
  zone              TEXT,
  qte_comptee       NUMERIC(14,3) NOT NULL,
  unite_comptage    TEXT NOT NULL REFERENCES unite(code),
  qte_theorique     NUMERIC(14,3) NOT NULL,  -- figée à l'ouverture
  cump_a_date       NUMERIC(14,6) NOT NULL,
  ecart_qte         NUMERIC(14,3) NOT NULL,
  ecart_valeur      NUMERIC(14,2) NOT NULL,
  saisi_offline_at  TIMESTAMPTZ,             -- horodatage terminal
  synchronise_at    TIMESTAMPTZ
);
```

---

## 5. Moteur d'unités — spécification détaillée

Brique la plus critique et la plus sous-estimée. À implémenter en package isolé, testé exhaustivement, partagé avec la Marketplace.

**Chaîne de conversion :**
```
unité_achat (colis, carton, pièce)
   ↓ facteur_conditionnement (article_fournisseur)
unité_stock (kg, L, pce)
   ↓ facteur_unite (table unite)
unité_recette (g, ml, pce)
   ↓ taux_rendement
unité_utilisable
```

**Contrat de l'API :**
```
convertir(quantite, unite_source, unite_cible, contexte) → Result<quantite, ErreurConversion>
```
- Retourne une **erreur explicite**, jamais une valeur approximative, si : dimensions incompatibles (kg → L sans densité), facteur de conditionnement absent, unité inconnue.
- Le passage masse ↔ volume nécessite une **densité** portée par l'article. En son absence : erreur.
- Aucune conversion implicite. Aucun `try/catch` silencieux.

**Cas de test obligatoires** (minimum 30) :
| Cas | Attendu |
|---|---|
| Colis de 6×1kg → kg | 6 kg |
| Carton 12×75cl → L | 9 L |
| 250 g depuis stock kg | 0,25 kg |
| Article pce sans poids → kg | Erreur `DIMENSION_INCOMPATIBLE` |
| Article avec densité 0,92 : 1 L huile → kg | 0,92 kg |
| Facteur de conditionnement manquant | Erreur `FACTEUR_ABSENT` |
| Rendement 0,78 sur 1 kg brut | 0,78 kg utilisable, coût ÷ 0,78 |
| Conditionnement modifié en cours d'année | Le mouvement du 12.03 utilise le facteur valide au 12.03 |
| Quantité négative | Erreur `QUANTITE_INVALIDE` sauf contre-passation |
| Arrondi : 1/3 kg × 3 | Retour exact à 1 kg (pas 0,999) |

---

## 6. Pipeline d'ingestion des bulletins

### 6.1 Étapes

```
Réception (email dédié | upload | photo mobile)
  → Hash + déduplication (rejet si hash déjà présent pour l'établissement)
  → Classification (BL | facture | avoir | illisible)
  → Extraction structurée (LLM, schéma strict)
  → Validation de schéma (rejet dur si non conforme)
  → Matching article (fuzzy sur libellé + référence)
  → Contrôle d'écart prix
  → Routage : auto | file d'exception
  → Validation → génération des mouvements de stock
```

### 6.2 Schéma d'extraction attendu

L'extraction doit retourner **exactement** cette structure. Toute réponse non conforme au schéma est rejetée et le document part en exception — jamais de parsing tolérant.

```json
{
  "type_document": "bl",
  "fournisseur_nom": "string|null",
  "numero_document": "string|null",
  "date_document": "YYYY-MM-DD|null",
  "devise": "CHF",
  "lignes": [
    {
      "numero_ligne": 1,
      "libelle": "string",
      "reference": "string|null",
      "quantite": 0.0,
      "unite_texte": "string",
      "conditionnement_texte": "string|null",
      "prix_unitaire": 0.0,
      "montant_ligne": 0.0,
      "confiance": {
        "libelle": 0.0,
        "quantite": 0.0,
        "prix_unitaire": 0.0,
        "montant_ligne": 0.0
      }
    }
  ],
  "totaux": {
    "montant_ht": 0.0,
    "montant_tva": 0.0,
    "montant_ttc": 0.0
  },
  "anomalies_detectees": ["string"]
}
```

### 6.3 Règles de routage

| Condition | Action |
|---|---|
| `min(confiance) < 0.85` sur un champ critique (quantité, PU, montant) | Ligne → exception |
| `Σ montants_lignes ≠ montant_ht` (tolérance 0,02 CHF) | Document → exception |
| Article non rattaché avec score fuzzy < 0,90 | Ligne → exception, proposition des 3 meilleurs candidats |
| Écart prix > seuil paramétrable (défaut 10%) vs dernier prix connu | Ligne validable mais **alerte** générée |
| Écart prix vs **prix contractuel** d'appel d'offres | Alerte prioritaire, non désactivable |
| Document manuscrit détecté | Extraction tentée, mais routage systématique en exception |

### 6.4 File d'exception

À traiter comme une **fonctionnalité de premier plan**, pas un fallback. C'est l'écran le plus utilisé après le dashboard.

- Vue image du document et champs extraits **côte à côte**
- Correction au clavier sans souris (saisie rapide)
- Le rattachement d'un libellé à un article **enrichit le modèle de matching** pour les fois suivantes
- Objectif de performance : BL de 25 lignes traité en < 3 minutes, ≤ 5 lignes en exception

---

## 7. Application inventaire — contraintes terrain

Critère éliminatoire : **offline-first**. Les comptages se font en chambre froide et en cave, sans réseau.

- Stockage local complet du référentiel de l'établissement avant descente en cave
- Saisie intégralement fonctionnelle hors ligne, y compris scan code-barres
- Synchronisation différée avec **résolution de conflit déterministe** : le comptage terrain fait foi sur le théorique ; en cas de double comptage du même article/zone, le plus récent par `saisi_offline_at` gagne, l'autre est conservé et signalé
- Ordre de comptage personnalisable par zone (shelf-to-sheet), mémorisé entre inventaires
- Aucune perte de saisie possible : persistance locale à chaque champ, pas à la validation d'écran

---

## 8. Jonction Marketplace / Price Intelligence

**Flux montant (Cost Control → Marketplace)**
- Chaque `ligne_document_achat` validée génère un point de prix : `code_pivot`, `fournisseur_id`, `prix_normalise`, `date`, `region`, `volume_bucket`
- Aucune donnée nominative d'établissement ne transite

**Flux descendant (Marketplace → Cost Control)**
- Catalogues et prix adjugés alimentent `prix_article` avec `source='catalogue'` ou `'appel_offres'`
- La publication d'un nouveau tarif déclenche le recalcul des fiches techniques impactées et une alerte listant les plats concernés

**Gouvernance — contraintes techniques bloquantes**
| Règle | Implémentation |
|---|---|
| Consentement explicite par établissement | Flag `consent_pooling` vérifié avant tout flux montant |
| k-anonymat | Aucune statistique agrégée publiée si `COUNT(DISTINCT etablissement) < 5` |
| Réciprocité | L'accès au benchmark est conditionné à `consent_pooling = true` |
| Traçabilité | Tout point de prix versé conserve un lien vers le document source, purgeable sur demande |

> Le cadrage juridique de ces règles doit être validé avant activation du flux montant en production.

---

## 9. Exigences non fonctionnelles

| Domaine | Exigence |
|---|---|
| Multi-tenant | Isolation stricte par `etablissement_id` au niveau requête. Aucun endpoint ne doit pouvoir omettre ce filtre. |
| Performance | < 2 s sur les écrans de saisie, < 5 s sur le dashboard consolidé 12 mois |
| Idempotence | Toute synchronisation (POS, catalogue, ingestion) est rejouable sans doublon ni corruption |
| Localisation | CHF par défaut, FR / DE / EN, formats de date et nombre suisses |
| Conformité | nLPD suisse + RGPD, hébergement des données en Suisse ou UE |
| Auditabilité | Journal append-only sur mouvements, valorisations, validations de documents |
| Réversibilité | Export complet des données client en self-service, formats ouverts (CSV + JSON) |
| Reporting | Export Excel natif structuré, pas de PDF comme format primaire |

---

## 10. Stratégie de test

**Priorité absolue sur la logique de calcul.** Le reste peut être plus souple.

| Surface | Exigence |
|---|---|
| Moteur d'unités | ≥ 30 cas, dont tous les cas d'erreur du §5 |
| CUMP | Rejeu de 3 mois de données réelles, écart < 0,5% vs calcul manuel de référence |
| Écarts d'inventaire | Cas nominal, stock négatif, article sans mouvement, contre-passation |
| Fiches techniques | Imbrication 3 niveaux, cycle détecté, recalcul après changement de prix, versionnage |
| Ingestion | 5 fixtures BL réels et hétérogènes (voir ci-dessous) |
| Décomposition d'écart | La somme des composantes doit égaler l'écart total, à 0,01 CHF près |

**Fixtures d'ingestion à constituer** — investissement le plus rentable du projet :
1. BL d'un gros distributeur, PDF propre multi-pages
2. BL manuscrit de fournisseur régional
3. BL avec avoir / retour de marchandise
4. Photo mobile mal cadrée et sous-exposée
5. Facture récapitulative regroupant plusieurs BL

---

## 11. Phasage

| Phase | Contenu | Critère de sortie |
|---|---|---|
| **P1** Socle | Référentiel, moteur d'unités, import BASE_ARTICLES, fuzzy matching | Un fichier fournisseur réel importé : 100% des lignes rattachées ou en exception explicite |
| **P2** Stock | Journal de mouvements, CUMP, écarts | Rejeu 3 mois, CUMP à < 0,5% du calcul manuel |
| **P3** Achats | Ingestion, extraction, exception, contrôle d'écart | BL 25 lignes en < 3 min, ≤ 5 exceptions |
| **P4** Recettes + Dashboard | Fiches multi-niveaux, food cost, décomposition d'écart, export | Rapport mensuel généré sans retouche Excel |
| **P5** Marketplace | Flux montant et descendant, benchmark anonymisé | Point de prix versé et benchmark restitué, k-anonymat vérifié |
| **P6** Terrain | App inventaire offline | Inventaire complet multi-zones sans réseau, zéro perte à la synchro |

**Ordre non négociable** : P1 avant P2 avant P3. Construire l'ingestion avant le socle produit des données non exploitables.

---

## 12. Décisions à trancher avant implémentation

À arbitrer avec Sam, ne pas décider seul :

1. **Scope de valorisation** — CUMP par établissement ou par point de vente ?
2. **Stockage** — D1 ou Postgres managé ?
3. **Structure repo** — monorepo avec `core-referentiel` partagé, ou packages publiés ?
4. **Liaison POS** — intégration Simphony en P4 ou reportée en P7 ?
5. **Sorties non-vente** — incluses ou exclues du food cost affiché par défaut ? (convention client, impacte tous les rapports)
6. **Flux montant Marketplace** — activation conditionnée au cadrage juridique
