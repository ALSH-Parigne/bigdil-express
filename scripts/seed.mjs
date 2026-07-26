// Charge config/teams.json (ou config/teams.example.json à défaut) et
// synchronise les équipes/étapes/indices dans Supabase.
//
// Important : si une étape existe déjà (même équipe + même numéro d'ordre),
// son token est CONSERVÉ tel quel. Ça évite de devoir réimprimer des QR codes
// déjà collés sur le terrain simplement parce qu'on a corrigé une faute dans
// un indice. Seul le texte (mission/indice) est mis à jour.
//
// Usage : npm run seed

import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { customAlphabet } from 'nanoid'

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 10)

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    'Erreur : VITE_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définis dans .env'
  )
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const configPath = existsSync('config/teams.json')
  ? 'config/teams.json'
  : 'config/teams.example.json'

if (configPath === 'config/teams.example.json') {
  console.warn(
    '⚠️  config/teams.json introuvable, utilisation de config/teams.example.json ' +
    '(données de démonstration). Copiez-le vers config/teams.json pour vos vraies équipes.'
  )
}

const teams = JSON.parse(await readFile(configPath, 'utf-8'))

for (const team of teams) {
  let { data: existingTeam } = await supabase
    .from('teams')
    .select('id')
    .eq('slug', team.slug)
    .maybeSingle()

  let teamId
  if (existingTeam) {
    teamId = existingTeam.id
    await supabase.from('teams').update({ name: team.name }).eq('id', teamId)
  } else {
    const { data: inserted, error } = await supabase
      .from('teams')
      .insert({ slug: team.slug, name: team.name })
      .select('id')
      .single()
    if (error) throw error
    teamId = inserted.id
  }

  console.log(`\n=== ${team.name} (${team.slug}) ===`)

  for (const step of team.steps) {
    const { data: existingStep } = await supabase
      .from('steps')
      .select('id, token')
      .eq('team_id', teamId)
      .eq('order_index', step.order)
      .maybeSingle()

    const token = existingStep?.token ?? nanoid()

    const payload = {
      team_id: teamId,
      order_index: step.order,
      token,
      mission: step.mission,
      clue_text: step.clue,
      clue_image_url: step.clueImage ?? null,
    }

    if (existingStep) {
      await supabase.from('steps').update(payload).eq('id', existingStep.id)
    } else {
      const { error } = await supabase.from('steps').insert(payload)
      if (error) throw error
    }

    const siteUrl = process.env.SITE_URL || 'http://localhost:3000'
    console.log(`  Étape ${step.order}: ${siteUrl}/j/${token}`)
  }
}

console.log('\n✅ Synchronisation terminée. Lancez "npm run qrcodes" pour générer les QR codes imprimables.')
