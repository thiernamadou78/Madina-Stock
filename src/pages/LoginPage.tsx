import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogIn, Loader2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { PinDots, PinKeypad } from '../components/ui/PinKeypad'
import { normaliserTelephone } from '../lib/utils'

const PIN_LENGTH = 4
const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 5 * 60 * 1000

export function LoginPage() {
  const { loginTel, loading } = useAuth()
  const navigate = useNavigate()

  const [tel, setTel] = useState('')
  const [pin, setPin] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [attempts, setAttempts] = useState(0)
  const [lockedUntil, setLockedUntil] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!lockedUntil) return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [lockedUntil])

  const isLocked = lockedUntil !== null && now < lockedUntil

  const handleDigit = (digit: string) => {
    if (pin.length >= PIN_LENGTH) return
    setErreur(null)
    setPin((p) => p + digit)
  }

  const handleBackspace = () => {
    setErreur(null)
    setPin((p) => p.slice(0, -1))
  }

  const handleSubmit = async () => {
    if (isLocked) return
    if (!tel.trim() || pin.length !== PIN_LENGTH) return

    const telNormalise = normaliserTelephone(tel.trim())
    const { user, error: err } = await loginTel(telNormalise, pin)

    if (err || !user) {
      setPin('')
      const next = attempts + 1
      if (next >= MAX_ATTEMPTS) {
        setAttempts(0)
        setLockedUntil(Date.now() + LOCKOUT_MS)
        setErreur(null)
      } else {
        setAttempts(next)
        setErreur(err ?? 'Téléphone ou code PIN incorrect')
      }
      return
    }

    if (user.pin_change_required) {
      navigate('/changer-pin', { replace: true })
    } else {
      navigate('/select-depot')
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center bg-brand-800 px-6 py-8">
      <div className="flex w-full max-w-sm flex-col items-center text-white">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-xl font-bold text-brand-800">
          MS
        </div>
        <h1 className="mt-3 text-2xl font-bold">MADINA STOCK</h1>
        <p className="mt-1 text-sm text-white/70">Gestion de stock multi-dépôts</p>
      </div>

      <div className="mt-6 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <label className="block text-sm font-medium text-gray-700">
          Numéro de téléphone
          <input
            type="tel"
            value={tel}
            onChange={(e) => {
              setTel(e.target.value)
              setErreur(null)
            }}
            placeholder="Ex: 622 000 001"
            autoComplete="tel"
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-base focus:border-brand-400 focus:outline-none"
          />
        </label>
        <p className="mt-1 text-xs text-gray-400">
          Format accepté : 622 000 001 ou +224 622 000 001
        </p>

        <div className="mt-4">
          <span className="block text-sm font-medium text-gray-700">Code secret</span>
          <PinDots value={pin} />
        </div>

        <PinKeypad
          onDigit={handleDigit}
          onBackspace={handleBackspace}
          disabled={isLocked}
          onAction={handleSubmit}
          actionDisabled={loading || !tel.trim() || pin.length !== PIN_LENGTH || isLocked}
          actionIcon={loading ? <Loader2 size={22} className="animate-spin" /> : <LogIn size={22} />}
        />

        {isLocked ? (
          <p className="mt-3 text-center text-sm text-danger-600">
            Trop de tentatives — réessayez dans 5 min
          </p>
        ) : (
          erreur && <p className="mt-3 text-center text-sm text-danger-600">{erreur}</p>
        )}
      </div>
    </div>
  )
}
