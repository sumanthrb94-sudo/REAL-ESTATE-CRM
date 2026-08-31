import { cn } from "@/lib/utils";

/**
 * Placeholder block for content that has not arrived yet.
 *
 * The pulse is deliberately the only animation: `motion-safe` keeps it off for
 * anyone who has asked their system to reduce motion.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("motion-safe:animate-pulse rounded-md bg-muted", className)} {...props} />;
}
