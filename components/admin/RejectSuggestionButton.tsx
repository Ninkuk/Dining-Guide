"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { rejectSuggestion } from "@/app/(admin)/_actions/suggestions";

export function RejectSuggestionButton({ id }: { id: number }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function onConfirm() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", String(id));
      if (reason.trim()) fd.set("reason", reason);
      const res = await rejectSuggestion(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Rejected");
      setOpen(false);
      setReason("");
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="text-muted-foreground">
          Reject
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reject this suggestion?</AlertDialogTitle>
          <AlertDialogDescription>
            Marks it rejected and removes it from the default queue. No notification is sent to the
            submitter.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reject-reason" className="text-xs">
            Reason (optional)
          </Label>
          <Input
            id="reject-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. duplicate, off-scope, spam"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button type="button" variant="destructive" disabled={pending} onClick={onConfirm}>
            {pending ? "Rejecting…" : "Reject"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
