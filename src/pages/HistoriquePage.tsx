import { useState } from 'react'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { useBons } from '../hooks/useBons'
import { useReceptions } from '../hooks/useReceptions'
import { useStock } from '../hooks/useStock'
import { Badge, statutToColor } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { genererPDFBonSortie, genererPDFBonReception } from '../lib/pdf'
import type { BonReception, BonSortie, StatutBon } from '../types'

type Tab = 'sortie' | 'reception'

const STATUTS_SORTIE: StatutBon[] = ['en_attente', 'approuve', 'rejete', 'expire']
const STATUTS_RECEPTION: BonReception['statut'][] = ['en_attente', 'valide', 'rejete']

export function HistoriquePage() {
  const { bons } = useBons()
  const { receptions } = useReceptions()
  const { stock } = useStock()

  const [tab, setTab] = useState<Tab>('sortie')
  const [dateFiltre, setDateFiltre] = useState('')
  const [statutFiltre, setStatutFiltre] = useState('')
  const [produitFiltre, setProduitFiltre] = useState('')
  const [selection, setSelection] = useState<{ type: Tab; bon: BonSortie | BonReception } | null>(null)

  const changeTab = (next: Tab) => {
    setTab(next)
    setStatutFiltre('')
    setProduitFiltre('')
  }

  const bonsFiltres = bons.filter((bon) => {
    if (dateFiltre && bon.created_at.slice(0, 10) !== dateFiltre) return false
    if (statutFiltre && bon.statut !== statutFiltre) return false
    if (produitFiltre && !bon.lignes.some((l) => l.produit_id === produitFiltre)) return false
    return true
  })

  const receptionsFiltrees = receptions.filter((reception) => {
    if (dateFiltre && reception.created_at.slice(0, 10) !== dateFiltre) return false
    if (statutFiltre && reception.statut !== statutFiltre) return false
    if (produitFiltre && !reception.lignes.some((l) => l.produit_id === produitFiltre)) return false
    return true
  })

  if (selection) {
    const { type, bon } = selection

    return (
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => setSelection(null)}
          className="flex items-center gap-1 text-sm font-medium text-brand-800"
        >
          <ChevronLeft size={18} /> Retour
        </button>

        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-gray-900">{bon.numero}</h1>
            <Badge color={statutToColor(bon.statut)}>{bon.statut}</Badge>
          </div>
          <div className="mt-2 flex flex-col gap-1 text-sm text-gray-600">
            <div>
              Dépôt : <span className="font-medium text-gray-900">{bon.depot?.nom}</span>
            </div>
            {type === 'sortie' ? (
              <>
                <div>
                  Motif : <span className="font-medium text-gray-900">{(bon as BonSortie).motif}</span>
                </div>
                <div>
                  Gestionnaire :{' '}
                  <span className="font-medium text-gray-900">{(bon as BonSortie).gestionnaire?.nom}</span>
                </div>
              </>
            ) : (
              <>
                <div>
                  Fournisseur :{' '}
                  <span className="font-medium text-gray-900">{(bon as BonReception).fournisseur}</span>
                </div>
                <div>
                  Canal : <span className="font-medium text-gray-900">{(bon as BonReception).canal}</span>
                </div>
              </>
            )}
            <div>
              Créé le : <span className="font-medium text-gray-900">{new Date(bon.created_at).toLocaleString('fr-FR')}</span>
            </div>
            {bon.valide_le && (
              <div>
                Validé le : <span className="font-medium text-gray-900">{new Date(bon.valide_le).toLocaleString('fr-FR')}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm">
          {type === 'sortie'
            ? (bon as BonSortie).lignes.map((ligne) => (
                <div key={ligne.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{ligne.produit?.nom}</span>
                  <span className="font-medium text-gray-900">
                    {ligne.qte_accordee ?? '-'} / {ligne.qte_demandee} {ligne.produit?.unite}
                  </span>
                </div>
              ))
            : (bon as BonReception).lignes.map((ligne) => (
                <div key={ligne.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">
                    {ligne.produit?.nom} ({ligne.qte_recue} {ligne.produit?.unite})
                  </span>
                  <span className="font-medium text-gray-900">
                    {ligne.prix_achat_unitaire != null ? `${ligne.prix_achat_unitaire} GNF` : '-'}
                  </span>
                </div>
              ))}

          {type === 'reception' && (bon as BonReception).valeur_totale != null && (
            <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2 text-sm font-semibold text-gray-900">
              <span>Valeur totale</span>
              <span>{(bon as BonReception).valeur_totale} GNF</span>
            </div>
          )}
        </div>

        <Button
          fullWidth
          variant="secondary"
          icon={<Download size={18} />}
          onClick={() => (type === 'sortie' ? genererPDFBonSortie(bon as BonSortie) : genererPDFBonReception(bon as BonReception))}
        >
          Télécharger le PDF
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold text-gray-900">Historique</h1>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => changeTab('sortie')}
          className={`flex-1 rounded-xl py-2 text-sm font-medium ${
            tab === 'sortie' ? 'bg-brand-800 text-white' : 'bg-white text-gray-600'
          }`}
        >
          Sorties
        </button>
        <button
          type="button"
          onClick={() => changeTab('reception')}
          className={`flex-1 rounded-xl py-2 text-sm font-medium ${
            tab === 'reception' ? 'bg-brand-800 text-white' : 'bg-white text-gray-600'
          }`}
        >
          Réceptions
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <input
          type="date"
          aria-label="Filtrer par date"
          value={dateFiltre}
          onChange={(e) => setDateFiltre(e.target.value)}
          className="rounded-xl border border-gray-200 px-2 py-2 text-xs focus:border-brand-400 focus:outline-none"
        />
        <select
          aria-label="Filtrer par statut"
          value={statutFiltre}
          onChange={(e) => setStatutFiltre(e.target.value)}
          className="rounded-xl border border-gray-200 px-2 py-2 text-xs focus:border-brand-400 focus:outline-none"
        >
          <option value="">Statut</option>
          {(tab === 'sortie' ? STATUTS_SORTIE : STATUTS_RECEPTION).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrer par produit"
          value={produitFiltre}
          onChange={(e) => setProduitFiltre(e.target.value)}
          className="rounded-xl border border-gray-200 px-2 py-2 text-xs focus:border-brand-400 focus:outline-none"
        >
          <option value="">Produit</option>
          {stock.map((s) => (
            <option key={s.produit_id} value={s.produit_id}>
              {s.produit?.nom}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        {tab === 'sortie' &&
          bonsFiltres.map((bon) => (
            <button
              key={bon.id}
              type="button"
              onClick={() => setSelection({ type: 'sortie', bon })}
              className="flex items-center justify-between rounded-2xl bg-white p-4 text-left shadow-sm"
            >
              <div>
                <div className="font-medium text-gray-900">{bon.numero}</div>
                <div className="text-xs text-gray-500">
                  {bon.motif} · {new Date(bon.created_at).toLocaleDateString('fr-FR')}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge color={statutToColor(bon.statut)}>{bon.statut}</Badge>
                <ChevronRight size={18} className="text-gray-400" />
              </div>
            </button>
          ))}

        {tab === 'reception' &&
          receptionsFiltrees.map((reception) => (
            <button
              key={reception.id}
              type="button"
              onClick={() => setSelection({ type: 'reception', bon: reception })}
              className="flex items-center justify-between rounded-2xl bg-white p-4 text-left shadow-sm"
            >
              <div>
                <div className="font-medium text-gray-900">{reception.numero}</div>
                <div className="text-xs text-gray-500">
                  {reception.fournisseur} · {new Date(reception.created_at).toLocaleDateString('fr-FR')}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge color={statutToColor(reception.statut)}>{reception.statut}</Badge>
                <ChevronRight size={18} className="text-gray-400" />
              </div>
            </button>
          ))}

        {tab === 'sortie' && bonsFiltres.length === 0 && (
          <p className="text-center text-sm text-gray-400">Aucun bon de sortie</p>
        )}
        {tab === 'reception' && receptionsFiltrees.length === 0 && (
          <p className="text-center text-sm text-gray-400">Aucun bon de réception</p>
        )}
      </div>
    </div>
  )
}
