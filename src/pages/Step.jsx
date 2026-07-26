import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AlertTriangle, Lightbulb, Sparkles } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabase.js'
import VideoCapture from '../components/VideoCapture.jsx'

export default function Step() {
  const { token } = useParams()
  const [status, setStatus] = useState('loading') // loading | not-found | ready | config-missing
  const [step, setStep] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setStatus('config-missing')
      return
    }

    let cancelled = false
    async function load() {
      const { data, error } = await supabase.rpc('get_step_by_token', { p_token: token })
      if (cancelled) return
      if (error || !data || data.length === 0) {
        setStatus('not-found')
        return
      }
      setStep(data[0])
      setStatus('ready')
    }
    load()
    return () => { cancelled = true }
  }, [token])

  async function handleConfirm(file) {
    setUploading(true)
    setUploadError(null)
    try {
      const extension = (file.name.split('.').pop() || 'mp4').toLowerCase()
      const path = `${step.step_id}/${Date.now()}.${extension}`

      const { error: uploadErr } = await supabase.storage
        .from('videos')
        .upload(path, file, { contentType: file.type || 'video/mp4' })
      if (uploadErr) throw uploadErr

      const { error: insertErr } = await supabase
        .from('submissions')
        .insert({ step_id: step.step_id, video_path: path })
      if (insertErr) throw insertErr

      setRevealed(true)
    } catch (err) {
      console.error(err)
      setUploadError("L'envoi a échoué. Vérifie ta connexion et réessaie.")
    } finally {
      setUploading(false)
    }
  }

  if (status === 'loading') {
    return <CenteredMessage>Chargement de l'étape...</CenteredMessage>
  }

  if (status === 'config-missing') {
    return (
      <CenteredMessage icon={<AlertTriangle className="h-8 w-8 text-accent" />}>
        Le site n'est pas encore relié à Supabase. Renseignez <code>VITE_SUPABASE_URL</code> et{' '}
        <code>VITE_SUPABASE_ANON_KEY</code> dans le fichier <code>.env</code>.
      </CenteredMessage>
    )
  }

  if (status === 'not-found') {
    return (
      <CenteredMessage icon={<AlertTriangle className="h-8 w-8 text-red-500" />}>
        Ce QR code ne correspond à aucune étape connue. Demande de l'aide à ton animateur !
      </CenteredMessage>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white px-4 py-8">
      <div className="mx-auto max-w-md animate-fade-in">
        <p className="text-center text-sm font-medium uppercase tracking-wide text-primary mb-4">
          Étape {step.order_index}
        </p>

        <div className="rounded-2xl bg-white shadow-custom p-6 mb-6">
          <h1 className="text-lg font-bold text-gray-900 mb-2">Mission</h1>
          {step.mission_video_url && (
            <video
              src={step.mission_video_url}
              controls
              playsInline
              className="w-full rounded-xl bg-black mb-3 aspect-video"
            />
          )}
          <p className="text-gray-700">{step.mission}</p>
        </div>

        {!revealed && (
          <>
            <VideoCapture onConfirm={handleConfirm} uploading={uploading} />
            {uploadError && (
              <p className="mt-3 text-center text-sm text-red-600">{uploadError}</p>
            )}
          </>
        )}

        {revealed && (
          <div className="rounded-2xl bg-white shadow-custom p-6 animate-fade-in">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/20">
                <Lightbulb className="h-5 w-5 text-accent" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Indice débloqué !</h2>
            </div>
            <p className="text-gray-700 whitespace-pre-line">{step.clue_text}</p>
            {step.clue_image_url && (
              <img
                src={step.clue_image_url}
                alt="Indice"
                className="mt-4 w-full rounded-xl"
              />
            )}
            <div className="mt-4 flex items-center gap-2 text-sm text-secondary font-medium">
              <Sparkles className="h-4 w-4" />
              Vidéo bien reçue, bravo !
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function CenteredMessage({ children, icon }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 text-center">
      <div className="max-w-sm">
        {icon && <div className="mb-4 flex justify-center">{icon}</div>}
        <p className="text-gray-600">{children}</p>
      </div>
    </div>
  )
}
