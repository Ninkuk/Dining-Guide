'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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
import { deleteRestaurant } from '@/app/(admin)/_actions/restaurants'

type DeleteRestaurantButtonProps = {
  id: number
  name: string
  locationCount: number
}

/**
 * Admin-only "Delete restaurant" affordance for the public detail page. Mirrors
 * the confirm flow inside the edit form so delete no longer requires opening it.
 * Rendered only after a server-side auth check (see `DeleteButton` on the page).
 */
export function DeleteRestaurantButton({ id, name, locationCount }: DeleteRestaurantButtonProps) {
  const [pending, setPending] = useState(false)

  async function onDelete() {
    setPending(true)
    const fd = new FormData()
    fd.set('id', String(id))
    try {
      await deleteRestaurant(fd)
    } catch (err) {
      const msg = (err as Error).message
      if (msg === 'NEXT_REDIRECT') return // expected on success
      toast.error(msg)
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" size="sm" variant="ghost" className="text-destructive hover:text-destructive">
          <Trash2 className="size-4" />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &ldquo;{name}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            Removes the restaurant and all {locationCount} location(s). Cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button type="button" variant="destructive" disabled={pending} onClick={onDelete}>
              {pending ? 'Deleting…' : 'Delete'}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
