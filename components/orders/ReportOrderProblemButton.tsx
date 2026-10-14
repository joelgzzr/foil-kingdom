"use client";

import OrderReasonDialog from "@/components/orders/OrderReasonDialog";
import { reportOrderProblemAction } from "@/lib/actions/reports";
import { es } from "@/lib/i18n/es";

export default function ReportOrderProblemButton({ orderId }: { orderId: string }) {
  return (
    <OrderReasonDialog
      trigger={es.orders.problem.open}
      triggerVariant="outline"
      title={es.orders.problem.title}
      description={es.orders.problem.description}
      fieldLabel={es.orders.problem.details}
      placeholder={es.orders.problem.detailsPlaceholder}
      submitLabel={es.orders.problem.submit}
      requiredMessage={es.orders.problem.detailsRequired}
      minLength={10}
      maxLength={1000}
      onSubmit={(details) => reportOrderProblemAction(orderId, { details })}
    />
  );
}
