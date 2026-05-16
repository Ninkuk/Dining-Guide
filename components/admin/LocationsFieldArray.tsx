"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RestaurantInput } from "@/lib/schemas/restaurant";
import { Plus, Trash2 } from "lucide-react";
import { Controller, useFieldArray, useFormContext } from "react-hook-form";
import { AddressAutocomplete } from "./AddressAutocomplete";

export function LocationsFieldArray() {
  const { control, register, setValue } = useFormContext<RestaurantInput>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "locations",
  });

  return (
    <div className="flex flex-col gap-3">
      {fields.length === 0 ? (
        <p className="border-border text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-center text-sm">
          No locations yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {fields.map((field, i) => (
            <li key={field.id} className="bg-card ring-foreground/10 rounded-xl p-4 ring-1">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-muted-foreground/70 text-[11px] tracking-wide uppercase">
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
                      <Input
                        id={`loc-city-${i}`}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value.trim().length === 0 ? null : e.target.value)
                        }
                        placeholder="e.g. Tempe"
                      />
                    )}
                  />
                  <p className="text-muted-foreground/70 text-[11px]">
                    Filled in from the address — edit if needed.
                  </p>
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
