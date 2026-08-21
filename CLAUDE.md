# PHAR Cost Control — guide de travail

Plateforme SaaS de cost control F&B pour établissements hôteliers multi-points de vente, marché suisse.

## Documents de référence

| Document | Rôle |
|---|---|
| [`docs/SPEC-COST-CONTROL.md`](docs/SPEC-COST-CONTROL.md) | **Spécification technique v1.0 — fait foi.** Formules, invariants, modèle de données, phasage. |
| [`ROADMAP.md`](ROADMAP.md) | Étapes ordonnées E-01 → E-53. L'ordre est l'ordre d'exécution. |
| [`DECISIONS.md`](DECISIONS.md) | Décisions ouvertes (D-01 → D-06) et divergences assumées vis-à-vis de la spec. |

**Règle de préséance** : en cas de contradiction entre la spec et une décision d'implémentation antérieure, la spec fait foi. Toute divergence délibérée est consignée dans `DECISIONS.md`, jamais laissée implicite dans le code.

## Avant d'implémenter

1. Lire l'étape correspondante dans `ROADMAP.md` — les dépendances y sont explicites.
2. Vérifier que les décisions bloquantes de cette étape sont tranchées dans `DECISIONS.md`. Si non : **ne pas décider seul**, remonter à Sam.
3. Vérifier les invariants (spec §3) touchés par le changement. Un invariant touché = un test de non-régression exigé.

## Règles non négociables

- **Ordre des phases** : P1 (socle) → P2 (stock) → P3 (achats) avant tout le reste (spec §11).
- **Formules normatives** (spec §2) : CUMP, rendement, food cost, écarts, décomposition d'écart, prix de vente. Toute implémentation qui s'en écarte est un bug, pas une variante.
- **Aucune quantité nue** : toute quantité porte son unité, tout prix porte sa devise (INV-2, INV-3).
- **Journal append-only** : aucun `UPDATE` ni `DELETE` sur `mouvement_stock`. Correction = contre-passation (INV-1).
- **Aucune conversion implicite** : le moteur d'unités retourne une erreur explicite, jamais une valeur approximative. Pas de `try/catch` silencieux (spec §5).
- **Aucun taux de TVA en dur** : porté par le point de vente, surcharge possible par article (spec §2.6).
- **Isolation multi-tenant** : aucun accès aux données ne peut omettre le filtre `etablissement_id` (INV-8).
- **Aucune ligne importée ne disparaît** : rattachée, ou en file d'exception (INV-4).

## Hors périmètre

Ne jamais implémenter sans validation explicite : caisse/POS, RH et planning, réservation, HACCP complet, comptabilité générale, paiement fournisseur.

## État du code

Le dépôt contient aujourd'hui un **prototype** (SPA `index.html` + `flash-cost.js` + `parametres.js` + `clients.js`, persistance `localStorage`) et un proxy Anthropic (`backend-proxy/`, Cloudflare Worker). L'écart avec la cible est détaillé en tête de `ROADMAP.md`. Le prototype sert de référence d'écrans et de règles métier validées terrain ; il est remplacé module par module, il n'est pas étendu.
