import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Delete } from 'lucide-react'
import { useAuth, listerUtilisateurs } from '../hooks/useAuth'
import { Button } from '../components/ui/Button'
import type { Utilisateur } from '../types'

const PIN_LENGTH = 4
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

export function LoginPage() {
  const { login, loading } = useAuth()
  const navigate = useNavigate()
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([])
  const [utilisateurId, setUtilisateurId] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listerUtilisateurs().then((users) => {
      setUtilisateurs(users)
      if (users.length > 0) setUtilisateurId(users[0].id)
    })
  }, [])

  const handleDigit = (digit: string) => {
    if (pin.length >= PIN_LENGTH) return
    setError(null)
    setPin((p) => p + digit)
  }

  const handleBackspace = () => {
    setError(null)
    setPin((p) => p.slice(0, -1))
  }

  const handleSubmit = async () => {
    const utilisateur = utilisateurs.find((u) => u.id === utilisateurId)
    if (!utilisateur || pin.length !== PIN_LENGTH) return

    const { user, error: err } = await login(utilisateur.nom, pin)
    if (err || !user) {
      setError('Code PIN incorrect')
      setPin('')
      return
    }

    navigate('/select-depot')
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-800 px-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-800 text-xl font-bold text-white">
            MS
          </div>
          <h1 className="mt-3 text-2xl font-bold text-brand-800">MadinaStock</h1>
          <p className="mt-1 text-sm text-gray-500">Gestion de stock multi-dépôts</p>
        </div>

        <label className="mt-6 block text-sm font-medium text-gray-700">
          Utilisateur
          <select
            value={utilisateurId}
            onChange={(e) => {
              setUtilisateurId(e.target.value)
              setPin('')
              setError(null)
            }}
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
          >
            {utilisateurs.length === 0 && <option value="">Chargement...</option>}
            {utilisateurs.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nom} — {u.role}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-4">
          <span className="block text-sm font-medium text-gray-700">Code PIN</span>
          <div className="mt-2 flex justify-center gap-3">
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <div
                key={i}
                className={`h-3 w-3 rounded-full ${i < pin.length ? 'bg-brand-800' : 'bg-gray-200'}`}
              />
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {DIGITS.map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              className="rounded-2xl bg-gray-50 py-4 text-2xl font-semibold text-gray-700 hover:bg-gray-100 active:bg-gray-200"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={handleBackspace}
            aria-label="Effacer"
            className="flex items-center justify-center rounded-2xl bg-gray-50 py-4 text-gray-500 hover:bg-gray-100 active:bg-gray-200"
          >
            <Delete size={22} />
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="rounded-2xl bg-gray-50 py-4 text-2xl font-semibold text-gray-700 hover:bg-gray-100 active:bg-gray-200"
          >
            0
          </button>
          <div />
        </div>

        {error && <p className="mt-3 text-center text-sm text-danger-600">{error}</p>}

        <Button
          fullWidth
          className="mt-4"
          onClick={handleSubmit}
          disabled={loading || !utilisateurId || pin.length !== PIN_LENGTH}
        >
          {loading ? 'Connexion...' : 'Connexion'}
        </Button>
      </div>
    </div>
  )
}
