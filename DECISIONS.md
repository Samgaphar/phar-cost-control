# Journal des décisions — PHAR Cost Control

Trois sections :
- **Décisions tranchées** — arbitrées avec Sam, avec leurs conséquences sur la roadmap.
- **Décisions ouvertes** — à trancher avec Sam (spec §12). Statut `OUVERTE` tant que non arbitrée.
- **Divergences assumées** — écarts délibérés vis-à-vis de `docs/SPEC-COST-CONTROL.md`, qui fait foi par défaut.

Format d'une décision tranchée : date, arbitrage, motif, conséquences, étapes de la roadmap impactées.

---

## Décisions tranchées

### D-01 — Scope de valorisation : CUMP par établissement — **TRANCHÉE le 21.08.2026**
- **Arbitrage** : `valorisation_scope = etablissement`. Un seul CUMP par article pour tout l'établissement, quel que soit le point de vente.
- **Motif** : simplicité de mise en œuvre et de lecture. Les coûts différenciés Cuisine/Bar ne justifient pas, en v1, la multiplication des transferts valorisés.
- **Conséquences** :
  - Le CUMP est calculé et stocké au niveau `etablissement_id`, pas `point_de_vente_id`.
  - Les transferts inter-POS (E-19) restent tracés pour le suivi des flux, mais **ne modifient pas le CUMP** : ils sortent et rentrent à la même valeur. Ils gardent leur utilité pour la conso par point de vente (§2.3) et la décomposition d'écart (§2.5).
  - Le champ `point_de_vente_id` reste obligatoire sur `mouvement_stock` : il porte l'analytique, pas la valorisation. Aucune perte d'information si le scope devait passer au point de vente plus tard.
  - Le paramètre `valorisation_scope` reste présent dans le modèle : la bascule ultérieure vers `point_de_vente` est possible par rejeu du journal (INV-5), sans migration de schéma.
- **Étapes impactées** : E-13 (schéma), **E-16 (moteur CUMP — débloquée)**, E-18 (rejouabilité), E-19 (transferts), E-21 (écarts d'inventaire).

---

## Décisions ouvertes

### D-02 — Stockage : Cloudflare D1 ou PostgreSQL managé ?
- **Statut** : OUVERTE — bloque E-02, E-04
- **Contrainte posée par Sam le 21.08.2026** : **hébergement en Suisse dans l'idéal** (à défaut, UE — spec §9, nLPD + RGPD).
- **Enjeu** : la spec §4 exclut le clé-valeur pour le journal et le rapprochement. D1 est cohérent avec le proxy Cloudflare déjà en place ; Postgres offre `NUMERIC` natif, triggers et contraintes plus riches (INV-1, INV-8).
- **Ce que la contrainte suisse implique** : à ma connaissance, D1 ne propose pas de région suisse — la localisation se choisit par zone large (type « Europe de l'Ouest »), ce qui satisfait « UE » mais pas « Suisse ». **À vérifier auprès de la documentation Cloudflare avant de trancher**, car si c'est confirmé, la contrainte élimine D1 et la décision se réduit au choix d'un hébergeur Postgres suisse.
- **Reste à trancher** : (a) confirmer que « Suisse » est exigé et non seulement souhaité ; (b) si oui, choisir l'hébergeur Postgres managé suisse (candidats à évaluer : Exoscale, Infomaniak, cloudscale.ch, Swisscom — offres et SLA à vérifier).
- **Point d'attention** : `NUMERIC(14,6)` sur les CUMP et prix (§2.1) est natif en Postgres. En D1 (SQLite), il n'existe pas de type décimal exact — l'arithmétique devrait être portée par l'application, ce qui fragilise les invariants de calcul.
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

### D-07 — Le CA et les ventes ne sont pas au modèle de données
- **Statut** : OUVERTE — orientation donnée par Sam le 21.08.2026, reste à cadrer. Bloque E-36, E-38 et le critère de sortie de P4.
- **Constat** : la spec §2.3 utilise `CA_HT_food` / `CA_HT_beverage` comme dénominateurs des deux KPI phares, et `Qté_vendue_article_POS` comme base de la conso théorique (donc de toute la décomposition d'écart §2.5). **Aucune des 14 tables du §4 ne stocke ni le CA ni les ventes.** `code_pos` sur `fiche_technique` référence une entité inexistante. Le prototype, lui, ne connaît qu'un champ `ca_ht` unique saisi à la main par semaine, au niveau établissement — les points de vente n'y portent que du stock.
- **Cause probable** : §1 met « caisse/POS » hors périmètre. Ne pas *être* une caisse n'implique pas de ne pas *ingérer* ses rapports. La ligne n'a jamais été tracée.
- **Orientation donnée par Sam** : reconstituer le CA **par catégorie et par point de vente** à partir des **rapports opérationnels de caisse** (Lightspeed, TCPOS, Simphony), par extraction automatisée — et non par intégration API d'un POS. Sam fournit un rapport de chaque système comme corpus de référence.
- **Ce que cela implique** :
  - Ingestion de rapports POS **explicitement validée** par Sam, ce qui lève l'ambiguïté du §1 : le hors-périmètre porte sur l'encaissement, pas sur la lecture des rapports.
  - Réutilisation du pipeline d'ingestion P3 (réception → hash → extraction à schéma strict → validation → file d'exception). Un rapport POS est un second type de document, pas un second pipeline.
  - Recouvre **D-04** : si le CA entre par les rapports, l'intégration Simphony n'est plus la voie d'alimentation par défaut et peut être reportée. D-04 est à retrancher à la lumière de D-07.
- **Reste à trancher** : périodicité des rapports (jour / semaine / mois) ; correspondance catégories POS → familles PHAR (par établissement, éditable) ; traitement du CA en TTC (voir ci-dessous) ; création ou non d'un rapport opérationnel par point de vente en P4.
- **Point de vigilance — TTC vs HT** : les rapports de caisse expriment souvent le CA en TTC, et le taux suisse diffère selon le contexte (8,1% sur place / 2,6% à l'emporter / 3,8% hébergement, §2.6). Si un rapport ne donne pas la ventilation par taux, **le CA HT ne doit pas être déduit en supposant un taux** : valeur brute conservée et marquée « à vérifier », conformément à la règle projet sur les suppositions.
- **Décision** : _à compléter_

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
