"use client";

import * as React from "react";
import { useActionState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { createProjectAction, type ActionState } from "@/server/modules/inventory.actions";
import { humanize } from "@/lib/utils";
import type { ProjectStatus } from "@/types/domain";

const STATUS_OPTIONS: ProjectStatus[] = ["UPCOMING", "ONGOING", "READY_TO_MOVE", "SOLD_OUT"];

const INITIAL: ActionState = {};

export function ProjectForm() {
  const [open, setOpen] = React.useState(false);
  const [state, formAction, pending] = useActionState(createProjectAction, INITIAL);

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> New Project
      </Button>
    );
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(false)}>
        <X className="h-4 w-4" /> Close
      </Button>
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/30 p-4 pt-16">
        <Card className="w-full max-w-2xl">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>New Project</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <form action={formAction} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="proj-name">Project name *</Label>
                  <Input id="proj-name" name="name" placeholder="Skyline Heights" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="proj-developer">Developer</Label>
                  <Input id="proj-developer" name="developer" placeholder="Prestige Group" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="proj-city">City *</Label>
                  <Input id="proj-city" name="city" placeholder="Mumbai" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="proj-locality">Locality</Label>
                  <Input id="proj-locality" name="locality" placeholder="Powai" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="proj-status">Status</Label>
                  <Select id="proj-status" name="status" defaultValue="UPCOMING">
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {humanize(s)}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="proj-rera">RERA ID</Label>
                  <Input id="proj-rera" name="reraId" placeholder="RERA/MUM/2026/1234" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="proj-cover">Cover image URL</Label>
                <Input id="proj-cover" name="coverImage" type="url" placeholder="https://…" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="proj-amenities">Amenities (comma separated)</Label>
                <Input id="proj-amenities" name="amenities" placeholder="Clubhouse, Pool, Gym" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="proj-description">Description</Label>
                <Textarea
                  id="proj-description"
                  name="description"
                  placeholder="A premium residential development…"
                />
              </div>
              {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? "Creating…" : "Create Project"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
