"use client";

// Create a project, or edit an existing one. Projects were create-only:
// updateProjectAction existed but nothing called it, so a project's city,
// developer or RERA id could never be corrected after the fact.

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import {
  createProjectAction,
  updateProjectFormAction,
  type ActionState,
} from "@/server/modules/inventory.actions";
import { humanize } from "@/lib/utils";
import type { Project, ProjectStatus } from "@/types/domain";

const STATUS_OPTIONS: ProjectStatus[] = ["UPCOMING", "ONGOING", "READY_TO_MOVE", "SOLD_OUT"];

const INITIAL: ActionState = {};

export function ProjectForm({ project }: { project?: Project }) {
  const editing = Boolean(project);
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  const action = editing ? updateProjectFormAction.bind(null, project!.id) : createProjectAction;
  const [state, formAction, pending] = useActionState(action, INITIAL);

  // Close and refresh once the server confirms the edit.
  React.useEffect(() => {
    if (editing && state.success) {
      setOpen(false);
      router.refresh();
    }
  }, [editing, state, router]);

  if (!open) {
    return editing ? (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4" /> Edit details
      </Button>
    ) : (
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
            <CardTitle>{editing ? `Edit ${project!.name}` : "New Project"}</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <form action={formAction} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="proj-name">Project name *</Label>
                  <Input
                    id="proj-name"
                    name="name"
                    placeholder="Skyline Heights"
                    defaultValue={project?.name}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="proj-developer">Developer</Label>
                  <Input
                    id="proj-developer"
                    name="developer"
                    placeholder="Prestige Group"
                    defaultValue={project?.developer ?? ""}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="proj-city">City *</Label>
                  <Input
                    id="proj-city"
                    name="city"
                    placeholder="Mumbai"
                    defaultValue={project?.city}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="proj-locality">Locality</Label>
                  <Input
                    id="proj-locality"
                    name="locality"
                    placeholder="Powai"
                    defaultValue={project?.locality ?? ""}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="proj-status">Status</Label>
                  <Select id="proj-status" name="status" defaultValue={project?.status ?? "UPCOMING"}>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {humanize(s)}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="proj-rera">RERA ID</Label>
                  <Input
                    id="proj-rera"
                    name="reraId"
                    placeholder="RERA/MUM/2026/1234"
                    defaultValue={project?.reraId ?? ""}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="proj-cover">Cover image URL</Label>
                <Input
                  id="proj-cover"
                  name="coverImage"
                  type="url"
                  placeholder="https://…"
                  defaultValue={project?.coverImage ?? ""}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="proj-amenities">Amenities (comma separated)</Label>
                <Input
                  id="proj-amenities"
                  name="amenities"
                  placeholder="Clubhouse, Pool, Gym"
                  defaultValue={project?.amenities.join(", ") ?? ""}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="proj-description">Description</Label>
                <Textarea
                  id="proj-description"
                  name="description"
                  placeholder="A premium residential development…"
                  defaultValue={project?.description ?? ""}
                />
              </div>
              {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending
                    ? editing
                      ? "Saving…"
                      : "Creating…"
                    : editing
                      ? "Save changes"
                      : "Create Project"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
