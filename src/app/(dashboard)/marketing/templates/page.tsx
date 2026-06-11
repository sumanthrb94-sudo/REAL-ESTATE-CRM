// EstateCRM — /marketing/templates: message template library.
// Templates grouped by channel with merge-tag chips, body previews and a
// live-preview editor (create/edit/delete) for marketing writers.

import { PageHeader } from "@/components/ui/misc";
import { TemplateLibrary } from "@/components/marketing/template-library";
import { can } from "@/server/auth/rbac";
import { getCurrentUser } from "@/server/auth/session";
import { listTemplates } from "@/server/modules/marketing";

export default async function TemplatesPage() {
  const [user, templates] = await Promise.all([getCurrentUser(), listTemplates()]);
  const canWrite = can(user.role, "marketing.write");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Message Templates"
        description="Reusable email, SMS and WhatsApp content with {{name}}, {{project}}, {{date}} and {{phone}} merge tags."
      />
      <TemplateLibrary templates={templates} canWrite={canWrite} />
    </div>
  );
}
