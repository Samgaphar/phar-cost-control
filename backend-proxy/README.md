# PHAR Cost Proxy — explication simple

## C'est quoi ?

Aujourd'hui, quand quelqu'un scanne un bon de livraison dans PHAR Cost,
le navigateur envoie directement la clé secrète Anthropic sur Internet.
N'importe qui qui ouvre les outils développeur du navigateur peut la voir
et la copier — comme si on écrivait le code de la carte bancaire sur un
post-it collé à l'écran.

Ce dossier est un petit programme (un "Worker") qui vit sur les serveurs
de Cloudflare. Il se place entre le navigateur et Anthropic :

```
Navigateur (PHAR Cost)  →  Worker Cloudflare  →  Anthropic
        (pas de clé)         (garde la vraie clé)
```

Le navigateur ne connaît plus jamais la vraie clé. Il envoie juste
"je suis le client X, voici le document à analyser", et c'est le Worker,
côté serveur, qui rajoute la vraie clé avant d'appeler Anthropic.

## Ce qu'il y a dans ce dossier

- `src/index.js` — le code du Worker (déjà écrit, rien à modifier pour démarrer).
- `wrangler.toml` — sa configuration (nom, quels sites ont le droit de l'appeler).
- `package.json` — la liste des outils nécessaires pour le déployer.

## Étapes pour le mettre en ligne — sans rien installer (recommandé)

Il te faut un compte Cloudflare (gratuit, pas de carte bancaire requise
pour ce niveau d'usage). Si tu en as déjà un pour le projet Châtel, tu
peux réutiliser le même.

1. Va sur [dash.cloudflare.com](https://dash.cloudflare.com/) et connecte-toi
   (ou crée un compte).

2. Dans le menu de gauche : **Workers & Pages** → **Créer** →
   **Créer un Worker** (parfois affiché "Start with Hello World").

3. Donne-lui un nom, par exemple `phar-cost-proxy` (ce nom fera partie de
   l'adresse finale), puis clique **Déployer** — ça crée un Worker "Hello
   World" vide, c'est normal.

4. Clique sur **Modifier le code** (`Edit code`) — ça ouvre un éditeur
   directement dans le navigateur.

5. Sélectionne tout le code existant (Ctrl+A) et supprime-le, puis colle
   le contenu du fichier [`src/index.js`](src/index.js) de ce dossier à la
   place.

6. Clique **Déployer** (en haut à droite de l'éditeur).

7. Va dans l'onglet **Paramètres** du Worker → **Variables et secrets** →
   **Ajouter** :
   - Nom : `ANTHROPIC_API_KEY` — Type : **Secret** (chiffré, jamais
     réaffiché) — Valeur : ta clé Anthropic (`sk-ant-...`). C'est ici, et
     seulement ici, que cette clé doit être saisie — jamais dans le chat
     avec moi.
   - (Optionnel pour l'instant) Nom : `ALLOWED_ORIGINS` — Type : **Texte**
     — Valeur : l'adresse où tourne réellement PHAR Cost, pour empêcher
     d'autres sites d'utiliser ton Worker. Laisser vide pour l'instant si
     tu ne sais pas encore où l'app sera hébergée.
   - Sauvegarder / redéployer si demandé.

8. En haut de la page du Worker, une adresse est affichée, du type
   `https://phar-cost-proxy.<ton-compte>.workers.dev` — copie-la, c'est
   celle que l'app PHAR Cost va appeler.

## Plusieurs hôtels (ex. MONA, RIVAGE LUTRY) — un Worker par hôtel

Chaque hôtel utilise sa **propre copie** de PHAR Cost (pas un sélecteur de
client dans une même app). La solution la plus simple, choisie ici, est
donc **un Worker Cloudflare séparé par hôtel**, avec sa propre clé
Anthropic — pas besoin de `CLIENT_KEYS`/KV, cette voie reste réservée à
une future vraie gestion multi-clients dans l'app elle-même.

Pour ajouter un nouvel hôtel (ex. MONA) :

1. Refaire les étapes 1 à 8 ci-dessus, en nommant le Worker
   `phar-cost-proxy-mona` (au lieu de `phar-cost-proxy`).
2. Lui donner sa propre clé secrète `ANTHROPIC_API_KEY` (celle de MONA).
3. Copier `files v6/` dans le dossier de déploiement de MONA, et changer
   `PHAR_PROXY_URL` dans son `index.html` pour pointer vers
   `https://phar-cost-proxy-mona.<compte>.workers.dev`.

Répéter pour RIVAGE LUTRY (`phar-cost-proxy-rivage`), etc. Chaque Worker
est indépendant : renouveler/révoquer la clé de l'un n'affecte pas les
autres.

## Alternative avec la ligne de commande (`wrangler`)

Si tu préfères la ligne de commande (nécessite Node.js installé) : voir
les commandes `npm install`, `npx wrangler login`, `npm run secret:set-key`
et `npm run deploy` — utile surtout plus tard si on ajoute les KV
`CLIENT_KEYS`/`USAGE` (facturation par client), pas nécessaire pour
démarrer.

## Et après ?

Une fois déployé, il faut dire à l'app PHAR Cost (`files v6/index.html`)
d'appeler cette nouvelle adresse au lieu d'Anthropic directement — c'est
un changement séparé, à faire une fois que le Worker est en ligne et
testé.

## ⚠️ Maintenance récurrente — renouveler la clé tous les 30 jours

La clé Anthropic utilisée (`ANTHROPIC_API_KEY`) expire au bout de **30
jours**. Sans renouvellement, le scan IA de PHAR Cost s'arrêtera de
fonctionner silencieusement (le Worker répondra avec une erreur
d'authentification). À refaire environ une fois par mois :

1. Générer une nouvelle clé sur [console.anthropic.com](https://console.anthropic.com/)
   (Settings → API Keys → Create Key).
2. Aller sur [dash.cloudflare.com](https://dash.cloudflare.com/) →
   **Workers & Pages** → `phar-cost-proxy` → onglet **Settings** →
   **Variables and Secrets**.
3. Trouver `ANTHROPIC_API_KEY` → cliquer **Edit** (icône crayon) →
   coller la nouvelle clé → **Save** / **Deploy**.
4. Révoquer l'ancienne clé sur console.anthropic.com (pour éviter d'avoir
   deux clés valides en même temps sans raison).

Comme pour la première mise en place : la clé se colle **uniquement**
dans le dashboard Cloudflare, jamais ailleurs (ni dans un fichier du
projet, ni dans une conversation).
