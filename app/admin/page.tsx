import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import AdminRowButton from "@/components/admin/AdminRowButton";
import CatalogRecordActions from "@/components/admin/CatalogRecordActions";
import ReportActions from "@/components/admin/ReportActions";
import { Badge } from "@/components/ui/badge";
import { requireModerator } from "@/lib/auth-guard";
import { getBannedUsers, getLabelFailedOrders, getOpenReports, getUnmatchedCatalogRecords } from "@/lib/data/admin";
import { es } from "@/lib/i18n/es";

export const metadata: Metadata = { title: es.admin.title, robots: { index: false } };

async function AdminDashboard() {
  await requireModerator();
  const [reports, banned, failedOrders, unmatched] = await Promise.all([
    getOpenReports(),
    getBannedUsers(),
    getLabelFailedOrders(),
    getUnmatchedCatalogRecords(),
  ]);

  return (
    <div className="grid gap-8">
      <section aria-labelledby="admin-reports" className="grid gap-3">
        <h2 id="admin-reports" className="font-medium">
          {es.admin.reports} ({reports.length})
        </h2>
        {reports.length === 0 ? <p className="text-sm text-muted-foreground">{es.admin.noReports}</p> : null}
        {reports.map((report) => (
          <article key={report.id} className="grid gap-2 rounded-xl border p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{es.admin.targets[report.target_type as "listing" | "user"]}</Badge>
              <Badge variant="outline">{es.trust.reports.reasons[report.reason as keyof typeof es.trust.reports.reasons]}</Badge>
              {report.target_type === "listing" ? (
                <Link href={`/listings/${report.target_id}`} className="font-medium underline">
                  {report.target_label}
                </Link>
              ) : (
                <Link href={`/sellers/${report.target_label}`} className="font-medium underline">
                  @{report.target_label}
                </Link>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {es.admin.reportedBy} @{report.reporter.username} · {new Date(report.created_at).toLocaleDateString("es-MX")}
            </p>
            {report.details ? <p className="whitespace-pre-line">{report.details}</p> : null}
            <ReportActions reportId={report.id} canRemoveListing={report.target_type === "listing"} />
          </article>
        ))}
      </section>

      <section aria-labelledby="admin-orders" className="grid gap-3">
        <h2 id="admin-orders" className="font-medium">
          {es.admin.labelFailed} ({failedOrders.length})
        </h2>
        {failedOrders.length === 0 ? <p className="text-sm text-muted-foreground">{es.admin.noLabelFailed}</p> : null}
        <ul className="grid divide-y rounded-xl border empty:hidden">
          {failedOrders.map((order) => (
            <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{order.listing_title}</p>
                <p className="truncate text-xs text-destructive">{order.label_error}</p>
              </div>
              <AdminRowButton kind="retry-label" id={order.id} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="admin-catalog" className="grid gap-3">
        <h2 id="admin-catalog" className="font-medium">
          {es.admin.catalog} ({unmatched.length})
        </h2>
        <p className="text-sm text-muted-foreground">{es.admin.catalogHint}</p>
        {unmatched.length === 0 ? <p className="text-sm text-muted-foreground">{es.admin.noCatalogUnmatched}</p> : null}
        <ul className="grid divide-y rounded-xl border empty:hidden">
          {unmatched.map((record) => (
            <li key={record.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{record.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {record.source} · {record.number ?? record.externalId}
                </p>
              </div>
              <CatalogRecordActions recordId={record.id} suggestedCode="" />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="admin-banned" className="grid gap-3">
        <h2 id="admin-banned" className="font-medium">
          {es.admin.banned} ({banned.length})
        </h2>
        {banned.length === 0 ? <p className="text-sm text-muted-foreground">{es.admin.noBanned}</p> : null}
        <ul className="grid divide-y rounded-xl border empty:hidden">
          {banned.map((user) => (
            <li key={user.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <span>@{user.username}</span>
              <AdminRowButton kind="unban" id={user.id} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function AdminPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">{es.admin.title}</h1>
      <Suspense fallback={<div className="h-48" aria-hidden />}>
        <AdminDashboard />
      </Suspense>
    </main>
  );
}
