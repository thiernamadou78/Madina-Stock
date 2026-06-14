import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Delete } from 'lucide-react'
import { useAuth, listerUtilisateurs } from '../hooks/useAuth'
import { Button } from '../components/ui/Button'
import type { Utilisateur } from '../types'

const PIN_LENGTH = 4
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
const TEL_REGEX = /^\+224\d{9}$/

function PinDots({ value }: { value: string }) {
  return (
    <div className="mt-2 flex justify-center gap-3">
      {Array.from({ length: PIN_LENGTH }).map((_, i) => (
        <div
          key={i}
          className={`h-3 w-3 rounded-full ${i < value.length ? 'bg-brand-800' : 'bg-gray-200'}`}
        />
      ))}
    </div>
  )
}

function PinKeypad({
  onDigit,
  onBackspace,
}: {
  onDigit: (digit: string) => void
  onBackspace: () => void
}) {
  return (
    <div className="mt-4 grid grid-cols-3 gap-3">
      {DIGITS.map((digit) => (
        <button
          key={digit}
          type="button"
          onClick={() => onDigit(digit)}
          className="rounded-2xl bg-gray-50 py-4 text-2xl font-semibold text-gray-700 hover:bg-gray-100 active:bg-gray-200"
        >
          {digit}
        </button>
      ))}
      <button
        type="button"
        onClick={onBackspace}
        aria-label="Effacer"
        className="flex items-center justify-center rounded-2xl bg-gray-50 py-4 text-gray-500 hover:bg-gray-100 active:bg-gray-200"
      >
        <Delete size={22} />
      </button>
      <button
        type="button"
        onClick={() => onDigit('0')}
        className="rounded-2xl bg-gray-50 py-4 text-2xl font-semibold text-gray-700 hover:bg-gray-100 active:bg-gray-200"
      >
        0
      </button>
      <div />
    </div>
  )
}

export function LoginPage() {
  const { login, loginTel, loading } = useAuth()
  const navigate = useNavigate()

  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([])
  const [chargementUtilisateurs, setChargementUtilisateurs] = useState(true)
  const [erreurUtilisateurs, setErreurUtilisateurs] = useState<string | null>(null)

  // --- Section propriétaire ---
  const [proprietaireId, setProprietaireId] = useState('')
  const [pinProprietaire, setPinProprietaire] = useState('')
  const [erreurProprietaire, setErreurProprietaire] = useState<string | null>(null)

  // --- Section gestionnaire ---
  const [tel, setTel] = useState('')
  const [pinGestionnaire, setPinGestionnaire] = useState('')
  const [erreurGestionnaire, setErreurGestionnaire] = useState<string | null>(null)

  useEffect(() => {
    listerUtilisateurs()
      .then((users) => {
        setUtilisateurs(users)
        const proprietaires = users.filter((u) => u.role === 'proprietaire')
        if (proprietaires.length > 0) setProprietaireId(proprietaires[0].id)
      })
      .catch((err) => {
        console.error('Erreur chargement utilisateurs:', err)
        setErreurUtilisateurs('Impossible de charger les utilisateurs')
      })
      .finally(() => setChargementUtilisateurs(false))
  }, [])

  const proprietaires = utilisateurs.filter((u) => u.role === 'proprietaire')

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
    const utilisateur = proprietaires.find((u) => u.id === proprietaireId)
    if (!utilisateur || pinProprietaire.length !== PIN_LENGTH) return

    const { user, error: err } = await login(utilisateur.nom, pinProprietaire)
    if (err || !user) {
      setErreurProprietaire('Code PIN incorrect')
      setPinProprietaire('')
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
    if (!TEL_REGEX.test(tel.trim()) || pinGestionnaire.length !== PIN_LENGTH) return

    const { user, error: err } = await loginTel(tel.trim(), pinGestionnaire)
    if (err || !user) {
      setErreurGestionnaire('Téléphone ou code PIN incorrect')
      setPinGestionnaire('')
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
        <h1 className="mt-3 text-2xl font-bold">MadinaStock</h1>
        <p className="mt-1 text-sm text-white/70">Gestion de stock multi-dépôts</p>
      </div>

      {/* Section Propriétaire */}
      <div className="mt-6 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-sm font-bold uppercase tracking-wide text-brand-800">Propriétaire</h2>

        <label className="mt-4 block text-sm font-medium text-gray-700">
          Nom
          {chargementUtilisateurs ? (
            <div className="mt-1 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-400">
              Chargement...
            </div>
          ) : erreurUtilisateurs ? (
            <div className="mt-1 rounded-xl border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-600">
              {erreurUtilisateurs}
            </div>
          ) : proprietaires.length === 0 ? (
            <div className="mt-1 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-600">
              Aucun propriétaire trouvé
            </div>
          ) : (
            <select
              value={proprietaireId}
              onChange={(e) => {
                setProprietaireId(e.target.value)
                setPinProprietaire('')
                setErreurProprietaire(null)
              }}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
            >
              {proprietaires.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nom}
                </option>
              ))}
            </select>
          )}
        </label>

        <div className="mt-4">
          <span className="block text-sm font-medium text-gray-700">Code PIN</span>
          <PinDots value={pinProprietaire} />
        </div>

        <PinKeypad onDigit={handleDigitProprietaire} onBackspace={handleBackspaceProprietaire} />

        {erreurProprietaire && (
          <p className="mt-3 text-center text-sm text-danger-600">{erreurProprietaire}</p>
        )}

        <Button
          fullWidth
          className="mt-4"
          onClick={handleSubmitProprietaire}
          disabled={loading || chargementUtilisateurs || !proprietaireId || pinProprietaire.length !== PIN_LENGTH}
        >
          {loading ? 'Connexion...' : 'Se connecter'}
        </Button>
      </div>

      {/* Section Gestionnaire */}
      <div className="mt-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
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
            placeholder="+224620000001"
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
          />
        </label>

        <div className="mt-4">
          <span className="block text-sm font-medium text-gray-700">Code PIN</span>
          <PinDots value={pinGestionnaire} />
        </div>

        <PinKeypad onDigit={handleDigitGestionnaire} onBackspace={handleBackspaceGestionnaire} />

        {erreurGestionnaire && (
          <p className="mt-3 text-center text-sm text-danger-600">{erreurGestionnaire}</p>
        )}

        <Button
          fullWidth
          className="mt-4"
          onClick={handleSubmitGestionnaire}
          disabled={loading || !TEL_REGEX.test(tel.trim()) || pinGestionnaire.length !== PIN_LENGTH}
        >
          {loading ? 'Connexion...' : 'Se connecter'}
        </Button>
      </div>
    </div>
  )
}
