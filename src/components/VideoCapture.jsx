import { useEffect, useRef, useState } from 'react'
import { Video, RotateCcw, UploadCloud, Loader2 } from 'lucide-react'

export default function VideoCapture({ onConfirm, onReset, uploading, disabled }) {
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function handleFileChange(e) {
    const selected = e.target.files?.[0]
    if (selected) setFile(selected)
  }

  function reset() {
    setFile(null)
    if (inputRef.current) inputRef.current.value = ''
    onReset?.()
  }

  if (!file) {
    return (
      <label className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 px-6 py-10 cursor-pointer hover:bg-primary/10 transition-colors">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-white">
          <Video className="h-7 w-7" />
        </div>
        <span className="font-semibold text-gray-800">Filmer la vidéo</span>
        <span className="text-sm text-gray-500 text-center">
          Appuie ici pour ouvrir la caméra
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          capture="environment"
          className="sr-only"
          disabled={disabled}
          onChange={handleFileChange}
        />
      </label>
    )
  }

  return (
    <div className="space-y-4">
      <video
        src={previewUrl}
        controls
        playsInline
        className="w-full rounded-2xl bg-black aspect-[9/16] max-h-[60vh] mx-auto"
      />
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          disabled={uploading}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-gray-300 py-3 font-medium text-gray-700 disabled:opacity-50"
        >
          <RotateCcw className="h-4 w-4" />
          Recommencer
        </button>
        <button
          type="button"
          onClick={() => onConfirm(file)}
          disabled={uploading}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-secondary py-3 font-semibold text-white disabled:opacity-60"
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Envoi...
            </>
          ) : (
            <>
              <UploadCloud className="h-4 w-4" />
              Envoyer
            </>
          )}
        </button>
      </div>
    </div>
  )
}
