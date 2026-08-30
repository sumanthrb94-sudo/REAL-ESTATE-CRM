"use client";

// Topbar search. Debounced, keyboard-navigable, and closes on Escape or an
// outside click. Results come from a server action so row-level scoping is
// applied on the server, not trusted to the browser.

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Loader2, Building2, User as UserIcon, Handshake } from "lucide-react";
import { searchAction } from "@/server/modules/search.actions";
import type { SearchResult, SearchResultKind } from "@/server/modules/search";
import { cn } from "@/lib/utils";

const ICONS: Record<SearchResultKind, React.ComponentType<{ className?: string }>> = {
  lead: UserIcon,
  project: Building2,
  partner: Handshake,
  booking: Building2,
};

const KIND_LABEL: Record<SearchResultKind, string> = {
  lead: "Lead",
  project: "Project",
  partner: "Partner",
  booking: "Booking",
};

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Debounced search. The request id guards against out-of-order responses
  // overwriting a newer result set.
  const requestId = React.useRef(0);
  React.useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      try {
        const found = await searchAction(q);
        if (id === requestId.current) {
          setResults(found);
          setActive(0);
        }
      } catch {
        if (id === requestId.current) setResults([]);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [query]);

  // Close on outside click.
  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Cmd/Ctrl-K focuses the field.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = results[active];
      if (target) {
        setOpen(false);
        setQuery("");
        router.push(target.href);
      }
    }
  }

  const showPanel = open && query.trim().length >= 2;

  return (
    <div ref={containerRef} className="relative hidden w-full max-w-sm sm:block">
      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search leads, projects, partners…"
          aria-label="Search"
          aria-expanded={showPanel}
          role="combobox"
          aria-controls="global-search-results"
          className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-9 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {loading ? (
          <Loader2 className="absolute right-3 h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <kbd className="absolute right-2 hidden rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground md:block">
            ⌘K
          </kbd>
        )}
      </div>

      {showPanel ? (
        <div
          id="global-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-11 z-50 overflow-hidden rounded-md border border-border bg-card shadow-lg"
        >
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {loading ? "Searching…" : `No matches for “${query.trim()}”`}
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {results.map((r, i) => {
                const Icon = ICONS[r.kind];
                return (
                  <li key={`${r.kind}-${r.id}`}>
                    <Link
                      href={r.href}
                      role="option"
                      aria-selected={i === active}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => {
                        setOpen(false);
                        setQuery("");
                      }}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 text-sm",
                        i === active ? "bg-muted" : "hover:bg-muted/60",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{r.title}</span>
                        {r.subtitle ? (
                          <span className="block truncate text-xs text-muted-foreground">
                            {r.subtitle}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {KIND_LABEL[r.kind]}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
