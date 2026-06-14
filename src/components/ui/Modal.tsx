import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

/**
 * Bottom-sheet modal de base, partagée par tous les modals/feuilles de
 * l'app. Bloque le scroll du body et utilise dvh + safe-area pour rester
 * stable face au clavier virtuel et aux barres iOS Safari.
 */
export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.width = '100%'
    } else {
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.width = ''
    }

    return () => {
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.width = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full bg-white rounded-t-2xl overflow-y-auto"
        style={{
          maxHeight: '90dvh',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        }}
      >
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-4 pb-3 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button
            type="button"
            aria-label="Fermer"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-4 pt-4">{children}</div>
      </div>
    </div>
  )
}
