import { useEffect, useState } from 'react'
import { Users, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase.js'

export default function TeamPicker({ onSelect }) {
  const [teams, setTeams] = useState(null)
  const [selectedId, setSelectedId] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error: fetchError } = await supabase
        .from('teams')
        .select('id, name')
        .order('name')
      if (cancelled) return
      if (fetchError) {
        setError("Impossible de charger la liste des équipes.")
        return
      }
      setTeams(data)
    }
    load()
    return () => { cancelled = true }
  }, [])

  function handleConfirm() {
    const team = teams.find((t) => t.id === selectedId)
    if (team) onSelect(team)
  }

  return (
    <div className="rounded-2xl bg-white shadow-custom p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <h1 className="text-lg font-bold text-gray-900">Quelle est votre équipe ?</h1>
      </div>

      {error && (
        <p className="flex items-center gap-2 text-sm text-red-600 mb-3">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </p>
      )}

      {!error && teams === null && (
        <p className="text-sm text-gray-500">Chargement des équipes...</p>
      )}

      {teams && teams.length === 0 && (
        <p className="text-sm text-gray-500">Aucune équipe n'a encore été configurée.</p>
      )}

      {teams && teams.length > 0 && (
        <>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 mb-4 text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="" disabled>Sélectionnez votre équipe</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>{team.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedId}
            className="w-full rounded-xl bg-primary py-3 font-semibold text-white disabled:opacity-50"
          >
            Valider
          </button>
        </>
      )}
    </div>
  )
}
