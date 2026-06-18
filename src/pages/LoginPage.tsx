import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/ui/Button'
import { PinDots, PinKeypad } from '../components/ui/PinKeypad'
import { normaliserTelephone } from '../lib/utils'

const PIN_LENGTH = 4
const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 5 * 60 * 1000

type RoleChoix = 'proprietaire' | 'gestionnaire'

export function LoginPage() {
  const { login, loginTel, loading } = useAuth()
  const navigate = useNavigate()

  const [role, setRole] = useState<RoleChoix | ''>('')
  const [visible, setVisible] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  // --- Section propriétaire ---
  const [nomProprietaire, setNomProprietaire] = useState('')
  const [pinProprietaire, setPinProprietaire] = useState('')
  const [erreurProprietaire, setErreurProprietaire] = useState<string | null>(null)
  const [attemptsProprietaire, setAttemptsProprietaire] = useState(0)
  const [lockedUntilProprietaire, setLockedUntilProprietaire] = useState<number | null>(null)

  // --- Section gestionnaire ---
  const [tel, setTel] = useState('')
  const [pinGestionnaire, setPinGestionnaire] = useState('')
  const [erreurGestionnaire, setErreurGestionnaire] = useState<string | null>(null)
  const [attemptsGestionnaire, setAttemptsGestionnaire] = useState(0)
  const [lockedUntilGestionnaire, setLockedUntilGestionnaire] = useState<number | null>(null)

  // Anime l'apparition du formulaire (translateY + opacity, 200ms ease-out)
  useEffect(() => {
    if (!role) {
      setVisible(false)
      return
    }
    setVisible(false)
    const timer = setTimeout(() => setVisible(true), 20)
    return () => clearTimeout(timer)
  }, [role])

  // Décompte du verrouillage après 5 échecs
  useEffect(() => {
    if (!lockedUntilProprietaire && !lockedUntilGestionnaire) return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [lockedUntilProprietaire, lockedUntilGestionnaire])

  const isLockedProprietaire = lockedUntilProprietaire !== null && now < lockedUntilProprietaire
  const isLockedGestionnaire = lockedUntilGestionnaire !== null && now < lockedUntilGestionnaire

  const handleDigitProprietaire = (digit: string) => {
    if (pinProprietaire.length >= PIN_LENGTH) return
    setErreurProprietaire(null)
    setPinProprietaire((p) => p + digit)
  }

  const handleBackspaceProprietaire = () => {
    setErreurProprietaire(null)
    setPinProprietaire((p) => p.slice(0, -1))
  }

  const handleSubmitProprietaire = async () => {
    if (isLockedProprietaire) return
    if (!nomProprietaire.trim() || pinProprietaire.length !== PIN_LENGTH) return

    const { user, error: err } = await login(nomProprietaire.trim(), pinProprietaire)
    if (err || !user) {
      setPinProprietaire('')
      const next = attemptsProprietaire + 1
      if (next >= MAX_ATTEMPTS) {
        setAttemptsProprietaire(0)
        setLockedUntilProprietaire(Date.now() + LOCKOUT_MS)
        setErreurProprietaire(null)
      } else {
        setAttemptsProprietaire(next)
        setErreurProprietaire(err ?? 'Nom ou code PIN incorrect')
      }
      return
    }

    navigate('/select-depot')
  }

  const handleDigitGestionnaire = (digit: string) => {
    if (pinGestionnaire.length >= PIN_LENGTH) return
    setErreurGestionnaire(null)
    setPinGestionnaire((p) => p + digit)
  }

  const handleBackspaceGestionnaire = () => {
    setErreurGestionnaire(null)
    setPinGestionnaire((p) => p.slice(0, -1))
  }

  const handleSubmitGestionnaire = async () => {
    if (isLockedGestionnaire) return
    if (!tel.trim() || pinGestionnaire.length !== PIN_LENGTH) return

    const telNormalise = normaliserTelephone(tel.trim())
    const { user, error: err } = await loginTel(telNormalise, pinGestionnaire)

    if (err || !user) {
      setPinGestionnaire('')
      const next = attemptsGestionnaire + 1
      if (next >= MAX_ATTEMPTS) {
        setAttemptsGestionnaire(0)
        setLockedUntilGestionnaire(Date.now() + LOCKOUT_MS)
        setErreurGestionnaire(null)
      } else {
        setAttemptsGestionnaire(next)
        setErreurGestionnaire(err ?? 'Téléphone ou code PIN incorrect')
      }
      return
    }

    navigate('/select-depot')
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
          Vous êtes :
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as RoleChoix | '')}
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
          >
            <option value="">Sélectionner...</option>
            <option value="proprietaire">👤 Propriétaire</option>
            <option value="gestionnaire">👷 Gestionnaire</option>
          </select>
        </label>
      </div>

      {role === 'proprietaire' && (
        <div
          key="proprietaire"
          className={`mt-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl transition-all duration-200 ease-out ${
            visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}
        >
          <h2 className="text-sm font-bold uppercase tracking-wide text-brand-800">Propriétaire</h2>

          <label className="mt-4 block text-sm font-medium text-gray-700">
            Nom complet
            <input
              type="text"
              value={nomProprietaire}
              onChange={(e) => {
                setNomProprietaire(e.target.value)
                setPinProprietaire('')
                setErreurProprietaire(null)
              }}
              placeholder="Ex: Mamadou Diallo"
              autoComplete="off"
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
            />
          </label>

          <div className="mt-4">
            <span className="block text-sm font-medium text-gray-700">Code PIN</span>
            <PinDots value={pinProprietaire} />
          </div>

          <PinKeypad
            onDigit={handleDigitProprietaire}
            onBackspace={handleBackspaceProprietaire}
            disabled={isLockedProprietaire}
          />

          {isLockedProprietaire ? (
            <p className="mt-3 text-center text-sm text-danger-600">
              Trop de tentatives — réessayez dans 5 min
            </p>
          ) : (
            erreurProprietaire && (
              <p className="mt-3 text-center text-sm text-danger-600">{erreurProprietaire}</p>
            )
          )}

          <Button
            fullWidth
            className="mt-4"
            onClick={handleSubmitProprietaire}
            disabled={
              loading ||
              !nomProprietaire.trim() ||
              pinProprietaire.length !== PIN_LENGTH ||
              isLockedProprietaire
            }
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </Button>
        </div>
      )}

      {role === 'gestionnaire' && (
        <div
          key="gestionnaire"
          className={`mt-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl transition-all duration-200 ease-out ${
            visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}
        >
          <h2 className="text-sm font-bold uppercase tracking-wide text-brand-800">Gestionnaire</h2>

          <label className="mt-4 block text-sm font-medium text-gray-700">
            Numéro de téléphone
            <input
              type="tel"
              value={tel}
              onChange={(e) => {
                setTel(e.target.value)
                setErreurGestionnaire(null)
              }}
              placeholder="Ex: 622 000 001"
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
            />
          </label>
          <p className="mt-1 text-xs text-gray-400">
            Format accepté : 622 000 001 ou +224 622 000 001
          </p>

          <div className="mt-4">
            <span className="block text-sm font-medium text-gray-700">Code PIN</span>
            <PinDots value={pinGestionnaire} />
          </div>

          <PinKeypad
            onDigit={handleDigitGestionnaire}
            onBackspace={handleBackspaceGestionnaire}
            disabled={isLockedGestionnaire}
          />

          {isLockedGestionnaire ? (
            <p className="mt-3 text-center text-sm text-danger-600">
              Trop de tentatives — réessayez dans 5 min
            </p>
          ) : (
            erreurGestionnaire && (
              <p className="mt-3 text-center text-sm text-danger-600">{erreurGestionnaire}</p>
            )
          )}

          <Button
            fullWidth
            className="mt-4"
            onClick={handleSubmitGestionnaire}
            disabled={loading || !tel.trim() || pinGestionnaire.length !== PIN_LENGTH || isLockedGestionnaire}
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </Button>
        </div>
      )}
    </div>
  )
}
