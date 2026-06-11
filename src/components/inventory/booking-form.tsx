"use client";

import * as React from "react";
import { useActionState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { createBookingAction, type ActionState } from "@/server/modules/bookings.actions";
import { formatINR, humanize } from "@/lib/utils";
import type { BookingStatus } from "@/types/domain";

export interface LeadOption {
  id: string;
  name: string;
  phone: string;
}

export interface UnitOption {
  id: string;
  projectId: string;
  unitNumber: string;
  type: string;
  basePrice: number;
}

export interface ProjectOption {
  id: string;
  name: string;
}

export interface AgentOption {
  id: string;
  name: string;
}

const STATUS_OPTIONS: BookingStatus[] = ["TOKEN", "AGREEMENT", "REGISTERED"];

const INITIAL: ActionState = {};

export function BookingForm({
  leads,
  units,
  projects,
  agents,
}: {
  leads: LeadOption[];
  units: UnitOption[];
  projects: ProjectOption[];
  agents: AgentOption[];
}) {
  const [open, setOpen] = React.useState(false);
  const [projectId, setProjectId] = React.useState("");
  const [unitId, setUnitId] = React.useState("");
  const [state, formAction, pending] = useActionState(createBookingAction, INITIAL);

  const projectUnits = projectId ? units.filter((u) => u.projectId === projectId) : units;
  const selectedUnit = unitId ? units.find((u) => u.id === unitId) : undefined;

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> New Booking
      </Button>
    );
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(false)}>
        <X className="h-4 w-4" /> Close
      </Button>
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/30 p-4 pt-16">
        <Card className="w-full max-w-xl">
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div className="space-y-1.5">
              <CardTitle>New Booking</CardTitle>
              <CardDescription>
                Booking a unit flips it to BOOKED and creates the payment milestone plan.
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <form action={formAction} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="bkg-lead">Lead *</Label>
                <Select id="bkg-lead" name="leadId" required defaultValue="">
                  <option value="" disabled>
                    Select a lead…
                  </option>
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} · {l.phone}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="bkg-project">Project</Label>
                  <Select
                    id="bkg-project"
                    value={projectId}
                    onChange={(e) => {
                      setProjectId(e.target.value);
                      setUnitId("");
                    }}
                  >
                    <option value="">All projects</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bkg-unit">Available unit *</Label>
                  <Select
                    id="bkg-unit"
                    name="unitId"
                    required
                    value={unitId}
                    onChange={(e) => setUnitId(e.target.value)}
                  >
                    <option value="" disabled>
                      {projectUnits.length ? "Select a unit…" : "No available units"}
                    </option>
                    {projectUnits.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.unitNumber} · {u.type} · {formatINR(u.basePrice)}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bkg-agent">Agent</Label>
                  <Select id="bkg-agent" name="agentId" defaultValue="">
                    <option value="">Lead owner (default)</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bkg-status">Stage</Label>
                  <Select id="bkg-status" name="status" defaultValue="TOKEN">
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {humanize(s)}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bkg-value">Total value (₹)</Label>
                <Input
                  id="bkg-value"
                  name="totalValue"
                  type="number"
                  min={1}
                  step={1}
                  placeholder={
                    selectedUnit
                      ? `Defaults to base price — ${formatINR(selectedUnit.basePrice)}`
                      : "Defaults to the unit's base price"
                  }
                />
              </div>
              {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? "Booking…" : "Create Booking"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
