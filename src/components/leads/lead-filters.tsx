"use client";

// URL-driven filter bar for the leads table. Selects apply instantly; the
// search box applies on submit (Enter). State lives entirely in searchParams
// so filtered views are shareable and the page stays a Server Component.

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { LEAD_SOURCES, LEAD_STATUSES } from "@/types/domain";
import { humanize } from "@/lib/utils";
import type { Option } from "@/components/leads/lead-form";

export function LeadFilters({ owners }: { owners: Option[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(params.size ? `${pathname}?${params.toString()}` : pathname);
  };

  const onSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = new FormData(e.currentTarget).get("q");
    setParam("q", String(value ?? "").trim());
  };

  const hasFilters = ["q", "status", "source", "temperature", "owner"].some((k) => searchParams.has(k));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form onSubmit={onSearch} className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          name="q"
          defaultValue={searchParams.get("q") ?? ""}
          key={searchParams.get("q") ?? ""}
          placeholder="Search name, phone, email…"
          className="w-64 pl-8"
        />
      </form>
      <Select
        aria-label="Filter by status"
        className="w-auto"
        value={searchParams.get("status") ?? ""}
        onChange={(e) => setParam("status", e.target.value)}
      >
        <option value="">All Statuses</option>
        {LEAD_STATUSES.map((s) => (
          <option key={s} value={s}>
            {humanize(s)}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Filter by source"
        className="w-auto"
        value={searchParams.get("source") ?? ""}
        onChange={(e) => setParam("source", e.target.value)}
      >
        <option value="">All Sources</option>
        {LEAD_SOURCES.map((s) => (
          <option key={s} value={s}>
            {humanize(s)}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Filter by temperature"
        className="w-auto"
        value={searchParams.get("temperature") ?? ""}
        onChange={(e) => setParam("temperature", e.target.value)}
      >
        <option value="">All Temperatures</option>
        <option value="HOT">Hot</option>
        <option value="WARM">Warm</option>
        <option value="COLD">Cold</option>
      </Select>
      <Select
        aria-label="Filter by owner"
        className="w-auto"
        value={searchParams.get("owner") ?? ""}
        onChange={(e) => setParam("owner", e.target.value)}
      >
        <option value="">All Owners</option>
        {owners.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </Select>
      {hasFilters ? (
        <Button variant="ghost" size="sm" onClick={() => router.replace(pathname)}>
          <X className="h-3.5 w-3.5" /> Clear
        </Button>
      ) : null}
    </div>
  );
}
