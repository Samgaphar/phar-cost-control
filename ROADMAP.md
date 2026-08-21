# PHAR Cost Control — Feuille de route

> Source de vérité fonctionnelle : [`docs/SPEC-COST-CONTROL.md`](docs/SPEC-COST-CONTROL.md) (v1.0).
> Décisions ouvertes et divergences assumées : [`DECISIONS.md`](DECISIONS.md).
> Ce document ordonne les étapes. **L'ordre des étapes E-01 → E-40 est l'ordre d'exécution.**

---

## 0. Point de départ — ce qui existe aujourd'hui

| Élément | Fichier | Nature | Statut vs spec |
|---|---|---|---|
| SPA mono-fichier (nav, dashboard, écrans) | `index.html` (~6 000 l.) | HTML + CSS + JS inline | Prototype UI, à conserver comme référence d'ergonomie |
| Flash Cost hebdo (articles leaders, scan BL, stock clôture, calcul, historique) | `flash-cost.js` (~3 700 l.) | JS + `localStorage` | Couvre partiellement Achats + Inventaire, **hors modèle spec** |
| Paramètres (entreprise, utilisateurs, catégories) | `parametres.js` (~1 900 l.) | JS + `localStorage` | À remplacer par référentiel + multi-tenant |
| Multi-clients | `clients.js` | Sélecteur local | Ne satisfait pas INV-8 (isolation) |
| Proxy Anthropic | `backend-proxy/` | Cloudflare Worker | Base réutilisable pour l'extraction LLM (P3) |

**Écarts structurants à combler :**
1. Aucune persistance serveur — tout est en `localStorage`, ce que la spec §4 exclut explicitement pour le journal de stock et le rapprochement.
2. Aucun journal de mouvements ni CUMP — le Flash Cost calcule un ratio hebdo sans valorisation traçable (INV-1, INV-5 non tenus).
3. Aucun moteur d'unités isolé ni testé (spec §5).
4. Aucune isolation multi-tenant réelle (INV-8).
5. Aucune suite de tests automatisés (spec §10).

> **Le prototype n'est pas jeté** : il sert de spécification d'écrans et de source des règles métier déjà validées terrain (catégorisation, TVA alcool, flux de scan BL). Il est progressivement remplacé module par module.

---

## 1. Ordre d'exécution

### Étape 0 — Débloquer (avant toute ligne de code produit)

Ces six arbitrages conditionnent l'architecture. Tant qu'ils ne sont pas tranchés, E-04 et suivants sont bloqués.

| # | Étape | Livrable | Bloque |
|---|---|---|---|
| **E-01** | Arbitrer les 6 décisions de la spec §12 avec Sam | `DECISIONS.md` renseigné (D-01 → D-06) | Tout P1 |
| **E-02** | Figer la structure de repo retenue (D-03) et créer le squelette | Arborescence + outillage (build, lint, test runner) | E-04 |
| **E-03** | Mettre en place la CI (tests + lint sur chaque push) | Pipeline vert sur un test factice | E-05 |

> D-01 (scope de valorisation) et D-02 (stockage) sont les deux plus coûteux à changer après coup. D-04, D-05, D-06 peuvent être tranchés plus tard mais avant respectivement E-31, E-27, E-34.

---

### P1 — Socle (référentiel + moteur d'unités)

Critère de sortie spec : *un fichier fournisseur réel importé, 100% des lignes rattachées ou en exception explicite.*

| # | Étape | Détail | Tests exigés |
|---|---|---|---|
| **E-04** | Schéma référentiel | `unite`, `famille`, `article`, `fournisseur`, `article_fournisseur`, `prix_article` (spec §4.1) + migrations versionnées | Migration up/down rejouable |
| **E-05** | **Moteur d'unités** — package isolé | API `convertir(qte, src, cible, contexte) → Result<qte, ErreurConversion>` ; erreurs `DIMENSION_INCOMPATIBLE`, `FACTEUR_ABSENT`, `UNITE_INCONNUE`, `QUANTITE_INVALIDE` ; densité portée par l'article ; arithmétique décimale exacte (pas de flottant) | **≥ 30 cas**, dont les 10 cas du §5 |
| **E-06** | Normalisation des prix (INV-2) | `prix_normalise` = CHF par `unite_reference_prix`, calculé à l'écriture, devise toujours stockée | Cas multi-conditionnements + devise ≠ CHF |
| **E-07** | Conditionnements datés | `valide_du` / `valide_au` sur `article_fournisseur` ; toute conversion résout le facteur **à la date du mouvement** | Cas « conditionnement modifié en cours d'année » |
| **E-08** | Isolation multi-tenant (INV-8) | `etablissement_id` obligatoire au niveau de la couche d'accès ; aucun accès ne peut l'omettre | Test négatif : requête sans contexte → refus |
| **E-09** | Import `BASE_ARTICLES` | Chargement du référentiel PHAR, attribution des `code_pivot` | Import idempotent (rejeu sans doublon) |
| **E-10** | Fuzzy matching libellé fournisseur → article | Score normalisé 0..1, seuil 0,90, retour des 3 meilleurs candidats sous le seuil | Jeu de libellés réels issus du prototype |
| **E-11** | Reprise des données du prototype | Migration `phar_fc_articles_v1`, catégories custom, fournisseurs → référentiel | Rapport de reprise : 0 ligne perdue (INV-4) |
| **E-12** | **Recette P1** | Import d'un fichier fournisseur réel de bout en bout | 100% des lignes rattachées ou en exception explicite |

