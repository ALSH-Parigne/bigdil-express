// Surveille l'espace utilisé sur Supabase Storage et alerte (notification
// macOS + son) dès qu'un seuil est franchi. À lancer dans le Terminal pendant
// l'événement : Ctrl+C pour arrêter.
//
// Usage : npm run watch-storage
//         SEUIL=60 npm run watch-storage        (alerte dès 60 %)
//         INTERVAL=120 npm run watch-storage    (vérifie toutes les 2 minutes)

import 'dotenv/config'
import { exec } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Erreur : VITE_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définis dans .env')
  process.exit(1)
}

// Quota du plan gratuit Supabase.
const QUOTA_BYTES = 1024 * 1024 * 1024
const SEUIL = Number(process.env.SEUIL ?? 75)
const INTERVAL = Number(process.env.INTERVAL ?? 300)

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// Parcourt le bucket en profondeur : les sous-dossiers apparaissent comme des
// entrées sans metadata, il faut redescendre dedans pour trouver les fichiers.
async function totalSize(prefix = '') {
  let total = 0
  let offset = 0
  for (;;) {
    const { data, error } = await supabase.storage
      .from('videos')
      .list(prefix, { limit: 100, offset })
    if (error) throw error
    if (!data || data.length === 0) break

    for (const item of data) {
      const size = item.metadata?.size
      if (typeof size === 'number') {
        total += size
      } else {
        total += await totalSize(prefix ? `${prefix}/${item.name}` : item.name)
      }
    }

    if (data.length < 100) break
    offset += 100
  }
  return total
}

function alerte(titre, message) {
  const esc = (s) => s.replace(/"/g, '\\"')
  exec(
    `osascript -e 'display notification "${esc(message)}" with title "${esc(titre)}" sound name "Sosumi"'`
  )
  // Répété : une seule notification passe facilement inaperçue en pleine animation.
  setTimeout(() => exec('afplay /System/Library/Sounds/Sosumi.aiff'), 1200)
  setTimeout(() => exec('afplay /System/Library/Sounds/Sosumi.aiff'), 2400)
}

function barre(pct) {
  const n = Math.min(20, Math.round(pct / 5))
  return '█'.repeat(n) + '░'.repeat(20 - n)
}

console.log(`Surveillance du stockage Supabase — alerte à ${SEUIL} %, vérification toutes les ${INTERVAL}s.`)
console.log('Ctrl+C pour arrêter.\n')

let dejaAlerte = false

for (;;) {
  try {
    const used = await totalSize()
    const pct = (used / QUOTA_BYTES) * 100
    const heure = new Date().toLocaleTimeString('fr-FR')
    const mo = (used / (1024 * 1024)).toFixed(0)

    console.log(`${heure}  ${barre(pct)}  ${pct.toFixed(1)} %  (${mo} Mo / 1024 Mo)`)

    if (pct >= SEUIL && !dejaAlerte) {
      dejaAlerte = true
      console.log(`\n  ⚠️  SEUIL DE ${SEUIL} % FRANCHI`)
      console.log('  Lance dans un autre Terminal, pour libérer de la place :')
      console.log('  DELETE_AFTER=1 npm run auto-export\n')
      alerte(
        `Stockage à ${pct.toFixed(0)} %`,
        `Bigdil-express : ${mo} Mo sur 1024 Mo utilisés. Lance l'export avec DELETE_AFTER=1.`
      )
    }

    // Si l'export a libéré de la place, on réarme l'alerte.
    if (pct < SEUIL - 5) dejaAlerte = false
  } catch (err) {
    console.error(`${new Date().toLocaleTimeString('fr-FR')}  Erreur de lecture : ${err.message}`)
  }

  await new Promise((r) => setTimeout(r, INTERVAL * 1000))
}
