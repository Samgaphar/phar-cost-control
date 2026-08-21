# Journal des décisions — PHAR Cost Control

Deux sections :
- **Décisions ouvertes** — à trancher avec Sam (spec §12). Statut `OUVERTE` tant que non arbitrée.
- **Divergences assumées** — écarts délibérés vis-à-vis de `docs/SPEC-COST-CONTROL.md`, qui fait foi par défaut.

Format d'une décision tranchée : date, arbitrage, motif, conséquences, étapes de la roadmap impactées.

---

## Décisions ouvertes

### D-01 — Scope de valorisation : CUMP par établissement ou par point de vente ?
- **Statut** : OUVERTE — bloque E-16
- **Enjeu** : détermine la clé d'agrégation du journal et du CUMP. Changer après coup impose un recalcul complet et une migration du journal.
- **Options** : `valorisation_scope = etablissement` (plus simple, un seul CUMP par article) | `= point_de_vente` (reflète des coûts réels différenciés Cuisine/Bar, mais multiplie les transferts valorisés)
- **Décision** : _à compléter_

### D-02 — Stockage : Cloudflare D1 ou PostgreSQL managé ?
- **Statut** : OUVERTE — bloque E-02, E-04
- **Enjeu** : la spec §4 exclut le clé-valeur pour le journal et le rapprochement. D1 est cohérent avec le proxy Cloudflare déjà en place ; Postgres offre `NUMERIC` natif, triggers et contraintes plus riches (INV-1, INV-8).
- **Point d'attention** : hébergement Suisse ou UE exigé (spec §9, nLPD + RGPD).
- **Décision** : _à compléter_

### D-03 — Structure du repo : monorepo avec `core-referentiel` partagé, ou packages publiés ?
- **Statut** : OUVERTE — bloque E-02
- **Enjeu** : le moteur d'unités et le référentiel sont partagés avec la Marketplace (spec §5, §8).
- **Décision** : _à compléter_

### D-04 — Liaison POS (Simphony) : en P4 ou reportée en P7 ?
- **Statut** : OUVERTE — à trancher avant E-31
- **Enjeu** : sans flux POS, la conso théorique (spec §2.3) est saisie manuellement et la décomposition d'écart (E-37) perd sa base automatique. `code_pos` est déjà prévu sur `fiche_technique`.
- **Décision** : _à compléter_

### D-05 — Sorties non-vente : incluses ou exclues du food cost affiché par défaut ?
- **Statut** : OUVERTE — à trancher avant E-36
- **Enjeu** : convention client, impacte **tous** les rapports. Doit être un paramètre par établissement, et la convention retenue doit être affichée sur chaque rapport.
- **Décision** : _à compléter_

### D-06 — Flux montant Marketplace : conditions d'activation
- **Statut** : OUVERTE — bloque toute P5 en production
- **Enjeu** : cadrage juridique (nLPD/RGPD) à valider avant activation. Contraintes techniques bloquantes déjà spécifiées : `consent_pooling`, k-anonymat ≥ 5, réciprocité, traçabilité purgeable (spec §8).
- **Décision** : _à compléter_

---

## Divergences assumées

### DIV-01 — Le prototype actuel persiste en `localStorage`
- **Constat** : `flash-cost.js`, `parametres.js` et `clients.js` stockent tout en `localStorage` (clés `phar_*`). La spec §4 exclut explicitement le stockage clé-valeur pour le journal de stock et le rapprochement, et INV-8 (isolation multi-tenant) n'est pas satisfait par un sélecteur de client côté navigateur.
- **Statut** : divergence **temporaire et non extensible**. Le prototype reste en service pour les clients pilotes et sert de référence d'écrans, mais aucune nouvelle entité de la spec ne doit être ajoutée en `localStorage`.
- **Résorption** : E-11 (reprise des données) puis remplacement module par module selon la roadmap.

### DIV-02 — Un Worker Cloudflare par hôtel, sans gestion multi-clients applicative
- **Constat** : `backend-proxy/README.md` documente un déploiement par établissement, chacun avec sa propre clé Anthropic, plutôt qu'un multi-tenant applicatif.
- **Statut** : acceptable en phase pilote (isolation par déploiement, donc de fait conforme à l'intention d'INV-8), non tenable à l'échelle.
- **Résorption** : E-08 (isolation multi-tenant au niveau requête) puis consolidation du proxy en E-26.

### DIV-03 — Clé API Anthropic à renouveler manuellement tous les 30 jours
- **Constat** : expiration silencieuse documentée dans `backend-proxy/README.md` ; le scan IA s'arrête sans alerte.
- **Statut** : risque opérationnel connu.
- **Résorption** : à traiter en E-26 (supervision de l'extraction, alerte sur échec d'authentification).
