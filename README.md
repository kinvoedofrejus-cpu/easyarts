# EasyArts — Guide de déploiement (depuis ton téléphone)

EasyArts est un logiciel de gestion de centre artistique en ligne, consultable depuis n'importe quel appareil.
Il tourne sur **Cloudflare Workers** (backend + hébergement du site) avec une base de données **Cloudflare D1**, et le code est versionné sur **GitHub**.

## Contenu du projet
```
easyarts/
├── wrangler.toml       → configuration Cloudflare
├── schema.sql           → structure de la base de données
├── src/index.js          → API (backend)
└── public/                → site (frontend)
    ├── index.html
    ├── css/style.css
    ├── js/api.js, print.js, app.js
    └── img/logo.png
```

## Étape 1 — Mettre le code sur GitHub
1. Sur l'app GitHub (ou github.com depuis Chrome), crée un nouveau dépôt **"easyarts"**.
2. Dézippe le fichier reçu et envoie tout son contenu dans ce dépôt (l'app GitHub permet d'ajouter des fichiers, ou utilise l'option "Upload files" sur le site github.com en mode "Desktop site" depuis Chrome).

## Étape 2 — Créer la base de données D1
1. Va sur **dash.cloudflare.com** (site complet, active "Version ordinateur" dans Chrome pour plus de confort).
2. Menu **Workers & Pages → D1 → Create database**, nomme-la `easyarts-db`.
3. Une fois créée, ouvre l'onglet **Console** de la base et colle le contenu du fichier `schema.sql` (copier-coller), puis exécute. Cela crée toutes les tables.
4. Copie l'**ID de la base de données** affiché (Database ID).

## Étape 3 — Connecter le dépôt GitHub à un Worker
1. Toujours sur dash.cloudflare.com : **Workers & Pages → Create → Workers → Connect to Git** (ou "Import a repository").
2. Choisis ton dépôt `easyarts`. Cloudflare détecte automatiquement `wrangler.toml`.
3. Avant de déployer, modifie le fichier `wrangler.toml` dans GitHub (bouton crayon ✏️ pour éditer directement sur github.com) : remplace `COLLE_TON_ID_ICI` par l'ID copié à l'étape 2.
4. Dans les réglages du Worker sur Cloudflare, section **Bindings**, vérifie que la base D1 `easyarts-db` est bien liée avec le nom `DB` (normalement automatique grâce au `wrangler.toml`).
5. Lance le déploiement. Cloudflare te donne une adresse du type `https://easyarts.tonpseudo.workers.dev`.

## Étape 4 — Première connexion
- Ouvre l'adresse fournie par Cloudflare depuis n'importe quel appareil.
- Connecte-toi avec :
  - **Identifiant** : `admin`
  - **Mot de passe** : `admin123`
- ⚠️ Change immédiatement ce mot de passe dans un futur module "Mon compte" (à ajouter), ou directement dans la console D1 en générant un nouveau hash SHA-256.

## Mises à jour futures
Chaque fois que tu modifies un fichier sur GitHub (directement depuis l'app ou le site), Cloudflare redéploie automatiquement le site en 1 à 2 minutes.

## Ce qui est déjà fonctionnel
- Connexion sécurisée (admin / secrétaire avec droits limités)
- Élèves / Artistes, Disciplines, Enseignants, Ventes, Notes/évaluations, Finances (paiements, dépenses, salaires)
- Impression : quittance de paiement, fiche d'inscription, attestations (fin de stage, fin de formation, participation)
- Paramètres du centre (nom, logo, coordonnées)
- Création de comptes secrétaire par l'administrateur
- Tableau de bord avec statistiques en temps réel

## Prochaines améliorations possibles
- Page "Mon compte" pour changer son propre mot de passe
- Réglage fin des permissions par module pour chaque secrétaire (déjà prévu côté base de données : colonne `permissions`)
- Rapports imprimables détaillés (listes filtrées, bilans par période)
- Upload direct du logo et des photos d'élèves (actuellement via URL)
