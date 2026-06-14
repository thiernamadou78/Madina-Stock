import { useState } from 'react'
import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react'
import { useBons } from '../hooks/useBons'
import { useReceptions } from '../hooks/useReceptions'
import { useStock, computeStatutStock } from '../hooks/useStock'
import { useExpiration } from '../hooks/useExpiration'
import { useAppStore } from '../stores/appStore'
import { approuverBon, rejeterBon } from '../lib/bons'
import { Badge, statutToColor } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { ConfirmModal } from '../components/modals/ConfirmModal'
import type { BonReception, BonSortie, CanalAppro, StockProduit } from '../types'

type Selection = { type: 'sortie'; bon: BonSortie } | { type: 'reception'; bon: BonReception }
type Action = 'approuve' | 'rejete' | 'valide'

const NIVEAU_COLORS: Record<StockProduit['statut_stock'], string> = {
  ok: 'bg-brand-400',
  alerte: 'bg-amber-400',
  critique: 'bg-danger-400',
  rupture: 'bg-danger-600',
}

const CANAL_ICONS: Record<CanalAppro, string> = {
  presentiel: '🤝',
  appel: '📞',
  app_mobile: '📱',
  conteneur: '🚢',
}

const CANAL_LABELS: Record<CanalAppro, string> = {
  presentiel: 'Présentiel',
  appel: 'Appel',
  app_mobile: 'App mobile',
  conteneur: 'Conteneur',
}

function formatDateHeure(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function StockComparisonBar({ stock, apres }: { stock: StockProduit; apres: number }) {
  const apresClamped = Math.max(apres, 0)
  const reference = Math.max(stock.seuil_alerte * 2, stock.qte_disponible, apresClamped, 1)
  const avantPct = Math.min(100, (stock.qte_disponible / reference) * 100)
  const apresPct = Math.min(100, (apresClamped / reference) * 100)
  const statutApres = computeStatutStock({
    qte_disponible: apresClamped,
    seuil_alerte: stock.seuil_alerte,
    seuil_critique: stock.seuil_critique,
  })

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          Avant : {stock.qte_disponible} {stock.produit?.unite}
        </span>
        <span>
          Après : {apresClamped} {stock.produit?.unite}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-100">
        <div className={`h-2 rounded-full ${NIVEAU_COLORS[stock.statut_stock]}`} style={{ width: `${avantPct}%` }} />
      </div>
      <div className="h-2 w-full rounded-full bg-gray-100">
        <div
          className={`h-2 rounded-full transition-all ${NIVEAU_COLORS[statutApres]}`}
          style={{ width: `${apresPct}%` }}
        />
      </div>
    </div>
  )
}

