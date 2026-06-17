import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { PinKeypad } from '../components/ui/PinKeypad'

const PIN_LENGTH = 4

export function SuperAdminLoginPage() {
  const { login, loading } = useAuth()
  const navigate = useNavigate()
  const [pin, setPin] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)

  const handleDigit = async (digit: string) => {
    if (pin.length >= PIN_LENGTH || loading) return
    const newPin = pin + digit
    setPin(newPin)
    setErreur(null)

    if (newPin.length === PIN_LENGTH) {
      const result = await login('SuperAdmin', newPin)
      if (result.user) {
        navigate('/superadmin', { replace: true })
      } else {
        setErreur('Accès refusé')
        setTimeout(() => setPin(''), 600)
      }
    }
  }

  const handleBackspace = () => {
    setPin((p) => p.slice(0, -1))
    setErreur(null)
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-slate-900 px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600">
            <Shield size={32} className="text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">MadinaStock</h1>
            <p className="mt-1 text-sm font-medium text-slate-400">SuperAdmin</p>
          </div>
        </div>

        <div className="rounded-2xl bg-slate-800 p-6">
          <p className="mb-6 text-center text-sm text-slate-300">Entrez votre code PIN</p>

          <div className="mb-4 flex justify-center gap-3">
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <div
                key={i}
                className={`h-4 w-4 rounded-full transition-colors ${
                  i < pin.length ? 'bg-brand-400' : 'bg-slate-600'
                }`}
              />
            ))}
          </div>

          {erreur && (
            <p className="mb-4 text-center text-sm font-medium text-red-400">{erreur}</p>
          )}

          <PinKeypad
            onDigit={handleDigit}
            onBackspace={handleBackspace}
            disabled={loading || pin.length === PIN_LENGTH}
          />
        </div>
      </div>
    </div>
  )
}
