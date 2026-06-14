import type { ReactNode } from 'react'

type BadgeColor = 'brand' | 'blue' | 'amber' | 'danger' | 'gray'

interface BadgeProps {
  color?: BadgeColor
  children: ReactNode
}

const COLOR_CLASSES: Record<BadgeColor, string> = {
  brand: 'bg-brand-50 text-brand-800',
  blue: 'bg-blue-50 text-blue-800',
  amber: 'bg-amber-50 text-amber-600',
  danger: 'bg-danger-50 text-danger-600',
  gray: 'bg-gray-100 text-gray-600',
}

export function Badge({ color = 'gray', children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${COLOR_CLASSES[color]}`}
    >
      {children}
    </span>
  )
}

/**
 * Mappe un statut de bon (sortie ou réception) vers une couleur de badge.
 */
export function statutToColor(statut: string): BadgeColor {
  switch (statut) {
    case 'approuve':
    case 'valide':
      return 'brand'
    case 'en_attente':
      return 'amber'
    case 'rejete':
      return 'danger'
    case 'expire':
      return 'gray'
    default:
      return 'gray'
  }
}
