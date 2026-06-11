"use client";

import * as React from "react";
import { UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { createPartnerAction } from "@/server/modules/partners.actions";

export function OnboardPartnerForm() {
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const formRef = React.useRef<HTMLFormElement>(null);

  function close() {
    setOpen(false);
    setError(null);
    formRef.current?.reset();
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await createPartnerAction(formData);
      if (result.ok) {
        close();
      } else {
        setError(result.error ?? "Failed to onboard partner");
      }
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus className="h-4 w-4" />
        Onboard Partner
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center">
          <Card className="w-full max-w-lg">
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div className="space-y-1.5">
                <CardTitle>Onboard Channel Partner</CardTitle>
                <CardDescription>
                  New partners start in Pending until approved by a sales head.
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={close} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="cp-name">Name *</Label>
                    <Input id="cp-name" name="name" placeholder="e.g. Ravi Sharma" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cp-company">Company</Label>
                    <Input id="cp-company" name="company" placeholder="e.g. Sharma Realty" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cp-phone">Phone *</Label>
                    <Input id="cp-phone" name="phone" type="tel" placeholder="+91 98765 43210" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cp-email">Email</Label>
                    <Input id="cp-email" name="email" type="email" placeholder="partner@example.com" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cp-city">City</Label>
                    <Input id="cp-city" name="city" placeholder="e.g. Mumbai" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cp-rera">RERA ID</Label>
                    <Input id="cp-rera" name="reraId" placeholder="RERA/MH/AG/000" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cp-commission">Commission % *</Label>
                    <Input
                      id="cp-commission"
                      name="commissionPct"
                      type="number"
                      step="0.1"
                      min="0"
                      max="15"
                      defaultValue="2"
                      required
                    />
                  </div>
                </div>

                {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={close} disabled={pending}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={pending}>
                    {pending ? "Onboarding…" : "Onboard Partner"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </>
  );
}
