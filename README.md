# Chasse au trésor vidéo - ALSH Parigné-sur-Braye

Mini-site pour un jeu de piste : les enfants scannent un QR code, filment une
vidéo avec leur mission, l'envoient, et débloquent immédiatement l'indice
suivant.

## 🧩 Comment ça marche

- Il y a **8 QR codes physiques, partagés par toutes les équipes** (25 équipes
  dans ce cas) : tout le monde suit le même parcours, aux mêmes 8 stations.
- Chaque QR code pointe vers `https://votre-site.fr/j/<token>` où `<token>` est
  unique à une étape précise (mais commun à toutes les équipes).
- Au premier scan, le téléphone demande "Quelle est votre équipe ?" (liste
  déroulante) puis mémorise le choix (`localStorage`) pour les scans suivants
  sur ce même téléphone — un lien "changer" permet de corriger si besoin.
- La page d'étape affiche ensuite la mission, ouvre l'appareil photo natif du
  téléphone pour filmer, uploade la vidéo, puis affiche l'indice **tout de
  suite** (pas de validation manuelle).
- Une page `/admin` protégée par mot de passe permet aux animateurs de
  revoir toutes les vidéos envoyées, filtrables par équipe et par étape.

## 🛠️ Stack

- React + Vite + Tailwind (même stack que le site d'inscription `Alsh`)
- [Supabase](https://supabase.com) (gratuit) : base de données Postgres +
  stockage des vidéos, sans serveur à maintenir
- Déploiement recommandé : [Netlify](https://netlify.com) (gratuit)

## 🚀 Mise en place

### 1. Créer le projet Supabase

1. Créez un compte gratuit sur [supabase.com](https://supabase.com) et un
   nouveau projet.
2. Dans **SQL Editor**, collez le contenu de [`supabase/schema.sql`](supabase/schema.sql)
   et exécutez-le. Ça crée les tables, les règles de sécurité et le bucket
   vidéo.
3. Dans le fichier SQL, changez `'change-me'` par le mot de passe que vous
   voulez pour la page `/admin` avant de l'exécuter (ou ré-exécutez juste la
   dernière requête plus tard pour le changer).
4. Récupérez dans **Project Settings > API** :
   - `Project URL`
   - `anon public` key
   - `service_role` key (⚠️ secrète, ne jamais la mettre dans le code du site)

### 2. Configurer le projet local

```bash
cp .env.example .env
```

Remplissez `.env` avec les valeurs récupérées à l'étape précédente.

```bash
npm install
```

### 3. Définir les équipes, missions et indices

Copiez le fichier d'exemple et éditez-le :

```bash
cp config/teams.example.json config/teams.json
```

Le fichier contient deux listes :
- `teams` : les noms des 25 équipes (une simple liste de chaînes de caractères).
- `steps` : les 8 étapes du parcours commun, avec pour chacune la mission (ce
  que les enfants doivent filmer) et l'indice débloqué une fois la vidéo envoyée.

Puis synchronisez avec Supabase :

```bash
npm run seed
```

**Important** : relancer `npm run seed` après une modif est sans risque — le
token de chaque étape déjà créée est conservé (seul le texte est mis à jour),
donc les QR codes déjà imprimés continuent de fonctionner. Les équipes déjà
présentes (même nom) ne sont pas dupliquées.

### 4. Générer les QR codes à imprimer

```bash
npm run qrcodes
```

Ça crée un seul fichier `output/qrcodes/qrcodes.html` avec les 8 QR codes du
parcours (un par étape, partagé par toutes les équipes). Ouvrez-le dans un
navigateur et imprimez (Cmd+P / Ctrl+P), puis affichez chaque QR code à sa
station physique.

⚠️ Pensez à renseigner `SITE_URL` dans `.env` avec l'adresse **réelle** du
site déployé avant l'impression finale (voir étape 5) — sinon les QR codes
pointeront vers `localhost`.

### 5. Tester en local

```bash
npm run dev
```

Le site est sur `http://localhost:3000`. Ouvrez une des URLs affichées par
`npm run seed` (`/j/<token>`) pour tester le parcours d'une étape, et
`/admin` pour l'espace animateurs.

### 6. Déployer (Netlify, gratuit)

1. Poussez ce dossier sur un dépôt Git (GitHub par exemple).
2. Sur [netlify.com](https://netlify.com), "Add new site" > importez le repo.
3. Build command : `npm run build` — Publish directory : `dist`
4. Dans les "Environment variables" du site Netlify, ajoutez
   `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (les mêmes que dans votre
   `.env` local — **pas** la clé `service_role`).
5. Une fois déployé, mettez à jour `SITE_URL` dans votre `.env` local avec
   l'URL Netlify, puis relancez `npm run qrcodes` pour les QR codes finaux.

## 📤 Export des vidéos vers Google Drive (après l'événement)

Les vidéos sont stockées dans Supabase pendant l'événement (upload direct et
fiable depuis le téléphone des enfants, sans backend à maintenir). Une fois
l'événement terminé, un script permet de copier toutes les vidéos dans un
dossier Google Drive classique, organisé par équipe, pour les consulter avec
l'interface Drive habituelle plutôt que le dashboard Supabase.

Google Drive n'accepte pas d'upload anonyme direct depuis un navigateur : il
faut un compte de service Google. C'est pour ça que l'export se fait après
coup, en local, plutôt qu'en direct le jour de l'événement (plus simple, zéro
risque de bug pendant le jeu).

### Mise en place (une seule fois)

1. Créez un projet sur [console.cloud.google.com](https://console.cloud.google.com)
   (gratuit) et activez l'**API Google Drive** (menu "APIs & Services" > "Enable APIs").
2. Créez un **compte de service** ("IAM & Admin" > "Service Accounts" > "Create
   Service Account"), puis générez une clé au format JSON ("Keys" > "Add Key" >
   "JSON"). Le fichier se télécharge automatiquement.
3. Placez ce fichier dans le dossier du projet, par exemple sous le nom
   `service-account-key.json` (il est déjà exclu de Git par `.gitignore` — ne
   le partagez jamais, il donne accès à votre compte de service).
4. Ouvrez le fichier JSON et repérez le champ `client_email` (une adresse du
   type `xxx@yyy.iam.gserviceaccount.com`).
5. Dans **votre** Google Drive personnel, créez un dossier (ex : "Chasse au
   trésor Parigné - Vidéos"), clic droit > **Partager**, collez l'adresse
   `client_email` avec le rôle **Éditeur**.
   > Un compte de service seul n'a pas de quota de stockage Drive : il doit
   > obligatoirement écrire dans un dossier qui lui a été partagé par un vrai
   > compte Google — c'est ce que fait cette étape.
6. Ouvrez ce dossier dans votre navigateur et copiez l'ID présent dans l'URL
   (la partie après `/folders/`).
7. Dans `.env`, renseignez `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` (chemin vers le
   fichier JSON) et `GOOGLE_DRIVE_FOLDER_ID` (l'ID copié).

### Utilisation

```bash
npm run export-drive
```

Le script crée un sous-dossier par équipe et y copie chaque vidéo, avec un
nom clair (`Équipe - Étape N - date.ext`). Il peut être relancé sans risque
de doublon : les vidéos déjà exportées sont mémorisées dans
`output/drive-export-log.json` et ne sont pas renvoyées une seconde fois.

## 📱 Compatibilité vidéo

Le bouton "Filmer la vidéo" utilise la capture caméra native du téléphone
(`<input type="file" capture>`) plutôt qu'un enregistreur maison dans le
navigateur : c'est nettement plus fiable sur iPhone/Android le jour de
l'événement (pas de souci de permissions caméra ou de format non supporté).

## 🔒 Sécurité / confidentialité

- Les indices et missions ne sont accessibles que via une fonction serveur
  (`get_step_by_token`) qui ne renvoie qu'une seule étape à la fois : un
  enfant curieux ne peut pas interroger la base pour voir les indices des
  étapes suivantes à l'avance (il doit avoir scanné le QR code physique
  correspondant).
- La page `/admin` est protégée par un mot de passe vérifié côté serveur
  (jamais exposé dans le code du site).
- Aucune gestion de consentement/RGPD n'est intégrée dans l'app (choix fait
  pour rester simple) : à gérer en amont via les autorisations papier
  signées par les parents, comme pour les photos/vidéos habituelles du
  centre.
- Les vidéos restent dans le bucket Supabase tant qu'elles ne sont pas
  supprimées manuellement — pensez à faire le ménage après l'événement si
  besoin (Storage > bucket `videos` dans le dashboard Supabase).

## 📁 Structure

```
src/
  pages/Home.jsx     Page d'accueil (avant tout scan)
  pages/Step.jsx      Page d'étape (sélection équipe, mission, caméra, indice)
  pages/Admin.jsx      Espace animateurs (vidéos reçues, filtrables)
  components/TeamPicker.jsx    Sélection de l'équipe (mémorisée sur le téléphone)
  components/VideoCapture.jsx   Capture + prévisualisation vidéo
  lib/supabase.js      Client Supabase
  lib/team.js       Persistance de l'équipe choisie (localStorage)
supabase/schema.sql     Schéma complet à exécuter dans Supabase
scripts/seed.mjs      Synchronise config/teams.json -> Supabase
scripts/generate-qrcodes.mjs  Génère les QR codes imprimables
scripts/export-to-drive.mjs  Copie les vidéos vers Google Drive (après l'événement)
config/teams.example.json   Modèle à copier vers config/teams.json
```
