import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/misc";
import { ImportWizard } from "@/components/leads/import-wizard";
import { requirePermission } from "@/server/auth/guard";

export const metadata = { title: "Import leads · EstateCRM" };

export default async function ImportLeadsPage() {
  // Importing creates leads, so this needs write access, not just lead.read.
  await requirePermission("lead.write");

  return (
    <div className="space-y-6">
      <Link
        href="/leads"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Leads
      </Link>

      <PageHeader
        title="Import leads"
        description="Bring in leads from Instagram, Meta Ads Manager, a portal export or a spreadsheet."
      />

      <ImportWizard />
    </div>
  );
}
