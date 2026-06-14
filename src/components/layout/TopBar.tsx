import { useAppStore } from '../../stores/appStore'
import { StockSwitcher } from './StockSwitcher'

export function TopBar() {
  const user = useAppStore((s) => s.user)

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between bg-brand-800 px-4 py-3 text-white">
      <div className="flex items-center gap-3">
        <span className="text-lg font-bold">MadinaStock</span>
        <StockSwitcher />
      </div>
      {user && (
        <div className="text-sm font-medium text-white/90">{user.nom}</div>
      )}
    </header>
  )
}
