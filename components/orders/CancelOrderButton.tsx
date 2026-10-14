"use client";

import OrderReasonDialog from "@/components/orders/OrderReasonDialog";
import { cancelOrderAction } from "@/lib/actions/orders";
import { es } from "@/lib/i18n/es";

export default function CancelOrderButton({ orderId }: { orderId: string }) {
  return (
    <OrderReasonDialog
      trigger={es.orders.cancel}
      title={es.orders.cancelDialog.title}
      description={es.orders.cancelDialog.description}
      fieldLabel={es.orders.cancelDialog.reason}
      placeholder={es.orders.cancelDialog.reasonPlaceholder}
      submitLabel={es.orders.cancelDialog.confirm}
      requiredMessage={es.orders.cancelDialog.reasonRequired}
      minLength={5}
      maxLength={300}
      onSubmit={(reason) => cancelOrderAction(orderId, { reason })}
    />
  );
}
