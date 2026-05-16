"use client";

// Correction submit form for anonymous readers.
//
// Sparse semantics: every whitelisted field renders with the current value pre-
// filled. On submit, the client diffs against the original — only changed
// fields go into the payload. This way "Submitting with one field changed
// creates a Suggestion whose payload contains only that key" falls out
// naturally, no per-field "edit?" toggle required.
//
// Off-whitelist fields (notes / pros / cons / recommendations / rating /
// occasion / wallet / status / visited_at / slug) are physically absent from
// the DOM — even devtools can't introduce them at this layer, and the server
// action's Zod parse strips them again if they sneak in.

import { useState, useTransition } from "react";
import Link from "next/link";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { AddressAutocomplete } from "@/components/admin/AddressAutocomplete";
import { ConstrainedCuisineCombobox } from "./ConstrainedCuisineCombobox";
import { QuarantinePhotoUpload, type QuarantinePhotoValue } from "./QuarantinePhotoUpload";
import type { CuisineOption } from "@/components/admin/CuisineCombobox";
import { submitSuggestion } from "@/app/(public)/_actions/suggestions";
import type { RestaurantWithLocations } from "@/lib/queries/restaurants";

type FormShape = {
  submitter_name: string;
  name: string;
  permanently_closed: boolean;
  cuisine: string[];
  vegetarian: "yes" | "no" | "";
  locations: Array<{
    id?: number;
    city: string | null;
    locality: string | null;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
  }>;
  anything_else: string;
  _website: string;
};

export function CorrectionSuggestionForm({
  restaurant,
  cuisines,
}: {
  restaurant: RestaurantWithLocations;
  cuisines: CuisineOption[];
}) {
  const original: FormShape = {
    submitter_name: "",
    name: restaurant.name,
    permanently_closed: restaurant.permanently_closed,
    cuisine: restaurant.cuisine ?? [],
    vegetarian: (restaurant.vegetarian as "yes" | "no" | null) ?? "",
    locations: restaurant.locations.map((l) => ({
      id: l.id,
      city: l.city,
      locality: l.locality,
      address: l.address,
      latitude: l.latitude,
      longitude: l.longitude,
    })),
    anything_else: "",
    _website: "",
  };

  const [pending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const [photo, setPhoto] = useState<QuarantinePhotoValue | null>(null);
  const form = useForm<FormShape>({ defaultValues: original, mode: "onSubmit" });
  const { control, register, handleSubmit, formState, watch, setValue } = form;
  const locationsArray = useFieldArray({ control, name: "locations" });

  function onSubmit(values: FormShape) {
    const payload = buildSparsePayload(original, values);
    const anything = values.anything_else.trim() || null;

    // If the submitter touched nothing AND wrote no note AND attached no
    // photo, refuse — nothing to send.
    if (Object.keys(payload).length === 0 && !anything && !photo) {
      toast.error("Change at least one field, attach a photo, or add a note.");
      return;
    }

    startTransition(async () => {
      const res = await submitSuggestion({
        kind: "correction",
        target_restaurant_id: restaurant.id,
        submitter_name: values.submitter_name,
        payload,
        anything_else: anything,
        photo_path: photo?.path ?? null,
        _website: values._website,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setSubmitted(true);
    });
  }

  if (submitted) {
    return (
      <div className="border-border/60 flex flex-col gap-3 rounded-2xl border p-6">
        <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
          Thanks
        </p>
        <p className="text-base leading-relaxed">
          Got it — your correction is in the moderation queue. If it lands on the page, the change
          will be applied in the owner&rsquo;s voice; if not, you won&rsquo;t hear back.
        </p>
        <Link
          href={`/${restaurant.slug}`}
          className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
        >
          Back to {restaurant.name}
        </Link>
      </div>
    );
  }

  // eslint-disable-next-line react-hooks/incompatible-library
  const locations = watch("locations");

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="flex flex-col gap-7">
      {/* Honeypot — visually hidden, tab-skipped. */}
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        {...register("_website")}
        className="absolute -left-[9999px] size-0 opacity-0"
      />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="submitter_name">Your name</Label>
        <Input
          id="submitter_name"
          {...register("submitter_name", { required: true })}
          autoComplete="name"
          className="h-11"
          placeholder="Friend, family, stranger — just so I know who"
        />
        {formState.errors.submitter_name ? (
          <span className="text-destructive text-xs">Required.</span>
        ) : (
          <span className="text-muted-foreground text-xs">
            Required. No email asked for, no follow-up will be sent.
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="r-name">Name</Label>
        <Input id="r-name" {...register("name")} className="h-11 text-base" />
        <span className="text-muted-foreground text-xs">
          Currently: <span className="font-medium">{restaurant.name}</span>
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Cuisine</Label>
        <Controller
          control={control}
          name="cuisine"
          render={({ field }) => (
            <ConstrainedCuisineCombobox
              options={cuisines}
              value={field.value ?? []}
              onChange={(next) => field.onChange(next)}
            />
          )}
        />
        <span className="text-muted-foreground text-xs">
          Currently:{" "}
          {restaurant.cuisine.length === 0 ? (
            <span className="italic">none</span>
          ) : (
            <span className="font-medium">{restaurant.cuisine.join(" · ")}</span>
          )}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Vegetarian-friendly?</Label>
        <Controller
          control={control}
          name="vegetarian"
          render={({ field }) => (
            <RadioGroup
              value={field.value ?? ""}
              onValueChange={(v) => field.onChange(v)}
              className="flex gap-4 pt-1"
            >
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="yes" />
                Yes
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="no" />
                No
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="" />
                Not sure
              </label>
            </RadioGroup>
          )}
        />
        <span className="text-muted-foreground text-xs">
          Currently:{" "}
          <span className="font-medium">
            {restaurant.vegetarian === "yes"
              ? "Yes"
              : restaurant.vegetarian === "no"
                ? "No"
                : "Unknown"}
          </span>
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Permanently closed</Label>
        <Controller
          control={control}
          name="permanently_closed"
          render={({ field }) => (
            <div className="flex items-center gap-2 pt-1">
              <Switch checked={!!field.value} onCheckedChange={field.onChange} />
              <span className="text-muted-foreground text-sm">No longer open</span>
            </div>
          )}
        />
        <span className="text-muted-foreground text-xs">
          Currently:{" "}
          <span className="font-medium">{restaurant.permanently_closed ? "Closed" : "Open"}</span>
        </span>
      </div>

      <div className="flex flex-col gap-3">
        <Label>Where</Label>
        <ul className="flex flex-col gap-2.5">
          {locationsArray.fields.map((field, i) => (
            <li key={field.id} className="bg-card ring-foreground/10 rounded-xl p-4 ring-1">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-muted-foreground/70 text-[11px] tracking-wide uppercase">
                  Location {i + 1}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-xs"
                  onClick={() => locationsArray.remove(i)}
                >
                  Remove
                </Button>
              </div>
              <div className="flex flex-col gap-2.5">
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
                        setValue(`locations.${i}.latitude`, pick.latitude, { shouldDirty: true });
                        setValue(`locations.${i}.longitude`, pick.longitude, {
                          shouldDirty: true,
                        });
                        if (pick.city) {
                          setValue(`locations.${i}.city`, pick.city, { shouldDirty: true });
                        }
                      }}
                    />
                  )}
                />
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`c-loc-city-${i}`} className="text-xs">
                      City
                    </Label>
                    <Controller
                      control={control}
                      name={`locations.${i}.city`}
                      render={({ field: f }) => (
                        <Input
                          id={`c-loc-city-${i}`}
                          value={f.value ?? ""}
                          onChange={(e) =>
                            f.onChange(e.target.value.trim().length === 0 ? null : e.target.value)
                          }
                        />
                      )}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`c-loc-locality-${i}`} className="text-xs">
                      Locality / Note
                    </Label>
                    <Input id={`c-loc-locality-${i}`} {...register(`locations.${i}.locality`)} />
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() =>
            locationsArray.append({
              city: null,
              locality: null,
              address: null,
              latitude: null,
              longitude: null,
            })
          }
        >
          Add a location
        </Button>
        <span className="text-muted-foreground text-xs">
          Currently {restaurant.locations.length} on file. Edit, add, or remove rows to propose a
          change. Leaving the list unchanged keeps it out of the payload.
          {locations && locations.length > 0
            ? ""
            : restaurant.locations.length === 0
              ? ""
              : " Removing all rows proposes clearing every location."}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="anything_else">Anything else</Label>
        <Textarea
          id="anything_else"
          {...register("anything_else")}
          rows={4}
          className="resize-y"
          placeholder="Context the structured fields don't fit — moved address, new owner, a missing cuisine the owner should add, etc."
        />
        <span className="text-muted-foreground text-xs">
          Free text — lands on the queue item, doesn&rsquo;t auto-edit any field.
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Photo</Label>
        <QuarantinePhotoUpload value={photo} onChange={setPhoto} />
        <span className="text-muted-foreground text-xs">
          Optional. Helps when proposing a closed-sign or storefront photo.
        </span>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button asChild variant="ghost">
          <Link href={`/${restaurant.slug}`}>Cancel</Link>
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send correction"}
        </Button>
      </div>
    </form>
  );
}

