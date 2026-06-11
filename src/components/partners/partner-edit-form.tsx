"use client";

import * as React from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { updatePartnerAction } from "@/server/modules/partners.actions";
import type { ChannelPartner } from "@/types/domain";

export function PartnerEditForm({ partner }: { partner: ChannelPartner }) {
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updatePartnerAction(partner.id, formData);
      if (result.ok) {
        setSaved(true);
        setOpen(false);
      } else {
        setError(result.error ?? "Failed to update partner");
      }
    });
  }

  if (!open) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => { setOpen(true); setSaved(false); }}>
          <Pencil className="h-3.5 w-3.5" />
          Edit Details
        </Button>
        {saved ? <span className="text-xs font-medium text-success">Saved</span> : null}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Partner</CardTitle>
        <CardDescription>Update contact, compliance and commission details.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Name</Label>
              <Input id="edit-name" name="name" defaultValue={partner.name} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-company">Company</Label>
              <Input id="edit-company" name="company" defaultValue={partner.company ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input id="edit-phone" name="phone" type="tel" defaultValue={partner.phone} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-email">Email</Label>
              <Input id="edit-email" name="email" type="email" defaultValue={partner.email ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-city">City</Label>
              <Input id="edit-city" name="city" defaultValue={partner.city ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-rera">RERA ID</Label>
              <Input id="edit-rera" name="reraId" defaultValue={partner.reraId ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-commission">Commission %</Label>
              <Input
                id="edit-commission"
                name="commissionPct"
                type="number"
                step="0.1"
                min="0"
                max="15"
                defaultValue={partner.commissionPct}
                required
              />
            </div>
          </div>

          {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
