'use client'

import { useFieldArray, useFormContext, Controller } from 'react-hook-form'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AddressAutocomplete } from './AddressAutocomplete'
import type { RestaurantInput } from '@/lib/schemas/restaurant'

export function LocationsFieldArray() {
  const { control, register, setValue } = useFormContext<RestaurantInput>()
  const { fields, append, remove } = useFieldArray({ control, name: 'locations' })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm">Locations</Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            append({
              city: null,
              locality: null,
              address: null,
              latitude: null,
              longitude: null,
            })
          }
        >
          <Plus className="mr-1 size-4" />
          Add location
        </Button>
      </div>

      {fields.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          No locations yet.
        </p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {fields.map((field, i) => (
          <li key={field.id} className="rounded-xl border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Location {i + 1}
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Remove location"
                onClick={() => remove(i)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor={`loc-city-${i}`} className="text-xs">
                  City
                </Label>
                <Input
                  id={`loc-city-${i}`}
                  {...register(`locations.${i}.city`)}
                  placeholder="Tempe"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor={`loc-locality-${i}`} className="text-xs">
                  Locality / Note
                </Label>
                <Input
                  id={`loc-locality-${i}`}
                  {...register(`locations.${i}.locality`)}
                  placeholder="Mill Ave, near campus"
                />
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-1">
              <Label className="text-xs">Address (autocomplete)</Label>
              <Controller
                control={control}
                name={`locations.${i}.address`}
                render={({ field: addr }) => (
                  <AddressAutocomplete
                    value={addr.value ?? null}
                    onPick={(pick) => {
                      if (!pick) {
                        setValue(`locations.${i}.address`, null)
                        setValue(`locations.${i}.latitude`, null)
                        setValue(`locations.${i}.longitude`, null)
                        return
                      }
                      setValue(`locations.${i}.address`, pick.display_name, { shouldDirty: true })
                      setValue(`locations.${i}.latitude`, pick.latitude, { shouldDirty: true })
                      setValue(`locations.${i}.longitude`, pick.longitude, { shouldDirty: true })
                    }}
                  />
                )}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
