# Bigdil-express - ALSH Parigné-sur-Braye

Mini-site pour un jeu de piste : les enfants scannent un QR code, filment une
vidéo avec leur mission, l'envoient, et débloquent immédiatement l'indice
suivant.

## 🧩 Comment ça marche

- Il y a **8 QR codes physiques, partagés par toutes les équipes** (25 équipes
  dans ce cas) : tout le monde suit le même parcours, aux mêmes 8 stations.
- Chaque QR code pointe vers `https://votre-site.fr/j/<token>` où `<token>` est
  unique à une étape précise (mais commun à toutes les équipes).
- Le site ne cherche pas à savoir quelle équipe envoie quoi : scanner le QR
  code → **regarder une courte vidéo qui explique la mission** → filmer la
  mission → envoyer → indice débloqué **tout de suite** (pas de validation
  manuelle). Simple et anonyme.
- Une page `/admin` protégée par mot de passe permet aux animateurs de
  revoir toutes les vidéos envoyées, filtrables par étape.

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

### 3. Définir les missions et indices

Copiez le fichier d'exemple et éditez-le :

```bash
cp config/steps.example.json config/steps.json
```

Le fichier contient la liste des 8 étapes du parcours commun, avec pour
chacune la mission (texte, ce que les enfants doivent filmer), une vidéo de
mission optionnelle (`missionVideo`, l'URL d'une vidéo qui explique la
mission — affichée en haut de la page avant que les enfants filment) et
l'indice débloqué une fois la vidéo envoyée.

Pour ajouter une vidéo de mission : uploadez le fichier vidéo dans le bucket
Supabase (Dashboard > Storage > bucket `videos`, créez un dossier `missions/`
par exemple), puis copiez son URL publique (clic droit sur le fichier >
"Copy URL", ou bouton de partage) dans le champ `missionVideo` de l'étape
correspondante. Vous pouvez aussi utiliser n'importe quelle autre URL vidéo
publique (YouTube non listé, Google Drive partagé, etc.) tant qu'elle pointe
directement vers un fichier lisible par une balise `<video>` — pour un lien
YouTube classique, il faudra passer par un lecteur embarqué plutôt que ce
champ, qui attend un fichier vidéo direct (.mp4, .webm...).

Par défaut, chaque étape demande une vidéo. Pour une étape où les enfants
doivent plutôt prendre **une photo**, ajoutez `"captureType": "photo"` à
cette étape dans le fichier de config.

Puis synchronisez avec Supabase :

```bash
npm run seed
```

**Important** : relancer `npm run seed` après une modif est sans risque — le
token de chaque étape déjà créée est conservé (seul le texte est mis à jour),
donc les QR codes déjà imprimés continuent de fonctionner.

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

**Site en production** : https://bigdil-express.netlify.app

Déployé via la Netlify CLI (`brew install netlify-cli` puis `netlify login`),
sans intégration GitHub continue — chaque changement de **code** (pas de
contenu, voir plus bas) se déploie manuellement :

```bash
npm run build
netlify deploy --prod --dir=dist
```

Le fichier [`public/_redirects`](public/_redirects) (`/* /index.html 200`)
est indispensable : sans lui, Netlify renvoie une 404 sur les routes
React comme `/admin` ou `/j/<token>` en accès direct.

Les variables d'environnement (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
sont déjà configurées sur le site Netlify (`netlify env:set ...` — **jamais**
la clé `service_role`). Pour les revoir/modifier : dashboard Netlify du site
> Site configuration > Environment variables.

**Important** : modifier les missions/indices (`config/steps.json` +
`npm run seed`) ne nécessite **aucun redéploiement** — le contenu vit dans
Supabase et est chargé à chaque visite. Seul un changement de **code** (donc
rare) demande de relancer `netlify deploy --prod --dir=dist`.

Une fois l'URL de prod connue, mettez à jour `SITE_URL` dans `.env` puis
relancez `npm run qrcodes` pour les QR codes finaux à imprimer.

## 📤 Export des vidéos vers Google Drive (après l'événement)

Les vidéos sont stockées dans Supabase pendant l'événement (upload direct et
fiable depuis le téléphone des enfants, sans backend à maintenir). Une fois
l'événement terminé, un script permet de copier toutes les vidéos dans un
dossier Google Drive classique, organisé par étape, pour les consulter avec
l'interface Drive habituelle plutôt que le dashboard Supabase.

Google Drive n'accepte pas d'upload anonyme direct depuis un navigateur, donc
l'export se fait après coup, en local, plutôt qu'en direct le jour de
l'événement (plus simple, zéro risque de bug pendant le jeu).

