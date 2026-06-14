import { AlertTriangle } from 'lucide-react'
import type { StockProduit } from '../../types'

interface AlertStripProps {
  alertes: StockProduit[]
}

export function AlertStrip({ alertes }: AlertStripProps) {
  if (alertes.length === 0) return null

  const grave = alertes.some((a) => a.statut_stock === 'rupture' || a.statut_stock === 'critique')

  return (
    <div
      className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${
        grave ? 'bg-danger-50 text-danger-600' : 'bg-amber-50 text-amber-600'
      }`}
    >
      <AlertTriangle size={18} />
      <span>
        {alertes.length} produit{alertes.length > 1 ? 's' : ''} sous le seuil d'alerte
      </span>
    </div>
  )
}