---

### P2 — Stock (journal + CUMP)

Critère de sortie spec : *rejeu 3 mois, CUMP à < 0,5% du calcul manuel.*

| # | Étape | Détail | Tests exigés |
|---|---|---|---|
| **E-13** | Schéma `point_de_vente` + `mouvement_stock` (spec §4.2) | Index `idx_mvt_recalc`, `created_by`/`created_at` obligatoires (INV-7) | Schéma conforme |
| **E-14** | Append-only (INV-1) | Blocage `UPDATE`/`DELETE` par trigger **et** par couche d'accès | Test négatif : tentative d'UPDATE → refus |
| **E-15** | Contre-passation | Mouvement inverse lié via `mouvement_annule_id`, seul mécanisme de correction | Contre-passation d'une entrée, d'une sortie |
| **E-16** | **Moteur CUMP** (spec §2.1) | Recalcul à l'entrée uniquement ; sorties valorisées au CUMP à date ; division par zéro → CUMP inchangé ; scope selon D-01 | Cas nominal, qté totale = 0, sorties multiples |
| **E-17** | Stock négatif | Autorisé, flag `stock_negatif`, CUMP gelé jusqu'au retour en positif | Séquence livraison-après-conso |
| **E-18** | Rejouabilité intégrale (INV-5) | Fonction de recalcul complet du CUMP depuis l'origine du journal | Rejeu = état courant, à la 6ᵉ décimale |
| **E-19** | Transferts inter-POS | `transfert_sortant` / `transfert_entrant` appariés, jamais l'un sans l'autre | Transfert Cuisine → Bar |
| **E-20** | Typologie des sorties | `sortie_vente`, `casse`, `offert`, `staff` distinctes et agrégeables séparément (prépare §2.3 et §2.5) | Ventilation par type sur une période |
| **E-21** | Écarts d'inventaire (spec §2.4) | `inventaire` + `ligne_inventaire`, qté théorique figée à l'ouverture, ajustement = mouvement `ajustement_inventaire` | Nominal, stock négatif, article sans mouvement, contre-passation |
| **E-22** | **Recette P2** | Rejeu de 3 mois de données réelles d'un client pilote | Écart < 0,5% vs calcul manuel de référence |

---

### P3 — Achats (ingestion)

Critère de sortie spec : *BL 25 lignes en < 3 min, ≤ 5 exceptions.*

| # | Étape | Détail | Tests exigés |
|---|---|---|---|
| **E-23** | Schéma `document_achat` + `ligne_document_achat` (spec §4.3) | Hash de fichier unique par établissement | Déduplication : même fichier 2× → rejet |
| **E-24** | **Fixtures d'ingestion** (spec §10, 5 BL réels) | À constituer **avant** le développement de l'extraction | Les 5 fixtures versionnées, anonymisées |
| **E-25** | Réception multi-canal | Email dédié, upload, photo mobile → hash → classification | Idempotence sur rejeu |
| **E-26** | Extraction LLM à schéma strict (spec §6.2) | Via `backend-proxy` durci ; validation de schéma en **rejet dur**, jamais de parsing tolérant | Réponse non conforme → document en exception |
| **E-27** | Routage (spec §6.3) | Seuils confiance 0,85 / fuzzy 0,90 / total HT ±0,02 CHF / écart prix 10% paramétrable / manuscrit → exception systématique | Un test par ligne du tableau §6.3 |
| **E-28** | Alerte prix contractuel | Écart vs prix d'appel d'offres : alerte prioritaire non désactivable | Cas contractuel dépassé |
| **E-29** | **File d'exception** — écran de premier plan (spec §6.4) | Image + champs côte à côte, saisie 100% clavier, rattachement qui enrichit le matching | Parcours complet sans souris |
| **E-30** | Validation → mouvements de stock | Une ligne validée génère l'entrée valorisée correspondante ; aucune ligne ne disparaît (INV-4) | Ligne validée ⇒ mouvement ; ligne rejetée ⇒ tracée |
| **E-31** | **Recette P3** | BL réel de 25 lignes traité par un utilisateur métier | < 3 min, ≤ 5 exceptions |

