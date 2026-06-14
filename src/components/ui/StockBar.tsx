import type { StockProduit } from '../../types'

interface StockBarProps {
  stock: StockProduit
}

const NIVEAU_COLORS: Record<StockProduit['statut_stock'], string> = {
  ok: 'bg-brand-400',
  alerte: 'bg-amber-400',
  critique: 'bg-danger-400',
  rupture: 'bg-danger-600',
}

export function StockBar({ stock }: StockBarProps) {
  const reference = Math.max(stock.seuil_alerte * 2, stock.qte_disponible, 1)
  const pourcentage = Math.min(100, (stock.qte_disponible / reference) * 100)

  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700">{stock.produit?.nom}</span>
        <span className="text-gray-500">
          {stock.qte_disponible} {stock.produit?.unite}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-100">
        <div
          className={`h-2 rounded-full transition-all ${NIVEAU_COLORS[stock.statut_stock]}`}
          style={{ width: `${pourcentage}%` }}
        />
      </div>
    </div>
  )
}
