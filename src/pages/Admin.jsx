import { useEffect, useMemo, useState } from 'react'
import { Lock, RefreshCw, Film } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabase.js'

const SESSION_KEY = 'bigdil-express-admin-password'

export default function Admin() {
  const [password, setPassword] = useState('')
  const [submissions, setSubmissions] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [stepFilter, setStepFilter] = useState('')

  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY)
    if (saved) {
      setPassword(saved)
      load(saved)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load(pwd) {
    setLoading(true)
    setError(null)
    const { data, error: rpcError } = await supabase.rpc('admin_list_submissions', {
      p_password: pwd,
    })
    setLoading(false)
    if (rpcError) {
      setError('Mot de passe incorrect.')
      sessionStorage.removeItem(SESSION_KEY)
      setSubmissions(null)
      return
    }
    sessionStorage.setItem(SESSION_KEY, pwd)
    setSubmissions(data)
  }

  function handleSubmit(e) {
    e.preventDefault()
    load(password)
  }

  const stepNumbers = useMemo(
    () => [...new Set((submissions ?? []).map((s) => s.order_index))].sort((a, b) => a - b),
    [submissions]
  )
  const filtered = (submissions ?? []).filter(
    (s) => !stepFilter || String(s.order_index) === stepFilter
  )

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center text-gray-600">
        Supabase n'est pas configuré (fichier .env manquant).
      </div>
    )
  }

  if (!submissions) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white rounded-2xl shadow-custom p-6">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-center text-lg font-bold text-gray-900 mb-4">Espace animateurs</h1>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe"
            className="w-full rounded-xl border border-gray-300 px-4 py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {error && <p className="text-sm text-red-600 mb-3 text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary py-3 font-semibold text-white disabled:opacity-60"
          >
            {loading ? 'Vérification...' : 'Entrer'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">
            Vidéos reçues ({filtered.length}/{submissions.length})
          </h1>
          <button
            onClick={() => load(password)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700"
          >
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </button>
        </div>

        <div className="flex gap-3 mb-6">
          <select
            value={stepFilter}
            onChange={(e) => setStepFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Toutes les étapes</option>
            {stepNumbers.map((n) => (
              <option key={n} value={n}>Étape {n}</option>
            ))}
          </select>
        </div>

        {submissions.length === 0 && (
          <p className="text-gray-500">Aucune vidéo envoyée pour l'instant.</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map((sub, i) => {
            const { data } = supabase.storage.from('videos').getPublicUrl(sub.video_path)
            const isPhoto = /\.(jpe?g|png|webp|heic|heif)$/i.test(sub.video_path)
            return (
              <div key={i} className="bg-white rounded-2xl shadow-custom overflow-hidden">
                {isPhoto ? (
                  <img src={data.publicUrl} alt="" className="w-full bg-black aspect-video object-contain" />
                ) : (
                  <video src={data.publicUrl} controls playsInline className="w-full bg-black aspect-video" />
                )}
                <div className="p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <Film className="h-4 w-4 text-primary" />
                    Étape {sub.order_index}
                  </div>
                  <p className="mt-1 text-sm text-gray-500">{sub.mission}</p>
                  <p className="mt-2 text-xs text-gray-400">
                    {new Date(sub.created_at).toLocaleString('fr-FR')}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
