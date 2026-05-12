'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useForm, useFormContext, FormProvider, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { restaurantSchema, type RestaurantInput } from '@/lib/schemas/restaurant'
import { slugify } from '@/lib/slug'
import { CuisineCombobox, type CuisineOption } from './CuisineCombobox'
import { LocationsFieldArray } from './LocationsFieldArray'
import { StarRatingInput } from './StarRatingInput'
import { VisitedAtPicker } from './VisitedAtPicker'
import { PhotoUpload } from './PhotoUpload'
import { createRestaurant, updateRestaurant, deleteRestaurant } from '@/app/(admin)/_actions/restaurants'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

type Mode = 'create' | 'edit'

const NONE = '__none__'

/**
 * Editorial section header — a kicker over a hairline rule. Local to this file:
 * the kicker stays inlined everywhere else in the repo (see docs/design-memory),
 * this just keeps the form's five movements DRY.
 */
function Movement({
  kicker,
  hint,
  children,
}: {
  kicker: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-2.5">
        <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {kicker}
        </h2>
        {hint ? <span className="text-[11px] text-muted-foreground/70">{hint}</span> : null}
      </div>
      {children}
    </section>
  )
}

export function RestaurantForm({
  mode,
  defaultValues,
  cuisineOptions,
}: {
  mode: Mode
  defaultValues: RestaurantInput
  cuisineOptions: CuisineOption[]
}) {
  const [pending, startTransition] = useTransition()
  const [deletePending, setDeletePending] = useState(false)

  const form = useForm<RestaurantInput>({
    resolver: zodResolver(restaurantSchema),
    defaultValues,
    mode: 'onSubmit',
  })

  const { register, handleSubmit, control, watch, setValue, formState, getValues } = form
  // React Compiler can't memoize RHF's watch(); accepted limitation.
  // eslint-disable-next-line react-hooks/incompatible-library
  const slug = watch('slug')
  const name = watch('name')
  const locationCount = (watch('locations') ?? []).length

  // The slug is derived from the name and shown read-only. In `edit` mode it
  // stays put — the slug is the live URL, so a rename must not silently break
  // inbound links.
  function onNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value
    setValue('name', next, { shouldValidate: false })
    if (mode === 'create') {
      setValue('slug', slugify(next), { shouldValidate: false })
    }
  }

  function onSubmit(values: RestaurantInput) {
    startTransition(async () => {
      const action = mode === 'create' ? createRestaurant : updateRestaurant
      const res = await action(values)
      if (res && 'ok' in res && !res.ok) {
        toast.error(res.error)
        if (res.fields) {
          for (const [field, msgs] of Object.entries(res.fields)) {
            if (Array.isArray(msgs) && msgs.length > 0) {
              form.setError(field as keyof RestaurantInput, { message: msgs[0] })
            }
          }
        }
      }
    })
  }

  async function onDelete() {
    setDeletePending(true)
    const id = getValues('id')
    if (id == null) return
    const fd = new FormData()
    fd.set('id', String(id))
    try {
      await deleteRestaurant(fd)
    } catch (err) {
      const msg = (err as Error).message
      if (msg === 'NEXT_REDIRECT') return // expected on success
      toast.error(msg)
    } finally {
      setDeletePending(false)
    }
  }

  // With no slug field, a slug regex/reserved-word error is effectively a name
  // problem — surface it under the name input.
  const nameError = formState.errors.name?.message ?? formState.errors.slug?.message
  const cancelHref = mode === 'edit' && defaultValues.slug ? `/${defaultValues.slug}` : '/'

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-8">
        <input type="hidden" {...register('slug')} />

        {/* — The basics — */}
        <Movement kicker="The basics">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              {...register('name')}
              onChange={onNameChange}
              autoFocus
              className="h-11 text-lg font-medium"
            />
            {nameError ? (
              <span className="text-xs text-destructive">{nameError}</span>
            ) : (
              <span className="font-mono text-xs text-muted-foreground">
                /{slug}
                <span className="ml-2 text-muted-foreground/60">· derived from the name</span>
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Cuisine</Label>
            <Controller
              control={control}
              name="cuisine"
              render={({ field }) => (
                <CuisineCombobox
                  options={cuisineOptions}
                  value={field.value ?? []}
                  onChange={(next) => field.onChange(next)}
                />
              )}
            />
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Rating</Label>
              <Controller
                control={control}
                name="rating"
                render={({ field }) => (
                  <StarRatingInput
                    value={field.value ?? null}
                    onChange={(n) => field.onChange(n)}
                  />
                )}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Status</Label>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <RadioGroup
                    value={field.value}
                    onValueChange={field.onChange}
                    className="flex gap-5 pt-1.5"
                  >
                    <label className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value="visited" />
                      Visited
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value="want_to_try" />
                      Want to try
                    </label>
                  </RadioGroup>
                )}
              />
            </div>
          </div>
        </Movement>

        {/* — The write-up — */}
        <Movement kicker="The write-up" hint="the note is what shows up on the page">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">The note</Label>
            <Textarea
              id="notes"
              {...register('notes')}
              rows={6}
              className="resize-y text-base leading-relaxed"
              placeholder="What was it like? Write it the way you'd tell a friend…"
            />
          </div>
          <TextareaField name="pros" label="What's good" />
          <TextareaField name="cons" label="What's not" />
          <TextareaField name="recommendations" label="When you go" />
        </Movement>

        {/* — Details — */}
        <Movement kicker="Details">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Occasion</Label>
              <Controller
                control={control}
                name="occasion"
                render={({ field }) => (
                  <Select
                    value={(field.value as string | null) ?? NONE}
                    onValueChange={(v) => field.onChange(v === NONE ? null : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a vibe…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>None</SelectItem>
                      <SelectItem value="Quick">Quick</SelectItem>
                      <SelectItem value="Casual">Casual</SelectItem>
                      <SelectItem value="Elevated">Elevated</SelectItem>
                      <SelectItem value="Fine Dine">Fine Dine</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Wallet</Label>
              <Controller
                control={control}
                name="wallet"
                render={({ field }) => (
                  <Select
                    value={(field.value as string | null) ?? NONE}
                    onValueChange={(v) => field.onChange(v === NONE ? null : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a spend tier…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>None</SelectItem>
                      <SelectItem value="Cheap">Cheap</SelectItem>
                      <SelectItem value="Normal">Normal</SelectItem>
                      <SelectItem value="Splurge">Splurge</SelectItem>
                      <SelectItem value="Big night">Big night</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <DietaryRadio name="vegetarian" label="Vegetarian-friendly" />
            <div className="flex flex-col gap-2">
              <Label>Visited on</Label>
              <Controller
                control={control}
                name="visited_at"
                render={({ field }) => (
                  <VisitedAtPicker
                    value={(field.value as string | null) ?? null}
                    onChange={(v) => field.onChange(v)}
                  />
                )}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Permanently closed</Label>
              <Controller
                control={control}
                name="permanently_closed"
                render={({ field }) => (
                  <div className="flex items-center gap-2 pt-1.5">
                    <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                    <span className="text-sm text-muted-foreground">No longer open</span>
                  </div>
                )}
              />
            </div>
          </div>
        </Movement>

        {/* — Where — */}
        <Movement
          kicker="Where"
          hint={
            locationCount > 0
              ? `${locationCount} location${locationCount === 1 ? '' : 's'}`
              : undefined
          }
        >
          <LocationsFieldArray />
        </Movement>

        {/* — Photo (supplementary, last) — */}
        <Movement kicker="Photo" hint="optional — the page works without one">
          <Controller
            control={control}
            name="photo_url"
            render={({ field }) => (
              <PhotoUpload
                value={(field.value as string | null) ?? null}
                onChange={(url) => field.onChange(url)}
                restaurantSlug={slug || slugify(name || 'restaurant')}
              />
            )}
          />
        </Movement>

        {/* Delete — quiet, edit-mode only, outside the save bar */}
        {mode === 'edit' && getValues('id') != null ? (
          <div className="border-t border-border/60 pt-5">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  className="rounded text-sm text-destructive underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
                >
                  Delete this entry
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete &ldquo;{name}&rdquo;?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Removes the restaurant and all {(getValues('locations') ?? []).length}{' '}
                    location(s). Cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction asChild>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={deletePending}
                      onClick={onDelete}
                    >
                      {deletePending ? 'Deleting…' : 'Delete'}
                    </Button>
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : null}

        {/* Sticky save bar — spans the column gutter, content stays inset */}
        <div className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-background/85 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {mode === 'edit' ? (
                <>
                  Editing <span className="font-medium text-foreground">{name}</span>
                </>
              ) : (
                'New entry'
              )}
            </span>
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost">
                <Link href={cancelHref}>Cancel</Link>
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? 'Saving…' : mode === 'create' ? 'Create' : 'Save changes'}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </FormProvider>
  )
}

function TextareaField({
  name,
  label,
}: {
  name: 'pros' | 'cons' | 'recommendations'
  label: string
}) {
  const form = useFormContext<RestaurantInput>()
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name} className="text-muted-foreground">
        {label}
      </Label>
      <Textarea id={name} {...form.register(name)} rows={2} className="resize-y" />
    </div>
  )
}

function DietaryRadio({
  name,
  label,
}: {
  name: 'vegetarian'
  label: string
}) {
  const form = useFormContext<RestaurantInput>()
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => (
          <RadioGroup
            value={(field.value as string | null) ?? ''}
            onValueChange={(v) => field.onChange(v === '' ? null : v)}
            className="flex gap-4 pt-1.5"
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
              Unknown
            </label>
          </RadioGroup>
        )}
      />
    </div>
  )
}
