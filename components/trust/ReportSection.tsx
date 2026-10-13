import Link from "next/link";

import ReportForm from "@/components/trust/ReportForm";
import { getCurrentUser } from "@/lib/auth-guard";
import { es } from "@/lib/i18n/es";

type Props = {
  targetType: "listing" | "user";
  targetId: string;
  // The user who would be reported (hidden for their own content).
  ownerId: string;
  // Where to send logged-out visitors back to.
  returnTo: string;
};

// Reads the session; render inside <Suspense> on cached pages.
export default async function ReportSection({ targetType, targetId, ownerId, returnTo }: Props) {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <Link href={`/login?next=${encodeURIComponent(returnTo)}`} className="text-sm text-muted-foreground hover:text-foreground">
        {es.trust.reports.loginToReport}
      </Link>
    );
  }
  if (user.id === ownerId) return null;
  return <ReportForm targetType={targetType} targetId={targetId} />;
}
