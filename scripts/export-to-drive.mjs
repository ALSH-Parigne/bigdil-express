// Copie toutes les vidéos envoyées (stockées dans Supabase Storage) vers un
// dossier Google Drive, avec un sous-dossier par étape. À lancer après
// l'événement, pour retrouver facilement les vidéos dans l'interface Drive
// habituelle plutôt que dans le dashboard Supabase.
//
// Peut être relancé sans risque : les vidéos déjà exportées sont mémorisées
// dans output/drive-export-log.json et ne sont pas re-uploadées.
//
// Prérequis (voir le README, section "Export vers Google Drive") :
//   - un identifiant OAuth "Desktop app" + le jeton généré une fois par
//     "npm run drive-auth" (login avec VOTRE compte Google — un compte de
//     service seul n'a pas de quota de stockage Drive sur un compte Gmail
//     personnel, l'upload échoue systématiquement)
//
// Usage : npm run export-drive
//         npm run export-drive -- --delete-after   (libère la place sur Supabase
//         une fois chaque vidéo confirmée exportée avec succès sur Drive)

import 'dotenv/config'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { Readable } from 'node:stream'
import { createClient } from '@supabase/supabase-js'
import { google } from 'googleapis'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const CLIENT_FILE = process.env.GOOGLE_OAUTH_CLIENT_FILE
const TOKEN_PATH = 'google-oauth-token.json'
const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    'Erreur : VITE_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définis dans .env'
  )
  process.exit(1)
}

if (!CLIENT_FILE || !ROOT_FOLDER_ID) {
  console.error(
    'Erreur : GOOGLE_OAUTH_CLIENT_FILE et GOOGLE_DRIVE_FOLDER_ID doivent être définis ' +
    'dans .env. Voir le README, section "Export vers Google Drive", pour la marche à suivre.'
  )
  process.exit(1)
}

if (!existsSync(TOKEN_PATH)) {
  console.error(
    `Erreur : ${TOKEN_PATH} introuvable. Lancez d'abord "npm run drive-auth" (autorisation ` +
    'ponctuelle avec votre compte Google).'
  )
  process.exit(1)
}

const DELETE_AFTER = process.argv.includes('--delete-after')

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const { installed, web } = JSON.parse(await readFile(CLIENT_FILE, 'utf-8'))
const creds = installed ?? web
const oauth2Client = new google.auth.OAuth2(creds.client_id, creds.client_secret)
oauth2Client.setCredentials(JSON.parse(await readFile(TOKEN_PATH, 'utf-8')))

const drive = google.drive({ version: 'v3', auth: oauth2Client })

const LOG_PATH = 'output/drive-export-log.json'
await mkdir('output', { recursive: true })
const log = existsSync(LOG_PATH) ? JSON.parse(await readFile(LOG_PATH, 'utf-8')) : {}

const [{ data: steps, error: stepsError }, { data: submissions, error: subsError }] =
  await Promise.all([
    supabase.from('steps').select('id, order_index'),
    supabase.from('submissions').select('id, step_id, video_path, created_at').order('created_at'),
  ])

if (stepsError) throw stepsError
if (subsError) throw subsError

const stepsById = Object.fromEntries(steps.map((s) => [s.id, s]))

// Les dossiers créés à la main dans Drive peuvent s'écrire "etape 3", "Etape 3"
// ou "Étape 3" : on compare sans accents ni casse pour réutiliser le dossier
// existant au lieu d'en créer un doublon.
function normalize(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

const existingFolders = []
{
  let pageToken
  do {
    const res = await drive.files.list({
      q: `'${ROOT_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'nextPageToken, files(id, name, ownedByMe)',
      pageToken,
    })
    existingFolders.push(...res.data.files)
    pageToken = res.data.nextPageToken
  } while (pageToken)
}

async function getOrCreateStepFolder(orderIndex) {
  // En cas de plusieurs dossiers au nom équivalent, on privilégie celui que
  // l'utilisateur possède : lui seul pourra ensuite le renommer ou le vider.
  const candidates = existingFolders.filter((f) => normalize(f.name) === `etape ${orderIndex}`)
  const match = candidates.find((f) => f.ownedByMe) ?? candidates[0]
  if (match) return match.id

  const created = await drive.files.create({
    requestBody: {
      name: `Étape ${orderIndex}`,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [ROOT_FOLDER_ID],
    },
    fields: 'id, name',
  })
  existingFolders.push({ id: created.data.id, name: created.data.name, ownedByMe: true })
  return created.data.id
}

const stepFolderCache = {}
let exported = 0
let skipped = 0
let failed = 0

for (const sub of submissions) {
  if (log[sub.id]) {
    skipped++
    continue
  }

  const step = stepsById[sub.step_id]
  if (!step) {
    console.warn(`⚠️  Soumission ${sub.id} ignorée : étape introuvable.`)
    failed++
    continue
  }

  if (!stepFolderCache[step.id]) {
    stepFolderCache[step.id] = await getOrCreateStepFolder(step.order_index)
  }
  const folderId = stepFolderCache[step.id]

  const { data: publicUrlData } = supabase.storage.from('videos').getPublicUrl(sub.video_path)

  try {
    const response = await fetch(publicUrlData.publicUrl)
    if (!response.ok) throw new Error(`téléchargement échoué (${response.status})`)

    const buffer = Buffer.from(await response.arrayBuffer())
    const extension = sub.video_path.split('.').pop() || 'mp4'
    const dateLabel = new Date(sub.created_at).toISOString().slice(0, 19).replace(/[:T]/g, '-')
    const fileName = `Étape ${step.order_index} - ${dateLabel}.${extension}`

    const created = await drive.files.create({
      requestBody: { name: fileName, parents: [folderId] },
      media: {
        mimeType: response.headers.get('content-type') || 'video/mp4',
        body: Readable.from(buffer),
      },
      fields: 'id',
    })

    log[sub.id] = created.data.id
    exported++
    console.log(`✅ ${fileName}`)

    if (DELETE_AFTER) {
      const { error: removeErr } = await supabase.storage.from('videos').remove([sub.video_path])
      if (removeErr) console.warn(`   ⚠️  Fichier Supabase non supprimé : ${removeErr.message}`)

      const { error: deleteRowErr } = await supabase.from('submissions').delete().eq('id', sub.id)
      if (deleteRowErr) console.warn(`   ⚠️  Ligne submissions non supprimée : ${deleteRowErr.message}`)
      else console.log('   🗑️  Libéré de Supabase (déjà en sécurité sur Drive)')
    }
  } catch (err) {
    console.error(`❌ Échec pour la soumission ${sub.id} (${sub.video_path}) :`, err.message)
    failed++
  }
}

await writeFile(LOG_PATH, JSON.stringify(log, null, 2))

console.log(
  `\nTerminé : ${exported} vidéo(s) exportée(s), ${skipped} déjà exportée(s) précédemment` +
  (failed ? `, ${failed} échec(s).` : '.') +
  (DELETE_AFTER ? ' Espace libéré sur Supabase pour les vidéos exportées.' : '')
)