---

### P4 — Recettes + Dashboard

Critère de sortie spec : *rapport mensuel généré sans retouche Excel.*

| # | Étape | Détail | Tests exigés |
|---|---|---|---|
| **E-32** | Fiches techniques versionnées (spec §4.4, INV-6) | `fiche_technique` / `_version` / `ligne_` ; coût matière figé à la publication | Le calcul d'octobre utilise la version d'octobre |
| **E-33** | Imbrication + anti-cycle | Sous-recettes, profondeur max 5, détection de cycle à l'enregistrement | 3 niveaux, cycle direct, cycle indirect |
| **E-34** | Rendements | Taux porté par l'article, surcharge par ligne de fiche (spec §2.2) | Coût net = prix ÷ rendement |
| **E-35** | Prix de vente suggéré + TVA (spec §2.6) | Taux porté par le point de vente, surcharge par article, **jamais en dur** | 8,1% / 2,6% / 3,8% par contexte |
| **E-36** | Food cost & beverage cost (spec §2.3) | Conso réelle, isolation des sorties non-vente, ratios sur CA HT | Convention D-05 appliquée et affichée |
| **E-37** | **Décomposition d'écart** (spec §2.5) | Écart prix / quantité / résiduel ; ventilation sorties identifiées vs démarque inconnue | Somme des composantes = écart total à 0,01 CHF |
| **E-38** | Dashboard consolidé | Food/beverage cost, écarts, tendances | < 5 s sur 12 mois glissants |
| **E-39** | Export Excel natif structuré | Pas de PDF en format primaire (spec §9) | Rapport mensuel régénéré à l'identique |
| **E-40** | **Recette P4** | Rapport mensuel d'un client pilote | Zéro retouche Excel manuelle |

---

### P5 — Marketplace / Price Intelligence

Conditionné à D-06 (cadrage juridique). Ne pas activer le flux montant en production avant validation.

| # | Étape |
|---|---|
| **E-41** | Flag `consent_pooling` par établissement, vérifié avant tout flux montant |
| **E-42** | Flux montant : point de prix anonymisé (`code_pivot`, fournisseur, `prix_normalise`, date, région, `volume_bucket`) |
| **E-43** | k-anonymat : aucune agrégation publiée si `COUNT(DISTINCT etablissement) < 5` |
| **E-44** | Flux descendant : catalogues et prix adjugés → `prix_article` (`source='catalogue'|'appel_offres'`) |
| **E-45** | Recalcul des fiches impactées + alerte listant les plats concernés |
| **E-46** | Traçabilité et purge à la demande de tout point de prix versé |
| **E-47** | **Recette P5** : point de prix versé, benchmark restitué, k-anonymat vérifié |

---

### P6 — Terrain (app inventaire offline)

Critère éliminatoire : offline-first.

| # | Étape |
|---|---|
| **E-48** | Préchargement complet du référentiel de l'établissement |
| **E-49** | Saisie 100% hors ligne, scan code-barres inclus |
| **E-50** | Persistance locale **à chaque champ**, pas à la validation d'écran |
| **E-51** | Synchronisation différée à résolution de conflit déterministe (plus récent par `saisi_offline_at`, l'autre conservé et signalé) |
| **E-52** | Ordre de comptage par zone (shelf-to-sheet), mémorisé entre inventaires |
| **E-53** | **Recette P6** : inventaire complet multi-zones sans réseau, zéro perte à la synchro |

---

## 2. Règles d'ordonnancement

1. **P1 → P2 → P3 est non négociable** (spec §11). Construire l'ingestion avant le socle produit des données non exploitables.
2. **E-05 (moteur d'unités) avant tout calcul de valeur.** C'est la dépendance de E-06, E-16, E-30, E-34.
3. **E-24 (fixtures) avant E-26 (extraction).** On n'écrit pas d'extraction sans corpus de référence.
4. **Un invariant = un test de non-régression** (spec §3). Une étape qui touche un invariant n'est pas terminée sans son test.
5. **P4 dépend de P2** pour le CUMP réel et de P3 pour les prix d'achat réels. P5 et P6 sont parallélisables entre eux une fois P4 livré.

## 3. Ce qui n'est pas au programme

Hors périmètre spec §1, à ne jamais implémenter sans validation explicite : caisse/POS, RH et planning, réservation, HACCP complet, comptabilité générale, paiement fournisseur.
