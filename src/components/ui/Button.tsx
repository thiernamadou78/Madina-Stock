import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  fullWidth?: boolean
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-brand-800 text-white hover:bg-brand-900 active:bg-brand-900',
  secondary: 'bg-brand-50 text-brand-800 hover:bg-brand-100 active:bg-brand-100',
  danger: 'bg-danger-600 text-white hover:bg-danger-400 active:bg-danger-600',
  ghost: 'bg-transparent text-brand-800 hover:bg-brand-50 active:bg-brand-100',
}

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2.5 text-base gap-2',
  lg: 'px-5 py-3 text-lg gap-2.5',
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  fullWidth,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {icon}
      {children}
    </button>
  )
}
