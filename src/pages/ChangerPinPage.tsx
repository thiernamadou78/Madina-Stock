import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../stores/appStore'
import { PinDots, PinKeypad } from '../components/ui/PinKeypad'

const PIN_LENGTH = 4

export function ChangerPinPage() {
  const user = useAppStore((s) => s.user)
  const setUser = useAppStore((s) => s.setUser)
  const navigate = useNavigate()

  const [etape, setEtape] = useState<'nouveau' | 'confirmation'>('nouveau')
  const [nouveauPin, setNouveauPin] = useState('')
  const [confirmationPin, setConfirmationPin] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const valeurAffichee = etape === 'nouveau' ? nouveauPin : confirmationPin

  const recommencer = (message: string) => {
    setErreur(message)
    setNouveauPin('')
    setConfirmationPin('')
    setEtape('nouveau')
  }

  const valider = async (confirmation: string) => {
    if (nouveauPin !== confirmation) {
      recommencer('Les deux codes ne correspondent pas — réessayez')
      return
    }
    if (!user) return

    setLoading(true)
    const { error } = await supabase.rpc('changer_pin', {
      p_user_id: user.id,
      p_nouveau_pin: confirmation,
    })
    setLoading(false)

    if (error) {
      recommencer('Erreur — réessayez')
      return
    }

    setUser({ ...user, pin_change_required: false })
    navigate(user.role === 'superadmin' ? '/superadmin' : '/select-depot', { replace: true })
  }

  const handleDigit = (digit: string) => {
    if (loading) return
    setErreur(null)

    if (etape === 'nouveau') {
      if (nouveauPin.length >= PIN_LENGTH) return
      const next = nouveauPin + digit
      setNouveauPin(next)
      if (next.length === PIN_LENGTH) setEtape('confirmation')
      return
    }

    if (confirmationPin.length >= PIN_LENGTH) return
    const next = confirmationPin + digit
    setConfirmationPin(next)
    if (next.length === PIN_LENGTH) void valider(next)
  }

  const handleBackspace = () => {
    if (loading) return
    setErreur(null)
    if (etape === 'nouveau') setNouveauPin((p) => p.slice(0, -1))
    else setConfirmationPin((p) => p.slice(0, -1))
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-brand-800 px-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center text-white">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
            <KeyRound size={28} />
          </div>
          <h1 className="text-xl font-bold">
            {etape === 'nouveau' ? 'Choisissez votre code secret' : 'Retapez le même code'}
          </h1>
          <p className="text-sm text-white/70">
            Pour protéger votre compte, choisissez un nouveau code à 4 chiffres.
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-xl">
          <PinDots value={valeurAffichee} />

          {erreur && (
            <p className="mt-3 text-center text-sm font-medium text-danger-600">{erreur}</p>
          )}

          <PinKeypad onDigit={handleDigit} onBackspace={handleBackspace} disabled={loading} />
        </div>
      </div>
    </div>
  )
}