export function ValidationsPage() {
  const user = useAppStore((s) => s.user)
  const { bons, refresh: refreshBons } = useBons()
  const { receptions, statuerReception, refresh: refreshReceptions } = useReceptions()
  const { stock } = useStock()

  useExpiration(() => {
    refreshBons()
    refreshReceptions()
  })

  const [selection, setSelection] = useState<Selection | null>(null)
  const [qtes, setQtes] = useState<Record<string, number>>({})
  const [ligneEdits, setLigneEdits] = useState<Record<string, { valide: boolean; prix: number }>>({})
  const [confirmAction, setConfirmAction] = useState<Action | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const bonsEnAttente = bons.filter((b) => b.statut === 'en_attente')
  const receptionsEnAttente = receptions.filter((r) => r.statut === 'en_attente')
  const totalEnAttente = bonsEnAttente.length + receptionsEnAttente.length

  const openSortie = (bon: BonSortie) => {
    setSelection({ type: 'sortie', bon })
    setQtes(Object.fromEntries(bon.lignes.map((l) => [l.id, l.qte_accordee ?? l.qte_demandee])))
    setError(null)
  }

  const openReception = (bon: BonReception) => {
    setSelection({ type: 'reception', bon })
    setLigneEdits(
      Object.fromEntries(bon.lignes.map((l) => [l.id, { valide: true, prix: l.prix_achat_unitaire ?? 0 }]))
    )
    setError(null)
  }

  const close = () => {
    setSelection(null)
    setConfirmAction(null)
    setError(null)
  }

  const handleApprouver = async () => {
    if (selection?.type !== 'sortie' || !user) return

    setLoading(true)
    setError(null)

    const modifications = selection.bon.lignes
      .filter((l) => (qtes[l.id] ?? l.qte_demandee) !== l.qte_demandee)
      .map((l) => ({ ligneId: l.id, qteAccordee: qtes[l.id] ?? l.qte_demandee }))

    const result = await approuverBon(selection.bon.id, user.id, modifications.length > 0 ? modifications : undefined)

    setLoading(false)

    if (!result.success) {
      setError(result.error ?? 'Erreur lors de la validation')
      return
    }

    await refreshBons()
    close()
  }

  const handleRejeter = async () => {
    if (!selection || !user) return

    setLoading(true)
    setError(null)

    if (selection.type === 'sortie') {
      const result = await rejeterBon(selection.bon.id, user.id)
      if (!result.success) {
        setError(result.error ?? 'Erreur lors du rejet')
        setLoading(false)
        return
      }
      await refreshBons()
    } else {
      const { error: err } = await statuerReception(selection.bon.id, 'rejete')
      if (err) {
        setError(err)
        setLoading(false)
        return
      }
      await refreshReceptions()
    }

    setLoading(false)
    close()
  }

  const handleValiderReception = async () => {
    if (selection?.type !== 'reception') return

    setLoading(true)
    setError(null)

    const lignesOverride = selection.bon.lignes.map((l) => {
      const edit = ligneEdits[l.id] ?? { valide: true, prix: l.prix_achat_unitaire ?? 0 }
      return { ligneId: l.id, valide: edit.valide, prixAchat: edit.prix }
    })

    const { error: err } = await statuerReception(selection.bon.id, 'valide', lignesOverride)

    setLoading(false)

    if (err) {
      setError(err)
      return
    }

    await refreshReceptions()
    close()
  }

  const handleConfirm = () => {
    if (confirmAction === 'approuve') return handleApprouver()
    if (confirmAction === 'rejete') return handleRejeter()
    if (confirmAction === 'valide') return handleValiderReception()
  }

  if (selection?.type === 'sortie') {
    const bon = selection.bon
    const hasModifications = bon.lignes.some((l) => (qtes[l.id] ?? l.qte_demandee) !== l.qte_demandee)

    return (
      <div className="flex flex-col gap-4">
        <button type="button" onClick={close} className="flex items-center gap-1 text-sm font-medium text-brand-800">
          <ChevronLeft size={18} /> Retour
        </button>

        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-gray-900">{bon.numero}</h1>
            <Badge color={statutToColor(bon.statut)}>{bon.statut}</Badge>
          </div>
          <div className="mt-2 flex flex-col gap-1 text-sm text-gray-600">
            <div>
              Motif : <span className="font-medium text-gray-900">{bon.motif}</span>
            </div>
            <div>
              Dépôt : <span className="font-medium text-gray-900">{bon.depot?.nom}</span>
            </div>
            {bon.motif === 'transfert' && (
              <div>
                Destination : <span className="font-medium text-gray-900">{bon.depot_destination?.nom}</span>
              </div>
            )}
            <div>
              Gestionnaire : <span className="font-medium text-gray-900">{bon.gestionnaire?.nom}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {bon.lignes.map((ligne) => {
            const stockLigne = stock.find((s) => s.produit_id === ligne.produit_id)
            const qte = qtes[ligne.id] ?? ligne.qte_demandee

            return (
              <div key={ligne.id} className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{ligne.produit?.nom}</span>
                  <span className="text-sm text-gray-500">
                    Demandé : {ligne.qte_demandee} {ligne.produit?.unite}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-label="Diminuer la quantité accordée"
                    onClick={() => setQtes((prev) => ({ ...prev, [ligne.id]: Math.max(0, qte - 1) }))}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-700"
                  >
                    <Minus size={16} />
                  </button>
                  <input
                    type="number"
                    min="0"
                    max={ligne.qte_demandee}
                    aria-label="Quantité accordée"
                    value={qte}
                    onChange={(e) =>
                      setQtes((prev) => ({
                        ...prev,
                        [ligne.id]: Math.min(ligne.qte_demandee, Math.max(0, Number(e.target.value) || 0)),
                      }))
                    }
                    className="w-20 rounded-xl border border-gray-200 px-3 py-2 text-center text-sm focus:border-brand-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    aria-label="Augmenter la quantité accordée"
                    onClick={() =>
                      setQtes((prev) => ({ ...prev, [ligne.id]: Math.min(ligne.qte_demandee, qte + 1) }))
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-700"
                  >
                    <Plus size={16} />
                  </button>
                  <span className="text-sm text-gray-500">accordé{ligne.produit?.unite ? ` (${ligne.produit.unite})` : ''}</span>
                </div>

                {stockLigne && <StockComparisonBar stock={stockLigne} apres={stockLigne.qte_disponible - qte} />}
              </div>
            )
          })}
        </div>

        {error && <p className="text-sm text-danger-600">{error}</p>}

        <div className="flex gap-3">
          <Button fullWidth variant="danger" onClick={() => setConfirmAction('rejete')} disabled={loading}>
            Rejeter
          </Button>
          <Button fullWidth onClick={() => setConfirmAction('approuve')} disabled={loading}>
            {hasModifications ? 'Approuver avec modification' : 'Approuver'}
          </Button>
        </div>

        <ConfirmModal
          open={confirmAction !== null}
          title={confirmAction === 'rejete' ? 'Rejeter le bon ?' : 'Approuver le bon ?'}
          message={`${bon.numero} sera ${confirmAction === 'rejete' ? 'rejeté' : hasModifications ? 'approuvé avec les quantités modifiées' : 'approuvé'}.`}
          confirmLabel={confirmAction === 'rejete' ? 'Rejeter' : 'Approuver'}
          danger={confirmAction === 'rejete'}
          loading={loading}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      </div>
    )
  }

  if (selection?.type === 'reception') {
    const reception = selection.bon

    return (
      <div className="flex flex-col gap-4">
        <button type="button" onClick={close} className="flex items-center gap-1 text-sm font-medium text-brand-800">
          <ChevronLeft size={18} /> Retour
        </button>

        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-gray-900">{reception.numero}</h1>
            <Badge color={statutToColor(reception.statut)}>{reception.statut}</Badge>
          </div>
          <div className="mt-2 flex flex-col gap-1 text-sm text-gray-600">
            <div>
              Fournisseur : <span className="font-medium text-gray-900">{reception.fournisseur}</span>
            </div>
            <div>
              Dépôt : <span className="font-medium text-gray-900">{reception.depot?.nom}</span>
            </div>
            <div>
              Canal :{' '}
              <span className="font-medium text-gray-900">
                {CANAL_ICONS[reception.canal]} {CANAL_LABELS[reception.canal]}
              </span>
            </div>
            {reception.reference_doc && (
              <div>
                Référence : <span className="font-medium text-gray-900">{reception.reference_doc}</span>
              </div>
            )}
            <div>
              Soumis le : <span className="font-medium text-gray-900">{formatDateHeure(reception.created_at)}</span>
            </div>
            <div>
              Articles : <span className="font-medium text-gray-900">{reception.lignes.length}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm">
          {reception.lignes.map((ligne) => {
            const edit = ligneEdits[ligne.id] ?? { valide: true, prix: ligne.prix_achat_unitaire ?? 0 }
            const sousTotal = ligne.qte_recue * edit.prix

            return (
              <div key={ligne.id} className="flex items-center gap-3 border-b border-gray-50 py-2 last:border-0">
                <input
                  type="checkbox"
                  aria-label={`Valider la ligne ${ligne.produit?.nom}`}
                  checked={edit.valide}
                  onChange={(e) =>
                    setLigneEdits((prev) => ({
                      ...prev,
                      [ligne.id]: { ...edit, valide: e.target.checked },
                    }))
                  }
                  className="h-4 w-4 rounded border-gray-300 text-brand-800 focus:ring-brand-400"
                />

                <div className="flex-1">
                  <div className="text-sm text-gray-700">
                    {ligne.produit?.nom} ({ligne.qte_recue} {ligne.produit?.unite})
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                    <input
                      type="number"
                      min="0"
                      aria-label={`Prix d'achat unitaire de ${ligne.produit?.nom}`}
                      value={edit.prix}
                      onChange={(e) =>
                        setLigneEdits((prev) => ({
                          ...prev,
                          [ligne.id]: { ...edit, prix: Number(e.target.value) || 0 },
                        }))
                      }
                      className="w-24 rounded-lg border border-gray-200 px-2 py-1 text-right text-xs focus:border-brand-400 focus:outline-none"
                    />
                    <span>GNF / unité</span>
                  </div>
                </div>

                <span className="text-sm font-medium text-gray-900">{sousTotal.toLocaleString()} GNF</span>
              </div>
            )
          })}
          {reception.valeur_totale != null && (
            <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2 text-sm font-semibold text-gray-900">
              <span>Valeur totale</span>
              <span>{reception.valeur_totale.toLocaleString()} GNF</span>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-danger-600">{error}</p>}

        <div className="flex gap-3">
          <Button fullWidth variant="danger" onClick={() => setConfirmAction('rejete')} disabled={loading}>
            Rejeter
          </Button>
          <Button fullWidth onClick={() => setConfirmAction('valide')} disabled={loading}>
            Valider
          </Button>
        </div>

        <ConfirmModal
          open={confirmAction !== null}
          title={confirmAction === 'rejete' ? 'Rejeter la réception ?' : 'Valider la réception ?'}
          message={`${reception.numero} sera ${confirmAction === 'rejete' ? 'rejetée' : 'validée et le stock sera mis à jour'}.`}
          confirmLabel={confirmAction === 'rejete' ? 'Rejeter' : 'Valider'}
          danger={confirmAction === 'rejete'}
          loading={loading}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-bold text-gray-900">Validations</h1>
        {totalEnAttente > 0 && (
          <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-600">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
            </span>
            {totalEnAttente} en attente
          </span>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Bons de sortie</h2>
        <div className="flex flex-col gap-2">
          {bonsEnAttente.map((bon) => (
            <button
              key={bon.id}
              type="button"
              onClick={() => openSortie(bon)}
              className="flex items-center justify-between rounded-2xl bg-white p-4 text-left shadow-sm"
            >
              <div>
                <div className="font-medium text-gray-900">{bon.numero}</div>
                <div className="text-xs text-gray-500">
                  {bon.motif} · {bon.depot?.nom}
                </div>
              </div>
              <ChevronRight size={18} className="text-gray-400" />
            </button>
          ))}
          {bonsEnAttente.length === 0 && <p className="text-sm text-gray-400">Aucun bon en attente</p>}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Bons de réception</h2>
        <div className="flex flex-col gap-2">
          {receptionsEnAttente.map((reception) => (
            <button
              key={reception.id}
              type="button"
              onClick={() => openReception(reception)}
              className="flex items-center justify-between rounded-2xl bg-white p-4 text-left shadow-sm"
            >
              <div>
                <div className="font-medium text-gray-900">
                  {CANAL_ICONS[reception.canal]} {reception.numero} — {reception.fournisseur}
                </div>
                <div className="text-xs text-gray-500">
                  {reception.depot?.nom} · {formatDateHeure(reception.created_at)}
                </div>
                <div className="text-xs text-gray-500">
                  {reception.lignes.length} article{reception.lignes.length > 1 ? 's' : ''}
                  {reception.valeur_totale != null && ` · ${reception.valeur_totale.toLocaleString()} GNF`}
                </div>
              </div>
              <ChevronRight size={18} className="text-gray-400" />
            </button>
          ))}
          {receptionsEnAttente.length === 0 && (
            <p className="text-sm text-gray-400">Aucune réception en attente</p>
          )}
        </div>
      </div>
    </div>
  )
}