// Compute the sparse payload: only fields whose value differs from the original.
// undefined keys are stripped at JSON serialization time, so the resulting
// object matches `{ field: value }` for each changed key only.
function buildSparsePayload(original: FormShape, values: FormShape): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  if (values.name.trim() !== original.name) out.name = values.name.trim();
  if (values.permanently_closed !== original.permanently_closed)
    out.permanently_closed = values.permanently_closed;
  if (values.vegetarian !== original.vegetarian) out.vegetarian = values.vegetarian;
  if (!arrayEqualOrdered(values.cuisine, original.cuisine)) out.cuisine = values.cuisine;

  // Locations: emit if length differs, or any row's structural fields differ.
  if (!locationsEqual(values.locations, original.locations)) {
    out.locations = values.locations.map((l) => ({
      city: l.city,
      locality: l.locality,
      address: l.address,
      latitude: l.latitude,
      longitude: l.longitude,
    }));
  }

  return out;
}

function arrayEqualOrdered(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function locationsEqual(a: FormShape["locations"], b: FormShape["locations"]): boolean {
  if (a.length !== b.length) return false;
  return a.every((l, i) => {
    const o = b[i];
    return (
      (l.city ?? null) === (o.city ?? null) &&
      (l.locality ?? null) === (o.locality ?? null) &&
      (l.address ?? null) === (o.address ?? null) &&
      (l.latitude ?? null) === (o.latitude ?? null) &&
      (l.longitude ?? null) === (o.longitude ?? null)
    );
  });
}
