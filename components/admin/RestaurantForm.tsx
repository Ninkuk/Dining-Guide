'use client'

import { useState, useTransition } from 'react'
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
import { Separator } from '@/components/ui/separator'
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

  // Auto-slug from name (only while user hasn't manually edited slug field).
  function onNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value
    setValue('name', next, { shouldValidate: false })
    if (mode === 'create' && !formState.dirtyFields.slug) {
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

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        {/* Name + slug */}
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...register('name')} onChange={onNameChange} autoFocus />
            {formState.errors.name ? (
              <span className="text-xs text-destructive">
                {formState.errors.name.message}
              </span>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="slug">Slug</Label>
            <Input id="slug" {...register('slug')} placeholder="auto-generated" />
            {formState.errors.slug ? (
              <span className="text-xs text-destructive">
                {formState.errors.slug.message}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">/{slug}</span>
            )}
          </div>
        </section>

        <Separator />

        {/* Cuisine */}
        <section className="flex flex-col gap-2">
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
        </section>

        <Separator />

        {/* Rating + Status + visited_at + chain */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  className="flex gap-4"
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
          <div className="flex flex-col gap-2">
            <Label>Visited at</Label>
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
            <Label>Chain</Label>
            <Controller
              control={control}
              name="is_chain"
              render={({ field }) => (
                <div className="flex items-center gap-2">
                  <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                  <span className="text-sm text-muted-foreground">
                    Multi-location chain
                  </span>
                </div>
              )}
            />
          </div>
        </section>

        <Separator />

        {/* Occasion + wallet */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        </section>

        <Separator />

        {/* Vegetarian + halal */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DietaryRadio name="vegetarian" label="Vegetarian-friendly" />
          <DietaryRadio name="halal" label="Halal" />
        </section>

        <Separator />

        {/* Photo */}
        <section className="flex flex-col gap-2">
          <Label>Photo</Label>
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
        </section>

        <Separator />

        {/* Notes etc. */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextareaField name="notes" label="Notes" />
          <TextareaField name="pros" label="Pros" />
          <TextareaField name="cons" label="Cons" />
          <TextareaField name="recommendations" label="Recommendations" />
        </section>

        <Separator />

        {/* Locations */}
        <LocationsFieldArray />

        {/* Submit / delete */}
        <div className="flex items-center justify-between gap-3 pt-4">
          {mode === 'edit' && getValues('id') != null ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive">
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Delete &ldquo;{name}&rdquo;?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Removes the restaurant and all{' '}
                    {(getValues('locations') ?? []).length} location(s). Cannot be undone.
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
          ) : (
            <span />
          )}

          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : mode === 'create' ? 'Create' : 'Save changes'}
          </Button>
        </div>
      </form>
    </FormProvider>
  )
}

function TextareaField({
  name,
  label,
}: {
  name: 'notes' | 'pros' | 'cons' | 'recommendations'
  label: string
}) {
  const form = useFormContext<RestaurantInput>()
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Textarea id={name} {...form.register(name)} rows={3} />
    </div>
  )
}

function DietaryRadio({
  name,
  label,
}: {
  name: 'vegetarian' | 'halal'
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
            className="flex gap-4"
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

