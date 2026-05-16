"use client";

// Tip submit form for anonymous readers (Suggestion of kind "tip").
//
// One movement instead of the admin form's five — Tips are sparse on purpose
// (the owner pre-fills the rest during accept). Fields rendered: submitter
// name (required), restaurant name (required), cuisine (constrained), one
// editable location row (city + locality + autocomplete address),
// vegetarian-friendly (yes/no/unknown), an "anything else" textarea, and the
// hidden honeypot.

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AddressAutocomplete } from "@/components/admin/AddressAutocomplete";
import { ConstrainedCuisineCombobox } from "./ConstrainedCuisineCombobox";
import { QuarantinePhotoUpload, type QuarantinePhotoValue } from "./QuarantinePhotoUpload";
import type { CuisineOption } from "@/components/admin/CuisineCombobox";
import { suggestionSchema, type SuggestionInput } from "@/lib/suggestions/schema";
import { submitSuggestion } from "@/app/(public)/_actions/suggestions";

type FormShape = SuggestionInput & { _website?: string };

const DEFAULTS: FormShape = {
  kind: "tip",
  target_restaurant_id: null,
  submitter_name: "",
  payload: {
    name: "",
    cuisine: [],
    vegetarian: null,
    permanently_closed: false,
    photo_url: null,
    locations: [],
  },
  anything_else: null,
  photo_path: null,
  _website: "",
};

export function TipSuggestionForm({ cuisines }: { cuisines: CuisineOption[] }) {
  const [pending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  // Photo state lives outside RHF — the upload is an async side-effect, not a
  // managed form field. We merge the resulting path into `photo_path` on submit.
  const [photo, setPhoto] = useState<QuarantinePhotoValue | null>(null);

  const form = useForm<FormShape>({
    resolver: zodResolver(suggestionSchema),
    defaultValues: DEFAULTS,
    mode: "onSubmit",
  });

  const { register, handleSubmit, control, formState, watch, setValue } = form;
  // Location editor: a Tip can carry zero or one location (multi-location is
  // an admin-side concern; Tips that mention a chain go in "anything else").
  // eslint-disable-next-line react-hooks/incompatible-library
  const locations = watch("payload.locations") ?? [];
  const { append, remove } = useFieldArray({ control, name: "payload.locations" });

  function onSubmit(values: FormShape) {
    startTransition(async () => {
      const res = await submitSuggestion({ ...values, photo_path: photo?.path ?? null });
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
          Got it — your tip is in the moderation queue. If it makes it onto the guide, it&rsquo;ll
          show up under the owner&rsquo;s own writing; if not, you won&rsquo;t hear back.
          That&rsquo;s the contract.
        </p>
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
        >
          Back to the guide
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="flex flex-col gap-7">
      {/* Honeypot — visually hidden, tab-skipped, not announced to AT. Bots fill
          fields named like this; humans never see them. */}
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
          {...register("submitter_name")}
          autoComplete="name"
          className="h-11"
          placeholder="Friend, family, stranger — just so I know who"
        />
        {formState.errors.submitter_name ? (
          <span className="text-destructive text-xs">
            {formState.errors.submitter_name.message}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">
            Required. No email asked for, no follow-up will be sent — see the page intro.
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="restaurant_name">Restaurant name</Label>
        <Input
          id="restaurant_name"
          {...register("payload.name")}
          className="h-11 text-lg font-medium"
        />
        {formState.errors.payload?.name ? (
          <span className="text-destructive text-xs">{formState.errors.payload.name.message}</span>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label>Cuisine</Label>
        <Controller
          control={control}
          name="payload.cuisine"
          render={({ field }) => (
            <ConstrainedCuisineCombobox
              options={cuisines}
              value={field.value ?? []}
              onChange={(next) => field.onChange(next)}
            />
          )}
        />
        <span className="text-muted-foreground text-xs">
          At least one. Cuisine not listed? Mention it in &ldquo;anything else&rdquo; below.
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Vegetarian-friendly?</Label>
        <Controller
          control={control}
          name="payload.vegetarian"
          render={({ field }) => (
            <RadioGroup
              value={field.value ?? ""}
              onValueChange={(v) => field.onChange(v === "" ? null : v)}
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
      </div>

      <div className="flex flex-col gap-3">
        <Label>Where</Label>
        {locations.length === 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() =>
              append({ city: null, locality: null, address: null, latitude: null, longitude: null })
            }
          >
            Add a location
          </Button>
        ) : (
          <div className="bg-card ring-foreground/10 flex flex-col gap-3 rounded-xl p-4 ring-1">
            <Controller
              control={control}
              name="payload.locations.0.address"
              render={({ field }) => (
                <AddressAutocomplete
                  value={field.value ?? null}
                  onPick={(pick) => {
                    if (!pick) {
                      setValue("payload.locations.0.address", null);
                      setValue("payload.locations.0.latitude", null);
                      setValue("payload.locations.0.longitude", null);
                      return;
                    }
                    setValue("payload.locations.0.address", pick.display_name, {
                      shouldDirty: true,
                    });
                    setValue("payload.locations.0.latitude", pick.latitude, { shouldDirty: true });
                    setValue("payload.locations.0.longitude", pick.longitude, {
                      shouldDirty: true,
                    });
                    if (pick.city) {
                      setValue("payload.locations.0.city", pick.city, { shouldDirty: true });
                    }
                  }}
                />
              )}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="loc-city" className="text-xs">
                  City
                </Label>
                <Controller
                  control={control}
                  name="payload.locations.0.city"
                  render={({ field }) => (
                    <Input
                      id="loc-city"
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(e.target.value.trim().length === 0 ? null : e.target.value)
                      }
                      placeholder="e.g. Tempe"
                    />
                  )}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="loc-locality" className="text-xs">
                  Locality / Note
                </Label>
                <Input
                  id="loc-locality"
                  {...register("payload.locations.0.locality")}
                  placeholder="Mill Ave, near campus"
                />
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-fit text-xs"
              onClick={() => remove(0)}
            >
              Remove location
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="anything_else">Anything else</Label>
        <Textarea
          id="anything_else"
          {...register("anything_else")}
          rows={4}
          className="resize-y"
          placeholder="Context that doesn't fit above — chain branches, missing cuisine, dietary detail, etc."
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Photo</Label>
        <QuarantinePhotoUpload value={photo} onChange={setPhoto} />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button asChild variant="ghost">
          <Link href="/">Cancel</Link>
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send tip"}
        </Button>
      </div>
    </form>
  );
}
