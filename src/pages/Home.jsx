import { QrCode, Video, Sparkles } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white px-6 py-12 text-center">
      <div className="animate-fade-in max-w-md w-full">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary shadow-custom">
          <QrCode className="h-10 w-10 text-white" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Chasse au trésor vidéo
        </h1>
        <p className="text-gray-500 mb-8">
          ALSH Parigné-sur-Braye
        </p>

        <div className="bg-white rounded-2xl shadow-custom p-6 text-left space-y-5">
          <Step icon={<QrCode className="h-5 w-5 text-primary" />} text="Scanne le QR code caché sur ton parcours" />
          <Step icon={<Video className="h-5 w-5 text-secondary" />} text="Filme ta vidéo pour valider l'épreuve" />
          <Step icon={<Sparkles className="h-5 w-5 text-accent" />} text="Envoie-la et découvre l'indice suivant !" />
        </div>

        <p className="mt-8 text-sm text-gray-400">
          Aucun QR code scanné pour l'instant. Demande à ton animateur où trouver le premier !
        </p>
      </div>
    </div>
  )
}

function Step({ icon, text }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100">
        {icon}
      </div>
      <p className="text-gray-700">{text}</p>
    </div>
  )
}
