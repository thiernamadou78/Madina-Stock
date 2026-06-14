import { useState } from 'react'
import { CheckCircle2, Delete } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/Button'
import type { Depot } from '../types'

const PIN_LENGTH = 4
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
const WHATSAPP_REGEX = /^\+224\d{9}$/

type Etape = 'compte' | 'depot' | 'succes'
type ChampPin = 'pin' | 'confirmation'

interface OnboardingPageProps {
  onComplete: () => void
}

export function OnboardingPage({ onComplete }: OnboardingPageProps) {
  const [etape, setEtape] = useState<Etape>('compte')

  // Étape 1 — compte propriétaire
  const [nom, setNom] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [pin, setPin] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [champActif, setChampActif] = useState<ChampPin>('pin')
  const [erreurCompte, setErreurCompte] = useState<string | null>(null)
  const [chargementCompte, setChargementCompte] = useState(false)

  // Étape 2 — premier dépôt
  const [proprietaireId, setProprietaireId] = useState('')
  const [proprietaireNom, setProprietaireNom] = useState('')
  const [depotNom, setDepotNom] = useState('Magasin principal')
  const [depotType, setDepotType] = useState<Depot['type']>('principal')
  const [depotLocalisation, setDepotLocalisation] = useState('')
  const [erreurDepot, setErreurDepot] = useState<string | null>(null)
  const [chargementDepot, setChargementDepot] = useState(false)

  const handleDigit = (digit: string) => {
    setErreurCompte(null)
    if (champActif === 'pin') {
      if (pin.length >= PIN_LENGTH) return
      const next = pin + digit
      setPin(next)
      if (next.length === PIN_LENGTH) setChampActif('confirmation')
    } else {
      if (confirmation.length >= PIN_LENGTH) return
      setConfirmation((c) => c + digit)
    }
  }

  const handleBackspace = () => {
    setErreurCompte(null)
    if (champActif === 'pin') {
      setPin((p) => p.slice(0, -1))
    } else {
      setConfirmation((c) => c.slice(0, -1))
    }
  }

  const handleCreerCompte = async () => {
    if (nom.trim().length < 2) {
      setErreurCompte('Le nom doit contenir au moins 2 caractères')
      return
    }
    if (whatsapp.trim() && !WHATSAPP_REGEX.test(whatsapp.trim())) {
      setErreurCompte('Format attendu : +224XXXXXXXXX')
      return
    }
    if (pin.length !== PIN_LENGTH || confirmation.length !== PIN_LENGTH) {
      setErreurCompte('Le code PIN doit contenir 4 chiffres')
      return
    }
    if (pin !== confirmation) {
      setErreurCompte('Les codes PIN ne correspondent pas')
      return
    }

    setChargementCompte(true)
    setErreurCompte(null)

    const { data, error } = await supabase.rpc('creer_proprietaire', {
      p_nom: nom.trim(),
      p_contact_wa: whatsapp.trim() || null,
      p_pin: pin,
    })

    setChargementCompte(false)

    if (error || !data) {
      setErreurCompte(error?.message ?? 'Erreur lors de la création du compte')
      return
    }

    setProprietaireId(data as string)
    setProprietaireNom(nom.trim())
    setEtape('depot')
  }

  const handleCreerDepot = async () => {
    if (depotNom.trim().length < 2) {
      setErreurDepot('Le nom du dépôt doit contenir au moins 2 caractères')
      return
    }

    setChargementDepot(true)
    setErreurDepot(null)

    const { error } = await supabase.rpc('creer_premier_depot', {
      p_proprietaire_id: proprietaireId,
      p_nom: depotNom.trim(),
      p_type: depotType,
      p_localisation: depotLocalisation.trim() || null,
    })

    setChargementDepot(false)

    if (error) {
      setErreurDepot(error.message)
      return
    }

    setEtape('succes')
    setTimeout(() => {
      onComplete()
    }, 2000)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-800 px-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-800 text-xl font-bold text-white">
            MS
          </div>
          <h1 className="mt-3 text-2xl font-bold text-brand-800">MadinaStock</h1>

          {etape === 'compte' && (
            <p className="mt-1 text-sm text-gray-500">
              Bienvenue ! Créons votre compte propriétaire pour démarrer.
            </p>
          )}
          {etape === 'depot' && (
            <p className="mt-1 text-sm text-gray-500">
              Compte créé avec succès ! Bienvenue {proprietaireNom} — créez votre premier dépôt.
            </p>
          )}
        </div>

        {etape === 'compte' && (
          <>
            <label className="mt-6 block text-sm font-medium text-gray-700">
              Nom complet
              <input
                type="text"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Ibrahima Diallo"
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
              />
            </label>

            <label className="mt-3 block text-sm font-medium text-gray-700">
              Numéro WhatsApp (optionnel)
              <input
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="+224620000001"
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
              />
            </label>

            <div className="mt-4">
              <button
                type="button"
                onClick={() => setChampActif('pin')}
                className="block text-sm font-medium text-gray-700"
              >
                Code PIN
              </button>
              <div className="mt-2 flex justify-center gap-3">
                {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-3 w-3 rounded-full ${
                      i < pin.length
                        ? 'bg-brand-800'
                        : champActif === 'pin'
                          ? 'bg-brand-100'
                          : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="mt-3">
              <button
                type="button"
                onClick={() => setChampActif('confirmation')}
                className="block text-sm font-medium text-gray-700"
              >
                Confirmer le code PIN
              </button>
              <div className="mt-2 flex justify-center gap-3">
                {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-3 w-3 rounded-full ${
                      i < confirmation.length
                        ? 'bg-brand-800'
                        : champActif === 'confirmation'
                          ? 'bg-brand-100'
                          : 'bg-gray-200'
                    }`}
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

            {erreurCompte && (
              <p className="mt-3 text-center text-sm text-danger-600">{erreurCompte}</p>
            )}

            <Button
              fullWidth
              className="mt-4"
              onClick={handleCreerCompte}
              disabled={chargementCompte}
            >
              {chargementCompte ? 'Création...' : 'Créer mon compte'}
            </Button>
          </>
        )}

        {etape === 'depot' && (
          <>
            <label className="mt-6 block text-sm font-medium text-gray-700">
              Nom du dépôt
              <input
                type="text"
                value={depotNom}
                onChange={(e) => setDepotNom(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
              />
            </label>

            <label className="mt-3 block text-sm font-medium text-gray-700">
              Type de dépôt
              <select
                value={depotType}
                onChange={(e) => setDepotType(e.target.value as Depot['type'])}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
              >
                <option value="principal">Principal</option>
                <option value="secondaire">Secondaire</option>
              </select>
            </label>

            <label className="mt-3 block text-sm font-medium text-gray-700">
              Localisation (optionnel)
              <input
                type="text"
                value={depotLocalisation}
                onChange={(e) => setDepotLocalisation(e.target.value)}
                placeholder="Conakry centre"
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
              />
            </label>

            {erreurDepot && (
              <p className="mt-3 text-center text-sm text-danger-600">{erreurDepot}</p>
            )}

            <Button
              fullWidth
              className="mt-4"
              onClick={handleCreerDepot}
              disabled={chargementDepot}
            >
              {chargementDepot ? 'Création...' : 'Créer le dépôt'}
            </Button>
          </>
        )}

        {etape === 'succes' && (
          <div className="mt-6 flex flex-col items-center gap-3 text-center">
            <CheckCircle2 size={48} className="text-brand-400" />
            <p className="text-sm font-medium text-gray-700">
              Configuration terminée — vous pouvez vous connecter
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
