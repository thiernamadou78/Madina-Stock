import type { ReactNode } from 'react'
import { Delete } from 'lucide-react'

const PIN_LENGTH = 4
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

export function PinDots({ value, length = PIN_LENGTH }: { value: string; length?: number }) {
  return (
    <div className="mt-2 flex justify-center gap-3">
      {Array.from({ length }).map((_, i) => (
        <div
          key={i}
          className={`h-3 w-3 rounded-full ${i < value.length ? 'bg-brand-800' : 'bg-gray-200'}`}
        />
      ))}
    </div>
  )
}

export function PinKeypad({
  onDigit,
  onBackspace,
  disabled,
  actionIcon,
  onAction,
  actionDisabled,
}: {
  onDigit: (digit: string) => void
  onBackspace: () => void
  disabled?: boolean
  actionIcon?: ReactNode
  onAction?: () => void
  actionDisabled?: boolean
}) {
  return (
    <div className="mt-4 grid grid-cols-3 gap-3">
      {DIGITS.map((digit) => (
        <button
          key={digit}
          type="button"
          disabled={disabled}
          onClick={() => onDigit(digit)}
          className="rounded-2xl bg-gray-50 py-4 text-2xl font-semibold text-gray-700 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-50"
        >
          {digit}
        </button>
      ))}
      <button
        type="button"
        disabled={disabled}
        onClick={onBackspace}
        aria-label="Effacer"
        className="flex items-center justify-center rounded-2xl bg-gray-50 py-4 text-gray-500 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-50"
      >
        <Delete size={22} />
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onDigit('0')}
        className="rounded-2xl bg-gray-50 py-4 text-2xl font-semibold text-gray-700 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-50"
      >
        0
      </button>
      {onAction ? (
        <button
          type="button"
          aria-label="Se connecter"
          disabled={disabled || actionDisabled}
          onClick={onAction}
          className="flex items-center justify-center rounded-2xl bg-brand-800 py-4 text-white hover:bg-brand-900 active:bg-brand-950 disabled:opacity-40"
        >
          {actionIcon}
        </button>
      ) : (
        <div />
      )}
    </div>
  )
}
