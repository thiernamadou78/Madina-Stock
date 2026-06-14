import { useState } from 'react'
import { Check, ChevronDown, Loader2, Warehouse } from 'lucide-react'
import { useAppStore } from '../../stores/appStore'

export function StockSwitcher() {
  const depots = useAppStore((s) => s.depots)
  const depotActifId = useAppStore((s) => s.depotActifId)
  const setDepotActif = useAppStore((s) => s.setDepotActif)
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState(false)

  const depotActif = depots.find((d) => d.id === depotActifId)

  const handleSelect = (depotId: string) => {
    setOpen(false)
    if (depotId === depotActifId) return

    setDepotActif(depotId)
    setSwitching(true)
    setTimeout(() => setSwitching(false), 800)
  }

  if (depots.length <= 1) {
    return (
      <div className="flex items-center gap-2 text-sm font-medium text-white">
        <Warehouse size={16} />
        {depotActif?.nom ?? 'Aucun dépôt'}
      </div>
    )
  }

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white"
        >
          <Warehouse size={16} />
          {depotActif?.nom ?? 'Sélectionner un dépôt'}
          <ChevronDown size={16} />
        </button>

        {open && (
          <div className="absolute left-0 top-full z-30 mt-1 w-48 rounded-xl border border-gray-100 bg-white py-1 shadow-lg">
            {depots.map((depot) => (
              <button
                key={depot.id}
                type="button"
                onClick={() => handleSelect(depot.id)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-gray-700 hover:bg-brand-50"
              >
                {depot.nom}
                {depot.id === depotActifId && <Check size={16} className="text-brand-800" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {switching && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-white/80">
          <Loader2 size={32} className="animate-spin text-brand-800" />
          <p className="text-sm font-medium text-gray-600">Changement de dépôt...</p>
        </div>
      )}
    </>
  )
}
