import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'

interface ConfirmModalProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  danger,
  loading,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal isOpen={open} onClose={onCancel} title={title}>
      <p className="text-sm text-gray-600">{message}</p>

      <div className="mt-5 flex gap-3 pb-4">
        <Button variant="ghost" fullWidth onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          variant={danger ? 'danger' : 'primary'}
          fullWidth
          onClick={onConfirm}
          disabled={loading}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
