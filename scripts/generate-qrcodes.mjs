// Génère une page HTML imprimable par équipe, avec un QR code par étape.
// Ouvrez les fichiers générés dans un navigateur et faites Cmd+P / Ctrl+P pour imprimer.
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

const { data: teams, error: teamsError } = await supabase
  .from('teams')
  .select('id, slug, name')
  .order('slug')
if (teamsError) throw teamsError

const outDir = 'output/qrcodes'
await mkdir(outDir, { recursive: true })

let allTeamsHtml = ''

for (const team of teams) {
  const { data: steps, error: stepsError } = await supabase
    .from('steps')
    .select('order_index, token')
    .eq('team_id', team.id)
    .order('order_index')
  if (stepsError) throw stepsError

  let cardsHtml = ''
  for (const step of steps) {
    const url = `${SITE_URL}/j/${step.token}`
    const dataUrl = await QRCode.toDataURL(url, { margin: 1, width: 400 })
    cardsHtml += `
      <div class="card">
        <img src="${dataUrl}" alt="QR code étape ${step.order_index}" />
        <p class="label">${team.name} — Étape ${step.order_index}</p>
      </div>`
  }

  const teamHtml = renderPage(team.name, cardsHtml)
  await writeFile(`${outDir}/${team.slug}.html`, teamHtml, 'utf-8')
  allTeamsHtml += `<h2 class="team-title">${team.name}</h2><div class="grid">${cardsHtml}</div>`
  console.log(`✅ ${outDir}/${team.slug}.html (${steps.length} étapes)`)
}

await writeFile(`${outDir}/all.html`, renderPage('Tous les parcours', allTeamsHtml), 'utf-8')
console.log(`✅ ${outDir}/all.html (toutes les équipes)`)

function renderPage(title, bodyHtml) {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>${title} - QR codes</title>
<style>
  body { font-family: -apple-system, sans-serif; margin: 0; padding: 24px; }
  h1 { text-align: center; }
  .team-title { margin-top: 40px; page-break-before: always; }
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
  <h1>${title}</h1>
  ${bodyHtml}
</body>
</html>`
}
