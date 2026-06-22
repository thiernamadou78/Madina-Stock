import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, X, XCircle } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'

const DUREE_AFFICHAGE_MS = 6000

export function Toast() {
  const toast = useAppStore((s) => s.toast)
  const clearToast = useAppStore((s) => s.clearToast)
  const navigate = useNavigate()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!toast) return
    setVisible(false)
    const showTimer = setTimeout(() => setVisible(true), 20)
    const hideTimer = setTimeout(clearToast, DUREE_AFFICHAGE_MS)
    return () => {
      clearTimeout(showTimer)
      clearTimeout(hideTimer)
    }
  }, [toast, clearToast])

  if (!toast) return null

  const succes = toast.variant === 'success'

  return (
    <div
      className={`fixed left-4 right-4 top-3 z-50 mx-auto max-w-sm transition-all duration-200 ease-out ${
        visible ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
      }`}
    >
      <button
        type="button"
        onClick={() => {
          clearToast()
          navigate('/historique')
        }}
        className={`flex w-full items-start gap-3 rounded-2xl p-4 text-left shadow-xl ${
          succes ? 'bg-brand-800' : 'bg-danger-600'
        }`}
      >
        <div className="mt-0.5 shrink-0 text-white">
          {succes ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">{toast.titre}</p>
          <p className="mt-0.5 text-xs text-white/90">{toast.message}</p>
        </div>
        <span
          role="button"
          aria-label="Fermer"
          onClick={(e) => {
            e.stopPropagation()
            clearToast()
          }}
          className="shrink-0 text-white/70 hover:text-white"
        >
          <X size={16} />
        </span>
      </button>
    </div>
  )
}
