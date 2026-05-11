'use client'

// A free-text city field with a suggestion dropdown seeded from AZ_CITIES.
// Modeled on AddressAutocomplete — the <Input> is the source of truth, so a
// city that isn't in the list (traveling) is typed in with no friction.

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { AZ_CITIES } from '@/lib/az-cities'

export function CityCombobox({
  value,
  onChange,
  id,
  placeholder = 'City',
}: {
  value: string | null
  onChange: (next: string | null) => void
  id?: string
  placeholder?: string
}) {
  const [text, setText] = useState(value ?? '')
  const [open, setOpen] = useState(false)

  // Mirror the prop when the parent resets it externally.
  const [prevValue, setPrevValue] = useState(value)
  if (prevValue !== value) {
    setPrevValue(value)
    setText(value ?? '')
  }

  const q = text.trim().toLowerCase()
  const matches = q.length === 0 ? AZ_CITIES : AZ_CITIES.filter((c) => c.toLowerCase().includes(q))
  const onlyExactMatch = matches.length === 1 && matches[0].toLowerCase() === q

  return (
    <div className="relative">
      <Input
        id={id}
        value={text}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          const v = e.target.value
          setText(v)
          setOpen(true)
          onChange(v.trim().length === 0 ? null : v)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && matches.length > 0 && !onlyExactMatch ? (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md">
          <ul role="listbox" className="max-h-56 overflow-y-auto py-1">
            {matches.map((c) => (
              <li
                key={c}
                role="option"
                aria-selected={c.toLowerCase() === q}
                className="cursor-pointer px-3 py-1.5 text-sm hover:bg-accent"
                onMouseDown={(e) => {
                  e.preventDefault()
                  setText(c)
                  onChange(c)
                  setOpen(false)
                }}
              >
                {c}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
