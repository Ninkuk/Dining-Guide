"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RestaurantInput } from "@/lib/schemas/restaurant";
import { Plus, Trash2 } from "lucide-react";
import { Controller, useFieldArray, useFormContext } from "react-hook-form";
import { AddressAutocomplete } from "./AddressAutocomplete";
import { CityCombobox } from "./CityCombobox";

export function LocationsFieldArray() {
  const { control, register, setValue, watch } =
    useFormContext<RestaurantInput>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "locations",
  });
  // Live values — the address autocomplete biases toward each row's City.
  const watchedLocations = watch("locations") ?? [];

  return (
    <div className="flex flex-col gap-3">
      {fields.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No locations yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {fields.map((field, i) => (
            <li
              key={field.id}
              className="rounded-xl bg-card p-4 ring-1 ring-foreground/10"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground/70">
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
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Find address</Label>
                <Controller
                  control={control}
                  name={`locations.${i}.address`}
                  render={({ field: addr }) => (
                    <AddressAutocomplete
                      value={addr.value ?? null}
                      city={watchedLocations[i]?.city ?? null}
                      onPick={(pick) => {
                        if (!pick) {
                          setValue(`locations.${i}.address`, null);
                          setValue(`locations.${i}.latitude`, null);
                          setValue(`locations.${i}.longitude`, null);
                          return;
                        }
                        setValue(`locations.${i}.address`, pick.display_name, {
                          shouldDirty: true,
                        });
                        setValue(`locations.${i}.latitude`, pick.latitude, {
                          shouldDirty: true,
                        });
                        setValue(`locations.${i}.longitude`, pick.longitude, {
                          shouldDirty: true,
                        });
                        // The picked address is the authoritative source for the
                        // city; overwrite even if one was typed (still editable).
                        if (pick.city) {
                          setValue(`locations.${i}.city`, pick.city, {
                            shouldDirty: true,
                          });
                        }
                      }}
                    />
                  )}
                />
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`loc-city-${i}`} className="text-xs">
                    City
                  </Label>
                  <Controller
                    control={control}
                    name={`locations.${i}.city`}
                    render={({ field }) => (
                      <CityCombobox
                        id={`loc-city-${i}`}
                        value={field.value ?? null}
                        onChange={(v) => field.onChange(v)}
                        placeholder="Tempe"
                      />
                    )}
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
            </li>
          ))}
        </ul>
      )}

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-fit"
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
        <Plus className="size-4" />
        Add location
      </Button>
    </div>
  );
}
