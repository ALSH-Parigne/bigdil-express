// Copie toutes les vidéos envoyées (stockées dans Supabase Storage) vers un
// dossier Google Drive, avec un sous-dossier par étape. À lancer après
// l'événement, pour retrouver facilement les vidéos dans l'interface Drive
// habituelle plutôt que dans le dashboard Supabase.
//
// Peut être relancé sans risque : les vidéos déjà exportées sont mémorisées
// dans output/drive-export-log.json et ne sont pas re-uploadées.
//
// Prérequis (voir le README, section "Export vers Google Drive") :
//   - un compte de service Google Cloud avec l'API Drive activée
//   - un dossier dans VOTRE Google Drive, partagé en "Éditeur" avec l'adresse
//     e-mail du compte de service (un compte de service seul n'a pas de
//     quota de stockage Drive propre, il doit écrire dans un dossier qui lui
//     a été partagé par un vrai compte)
//
// Usage : npm run export-drive

import 'dotenv/config'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { Readable } from 'node:stream'
import { createClient } from '@supabase/supabase-js'
import { google } from 'googleapis'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const KEY_FILE = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE
const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    'Erreur : VITE_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définis dans .env'
  )
  process.exit(1)
}

if (!KEY_FILE || !ROOT_FOLDER_ID) {
  console.error(
    'Erreur : GOOGLE_SERVICE_ACCOUNT_KEY_FILE et GOOGLE_DRIVE_FOLDER_ID doivent être définis ' +
    'dans .env. Voir le README, section "Export vers Google Drive", pour la marche à suivre.'
  )
  process.exit(1)
}

if (!existsSync(KEY_FILE)) {
  console.error(`Erreur : fichier de clé introuvable : ${KEY_FILE}`)
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const auth = new google.auth.GoogleAuth({
  keyFile: KEY_FILE,
  scopes: ['https://www.googleapis.com/auth/drive'],
})
const drive = google.drive({ version: 'v3', auth })

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

async function getOrCreateStepFolder(orderIndex) {
  const name = `Étape ${orderIndex}`
  const q = `name='${name}' and '${ROOT_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
  const res = await drive.files.list({ q, fields: 'files(id, name)' })
  if (res.data.files.length > 0) return res.data.files[0].id

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [ROOT_FOLDER_ID],
    },
    fields: 'id',
  })
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
  } catch (err) {
    console.error(`❌ Échec pour la soumission ${sub.id} (${sub.video_path}) :`, err.message)
    failed++
  }
}

await writeFile(LOG_PATH, JSON.stringify(log, null, 2))

console.log(
  `\nTerminé : ${exported} vidéo(s) exportée(s), ${skipped} déjà exportée(s) précédemment` +
  (failed ? `, ${failed} échec(s).` : '.')
)
