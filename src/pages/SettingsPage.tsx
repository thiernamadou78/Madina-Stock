import { useState } from 'react'
import { Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useStock } from '../hooks/useStock'
import { useAppStore } from '../stores/appStore'
import { Button } from '../components/ui/Button'
import { CreateProductModal } from '../components/modals/CreateProductModal'

export function SettingsPage() {
  const { stock, refresh } = useStock()
  const depots = useAppStore((s) => s.depots)
  const [modalOpen, setModalOpen] = useState(false)

  const updateSeuil = async (
    stockId: string,
    field: 'seuil_alerte' | 'seuil_critique',
    value: number
  ) => {
    await supabase.from('stock_produits').update({ [field]: value }).eq('id', stockId)
    await refresh()
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold text-gray-900">Paramètres</h1>

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Seuils de stock</h2>
          <Button size="sm" icon={<Plus size={16} />} onClick={() => setModalOpen(true)}>
            Produit
          </Button>
        </div>

        <div className="flex flex-col gap-3">
          {stock.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2">
              <span className="flex-1 text-sm text-gray-700">{s.produit?.nom}</span>
              <label className="flex items-center gap-1 text-xs text-gray-500">
                Alerte
                <input
                  type="number"
                  defaultValue={s.seuil_alerte}
                  onBlur={(e) => updateSeuil(s.id, 'seuil_alerte', Number(e.target.value))}
                  className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-sm focus:border-brand-400 focus:outline-none"
                />
              </label>
              <label className="flex items-center gap-1 text-xs text-gray-500">
                Critique
                <input
                  type="number"
                  defaultValue={s.seuil_critique}
                  onBlur={(e) => updateSeuil(s.id, 'seuil_critique', Number(e.target.value))}
                  className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-sm focus:border-brand-400 focus:outline-none"
                />
              </label>
            </div>
          ))}
          {stock.length === 0 && <p className="text-sm text-gray-400">Aucun produit</p>}
        </div>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Dépôts</h2>
        <div className="flex flex-col gap-2">
          {depots.map((depot) => (
            <div key={depot.id} className="flex items-center justify-between text-sm">
              <span className="text-gray-700">{depot.nom}</span>
              <span className="text-xs text-gray-400">{depot.type}</span>
            </div>
          ))}
          {depots.length === 0 && <p className="text-sm text-gray-400">Aucun dépôt</p>}
        </div>
      </div>

      <CreateProductModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={refresh} />
    </div>
  )
}
