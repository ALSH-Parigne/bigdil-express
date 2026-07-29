// Autorisation OAuth ponctuelle avec VOTRE compte Google (pas un compte de
// service — les comptes de service n'ont aucun quota de stockage Drive sur
// un compte Gmail personnel, ce qui empêche tout upload).
//
// À lancer UNE SEULE FOIS. Ouvre une page dans votre navigateur pour vous
// connecter et autoriser l'accès à votre Drive, puis enregistre un jeton de
// rafraîchissement local (google-oauth-token.json, jamais commité) réutilisé
// ensuite par scripts/export-to-drive.mjs.
//
// Prérequis : un identifiant OAuth de type "Desktop app" téléchargé depuis
// Google Cloud Console (voir README, section "Export vers Google Drive").
//
// Usage : npm run drive-auth

import 'dotenv/config'
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { exec } from 'node:child_process'
import { google } from 'googleapis'

const CLIENT_FILE = process.env.GOOGLE_OAUTH_CLIENT_FILE
const TOKEN_PATH = 'google-oauth-token.json'
const PORT = 53817
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`

if (!CLIENT_FILE) {
  console.error(
    'Erreur : GOOGLE_OAUTH_CLIENT_FILE doit être défini dans .env (chemin vers le fichier ' +
    'JSON du client OAuth "Desktop app" téléchargé depuis Google Cloud Console).'
  )
  process.exit(1)
}

if (!existsSync(CLIENT_FILE)) {
  console.error(`Erreur : fichier introuvable : ${CLIENT_FILE}`)
  process.exit(1)
}

const { installed, web } = JSON.parse(await readFile(CLIENT_FILE, 'utf-8'))
const creds = installed ?? web
if (!creds) {
  console.error('Erreur : format de fichier OAuth non reconnu (ni "installed" ni "web").')
  process.exit(1)
}

const oauth2Client = new google.auth.OAuth2(creds.client_id, creds.client_secret, REDIRECT_URI)

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/drive'],
})

console.log('\nOuverture de la page d\'autorisation Google dans votre navigateur...')
console.log(`Si elle ne s'ouvre pas automatiquement, copiez cette URL :\n${authUrl}\n`)
exec(`open "${authUrl}"`)

const server = createServer(async (req, res) => {
  if (!req.url.startsWith('/oauth2callback')) {
    res.writeHead(404)
    res.end()
    return
  }

  const url = new URL(req.url, REDIRECT_URI)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')

  if (error) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end('<p>Autorisation refusée. Vous pouvez fermer cet onglet.</p>')
    console.error(`\n❌ Autorisation refusée : ${error}`)
    server.close()
    process.exit(1)
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end('<p>✅ Autorisation réussie ! Vous pouvez fermer cet onglet et revenir au terminal.</p>')

  const { tokens } = await oauth2Client.getToken(code)
  await writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2))
  console.log(`\n✅ Jeton enregistré dans ${TOKEN_PATH}.`)
  console.log('Vous pouvez maintenant lancer "npm run export-drive".')
  server.close()
  process.exit(0)
})

server.listen(PORT, () => {
  console.log(`En attente de l'autorisation sur http://localhost:${PORT}...`)
})
