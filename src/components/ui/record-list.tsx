import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * A row in the phone-width alternative to a data table.
 *
 * Tables carry their column semantics in a header the reader can no longer see
 * once a row wraps, which is what made these screens unreadable on a phone:
 * names broke over two lines, phone numbers over three, and trailing columns
 * were clipped mid-word. A list drops the grid and gives each record a shape
 * of its own — identity first, state to the right, supporting detail beneath.
 */
export interface RecordListItem {
  id: string;
  /** Makes the whole row tappable. */
  href?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Status chips, stacked at the top right. */
  badges?: React.ReactNode;
  /** Supporting values, rendered dot-separated. Falsy entries are dropped. */
  meta?: React.ReactNode[];
  /** Controls for the record, given their own row so they stay tappable. */
  actions?: React.ReactNode;
}

export function RecordList({
  items,
  className,
}: {
  items: RecordListItem[];
  className?: string;
}) {
  return (
    <ul className={cn("divide-y divide-border", className)}>
      {items.map((item) => {
        const body = (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-medium">{item.title}</div>
                {item.subtitle ? (
                  <div className="mt-0.5 text-xs text-muted-foreground">{item.subtitle}</div>
                ) : null}
              </div>
              {item.badges ? (
                <div className="flex shrink-0 flex-col items-end gap-1">{item.badges}</div>
              ) : null}
            </div>
            {item.meta?.some(Boolean) ? (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {item.meta.filter(Boolean).map((m, i) => (
                  <span key={i} className="inline-flex items-center gap-3">
                    {i > 0 ? <span aria-hidden>·</span> : null}
                    {m}
                  </span>
                ))}
              </div>
            ) : null}
          </>
        );

        return (
          <li key={item.id} className="py-3">
            {item.href ? (
              <Link href={item.href} className="block active:bg-muted/50">
                {body}
              </Link>
            ) : (
              body
            )}
            {item.actions ? <div className="mt-2.5">{item.actions}</div> : null}
          </li>
        );
      })}
    </ul>
  );
}

/** Table for wider screens, RecordList for phones. */
export function ResponsiveRecords({
  items,
  children,
}: {
  items: RecordListItem[];
  children: React.ReactNode;
}) {
  return (
    <>
      <RecordList items={items} className="sm:hidden" />
      <div className="hidden sm:block">{children}</div>
    </>
  );
}