⚠️ **Un compte de service seul ne suffit pas** : les comptes de service
Google n'ont aucun quota de stockage Drive propre, et sur un compte Gmail
personnel (pas Google Workspace), ils ne peuvent PAS écrire de fichiers même
dans un dossier partagé en Éditeur (erreur "Service Accounts do not have
storage quota"). Il faut donc s'authentifier avec **votre vrai compte
Google** via OAuth.

### Mise en place (une seule fois)

1. Créez un projet sur [console.cloud.google.com](https://console.cloud.google.com)
   (gratuit) et activez l'**API Google Drive** (menu "APIs & Services" > "Enable APIs").
2. Configurez l'**écran de consentement OAuth** ("APIs & Services" >
   "OAuth consent screen") si ce n'est pas déjà fait : type "External",
   renseignez le nom de l'app et un e-mail de contact, enregistrez. Dans
   "Test users", ajoutez votre propre adresse Gmail (celle qui possède le
   Drive de destination) — sans ça, l'autorisation sera refusée.
3. Créez un identifiant OAuth ("APIs & Services" > "Credentials" >
   "Create Credentials" > "OAuth client ID"), type d'application
   **"Desktop app"**, donnez-lui un nom, puis téléchargez le JSON généré.
4. Placez ce fichier dans le dossier du projet, par exemple sous le nom
   `google-oauth-client.json` (déjà exclu de Git par `.gitignore`).
5. Dans **votre** Google Drive personnel, créez un dossier (ex : "Bigdil-express
   - Vidéos") et ouvrez-le dans votre navigateur pour copier l'ID présent
   dans l'URL (la partie après `/folders/`).
6. Dans `.env`, renseignez `GOOGLE_OAUTH_CLIENT_FILE` (chemin vers le fichier
   JSON) et `GOOGLE_DRIVE_FOLDER_ID` (l'ID copié).
7. Lancez l'autorisation ponctuelle :
   ```bash
   npm run drive-auth
   ```
   Une page Google s'ouvre dans votre navigateur : connectez-vous avec le
   compte propriétaire du dossier Drive et autorisez l'accès. Un jeton est
   enregistré localement (`google-oauth-token.json`, exclu de Git) et
   réutilisé automatiquement par la suite — cette étape ne se refait pas à
   chaque export.

### Utilisation

```bash
npm run export-drive
```

Le script range chaque vidéo dans un sous-dossier par étape, avec un nom clair
(`Étape N - date.ext`). Si vous avez déjà créé les dossiers à la main dans
Drive, ils sont réutilisés : la comparaison ignore accents et majuscules
(`etape 3`, `Etape 3` et `Étape 3` sont considérés identiques), et les
dossiers dont vous êtes propriétaire sont privilégiés. Sinon les dossiers
manquants sont créés automatiquement.

Le script peut être relancé sans risque de doublon : les vidéos déjà
exportées sont mémorisées dans `output/drive-export-log.json` et ne sont pas
renvoyées une seconde fois.

Pour libérer de la place sur Supabase au fur et à mesure (utile si le
stockage gratuit approche sa limite pendant l'événement) :

```bash
npm run export-drive -- --delete-after
```

Chaque vidéo n'est supprimée de Supabase **qu'après** confirmation qu'elle a
bien été copiée sur Drive — aucun risque de perte.

### Export automatique pendant l'événement

Le transfert vers Drive n'est **pas** automatique par défaut : les vidéos
arrivent dans Supabase (visibles immédiatement dans `/admin`), et c'est la
commande ci-dessus qui les copie sur Drive.

Pour que ça se fasse tout seul pendant l'événement, ouvrez le Terminal et
lancez :

```bash
npm run auto-export
```

La boucle exporte les nouveaux fichiers toutes les 10 minutes, tant que la
fenêtre du Terminal reste ouverte (Ctrl+C pour arrêter). Variantes :

```bash
INTERVAL=300 npm run auto-export       # toutes les 5 minutes
DELETE_AFTER=1 npm run auto-export     # libère Supabase au fur et à mesure
```

> ⚠️ Avec `DELETE_AFTER=1`, les fichiers exportés **disparaissent de la page
> `/admin`** (ils ne sont plus que sur Drive). À n'utiliser que si le stockage
> Supabase pose problème.

**Pourquoi une boucle dans le Terminal et pas une vraie tâche de fond ?**
Une tâche de fond macOS (`launchd`) n'a pas le droit de lire le dossier
`Documents` sans que l'utilisateur accorde manuellement « Accès complet au
disque » dans Réglages Système > Confidentialité et sécurité — testé, ça
échoue avec `Operation not permitted`. Lancée depuis le Terminal, la boucle
hérite des permissions du Terminal : rien à configurer. Contrepartie : le Mac
doit rester allumé et la fenêtre ouverte pendant l'événement.

## 💾 Stockage (plan gratuit Supabase)

Le plan gratuit inclut environ 1 Go de stockage fichiers et 5 Go de bande
passante par mois (vérifiez les chiffres exacts sur votre dashboard :
**Project Settings > Billing/Usage**). Avec 25 équipes × 8 étapes, jusqu'à
200 vidéos/photos peuvent être envoyées le jour de l'événement — de quoi
dépasser le quota gratuit selon la taille des vidéos.

Si l'espace vient à manquer pendant l'événement : lancez
`npm run export-drive -- --delete-after` pour libérer de la place sans rien
perdre (tout part sur Google Drive avant suppression). Pour un événement
plus important, envisagez de passer temporairement au plan payant Supabase
(Pro, résiliable) avant le jour J plutôt que de gérer ça en direct.

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
  pages/Step.jsx      Page d'étape (mission, caméra, indice)
  pages/Admin.jsx      Espace animateurs (vidéos reçues, filtrables par étape)
  components/VideoCapture.jsx   Capture + prévisualisation vidéo
  lib/supabase.js      Client Supabase
supabase/schema.sql     Schéma complet à exécuter dans Supabase
scripts/seed.mjs      Synchronise config/steps.json -> Supabase
scripts/generate-qrcodes.mjs  Génère les QR codes imprimables
scripts/drive-auth.mjs    Autorisation OAuth Google ponctuelle (une fois)
scripts/export-to-drive.mjs  Copie les vidéos vers Google Drive (après l'événement)
scripts/auto-export.sh    Boucle d'export automatique (pendant l'événement)
config/steps.example.json   Modèle à copier vers config/steps.json
```
