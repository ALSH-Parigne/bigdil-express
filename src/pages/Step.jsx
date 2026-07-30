import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AlertTriangle, Lightbulb, Sparkles } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabase.js'
import VideoCapture from '../components/VideoCapture.jsx'
import PhotoCapture from '../components/PhotoCapture.jsx'

// Supabase (plan gratuit) refuse tout fichier de plus de 50 Mo. On garde une
// marge pour l'encapsulation de la requête : au-delà, inutile de tenter
// l'envoi, il échouerait après plusieurs minutes en 4G.
const MAX_UPLOAD_BYTES = 48 * 1024 * 1024

export default function Step() {
  const { token } = useParams()
  const [status, setStatus] = useState('loading') // loading | not-found | ready | config-missing
  const [step, setStep] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [tooBig, setTooBig] = useState(null) // taille en Mo du fichier refusé
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
    setUploadError(null)
    setTooBig(null)

    // Vérification avant l'envoi : inutile de faire patienter 3 minutes en 4G
    // pour un fichier que le serveur refusera de toute façon.
    if (file.size > MAX_UPLOAD_BYTES) {
      setTooBig(Math.round(file.size / (1024 * 1024)))
      return
    }

    setUploading(true)
    try {
      const defaultExtension = step.capture_type === 'photo' ? 'jpg' : 'mp4'
      const extension = (file.name.split('.').pop() || defaultExtension).toLowerCase()
      const path = `${step.step_id}/${Date.now()}.${extension}`
      const defaultContentType = step.capture_type === 'photo' ? 'image/jpeg' : 'video/mp4'

      const { error: uploadErr } = await supabase.storage
        .from('videos')
        .upload(path, file, { contentType: file.type || defaultContentType })
      if (uploadErr) throw uploadErr

      const { error: insertErr } = await supabase
        .from('submissions')
        .insert({ step_id: step.step_id, video_path: path })
      if (insertErr) throw insertErr

      setRevealed(true)
    } catch (err) {
      console.error(err)
      // Filet de sécurité : si le serveur refuse quand même pour cause de
      // taille, on bascule sur le même message que la vérification locale.
      const message = `${err?.message ?? ''} ${err?.error ?? ''}`.toLowerCase()
      if (message.includes('too large') || message.includes('entitytoolarge') || err?.statusCode === '413') {
        setTooBig(Math.round(file.size / (1024 * 1024)))
      } else {
        setUploadError("L'envoi a échoué. Vérifie ta connexion et réessaie.")
      }
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
          {step.mission_video_url ? (
            <video
              src={step.mission_video_url}
              controls
              playsInline
              className="w-full rounded-xl bg-black aspect-video"
            />
          ) : (
            <p className="text-gray-700">{step.mission}</p>
          )}

          {/* Une vidéo 4K de 15 s pèse ~130 Mo et dépasse la limite d'envoi.
              La même en 1080p tombe à ~18 Mo : on le dit avant qu'ils filment. */}
          {step.capture_type !== 'photo' && !revealed && (
            <p className="mt-4 rounded-xl bg-blue-50 px-4 py-3 text-sm text-gray-600">
              📱 <span className="font-semibold">Merci de filmer en 1080p ou 720p</span>, pas en 4K :
              la vidéo serait trop lourde pour être envoyée.
              <span className="mt-1 block text-xs text-gray-500">
                <b>iPhone</b> : en haut à gauche de l'écran, dans l'appareil photo en mode vidéo.
              </span>
              <span className="mt-0.5 block text-xs text-gray-500">
                <b>Android</b> : cherchez « FHD » en haut de l'écran, ou l'engrenage ⚙️ de
                l'appareil photo.
              </span>
            </p>
          )}
        </div>

        {!revealed && (
          <>
            {step.capture_type === 'photo' ? (
              <PhotoCapture
                onConfirm={handleConfirm}
                onReset={() => { setTooBig(null); setUploadError(null) }}
                uploading={uploading}
              />
            ) : (
              <VideoCapture
                onConfirm={handleConfirm}
                onReset={() => { setTooBig(null); setUploadError(null) }}
                uploading={uploading}
              />
            )}
            {uploadError && (
              <p className="mt-3 text-center text-sm text-red-600">{uploadError}</p>
            )}

            {tooBig && (
              <div className="mt-4 rounded-2xl border-2 border-accent/40 bg-accent/10 p-5 animate-fade-in">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-accent" />
                  <p className="font-bold text-gray-900">
                    {step.capture_type === 'photo' ? 'Photo trop lourde' : 'Vidéo trop lourde'}
                  </p>
                </div>
                <p className="text-sm text-gray-700">
                  {step.capture_type === 'photo' ? 'Ta photo fait' : 'Ta vidéo fait'} {tooBig} Mo,
                  et le maximum est de 50 Mo.{' '}
                  {step.capture_type === 'photo'
                    ? 'Reprends une photo, ça devrait passer !'
                    : 'Appuie sur « Recommencer » et refilme plus court — 15 secondes suffisent !'}
                </p>
                <button
                  type="button"
                  onClick={() => setRevealed(true)}
                  className="mt-4 w-full rounded-xl border border-gray-300 bg-white py-2.5 text-sm font-medium text-gray-600"
                >
                  Ça ne marche toujours pas : voir l'indice
                </button>
              </div>
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
            {tooBig ? (
              <div className="mt-4 flex items-start gap-2 text-sm text-gray-500">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  {step.capture_type === 'photo' ? 'La photo' : 'La vidéo'} était trop lourde pour
                  être enregistrée, mais continuez le parcours : montrez-la à votre animateur !
                </span>
              </div>
            ) : (
              <div className="mt-4 flex items-center gap-2 text-sm text-secondary font-medium">
                <Sparkles className="h-4 w-4" />
                {step.capture_type === 'photo' ? 'Photo bien reçue, bravo !' : 'Vidéo bien reçue, bravo !'}
              </div>
            )}
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
