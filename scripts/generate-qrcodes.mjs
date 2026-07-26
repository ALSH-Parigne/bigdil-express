// Génère UNE page HTML imprimable avec les 8 QR codes du parcours (partagés
// par toutes les équipes). Ouvrez le fichier généré dans un navigateur et
// faites Cmd+P / Ctrl+P pour imprimer.
//
// Usage : npm run qrcodes   (lancer "npm run seed" avant, pour être sûr d'avoir les derniers indices/tokens)

import 'dotenv/config'
import { mkdir, writeFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'
import QRCode from 'qrcode'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SITE_URL = process.env.SITE_URL || 'http://localhost:3000'

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    'Erreur : VITE_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définis dans .env'
  )
  process.exit(1)
}

if (SITE_URL.includes('localhost')) {
  console.warn(
    `⚠️  SITE_URL pointe vers ${SITE_URL}. Les QR codes ne fonctionneront que sur ce même ` +
    'ordinateur. Renseignez l\'URL réelle du site déployé dans .env avant impression finale.'
  )
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const { data: steps, error } = await supabase
  .from('steps')
  .select('order_index, token')
  .order('order_index')
if (error) throw error

if (steps.length === 0) {
  console.error('Aucune étape trouvée. Lancez d\'abord "npm run seed".')
  process.exit(1)
}

let cardsHtml = ''
for (const step of steps) {
  const url = `${SITE_URL}/j/${step.token}`
  const dataUrl = await QRCode.toDataURL(url, { margin: 1, width: 400 })
  cardsHtml += `
    <div class="card">
      <img src="${dataUrl}" alt="QR code étape ${step.order_index}" />
      <p class="label">Étape ${step.order_index}</p>
    </div>`
}

const outDir = 'output/qrcodes'
await mkdir(outDir, { recursive: true })

const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>Bigdil-express - QR codes</title>
<style>
  body { font-family: -apple-system, sans-serif; margin: 0; padding: 24px; }
  h1 { text-align: center; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 24px; }
  .card { text-align: center; border: 1px solid #ddd; border-radius: 12px; padding: 16px; break-inside: avoid; }
  .card img { width: 100%; height: auto; }
  .label { font-weight: 600; margin-top: 8px; }
  @media print {
    .card { border: none; }
  }
</style>
</head>
<body>
  <h1>Bigdil-express - 8 étapes (parcours commun à toutes les équipes)</h1>
  <div class="grid">${cardsHtml}</div>
</body>
</html>`

await writeFile(`${outDir}/qrcodes.html`, html, 'utf-8')
console.log(`✅ ${outDir}/qrcodes.html (${steps.length} QR codes)`)
