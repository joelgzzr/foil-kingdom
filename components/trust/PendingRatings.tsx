import RatingForm from "@/components/trust/RatingForm";
import { getPendingRatingOrderIds } from "@/lib/data/trust";

// Reads the session; render inside <Suspense>.
export default async function PendingRatings({ conversationId, userId }: { conversationId: string; userId: string }) {
  const orderIds = await getPendingRatingOrderIds(conversationId, userId);
  return (
    <>
      {orderIds.map((orderId) => (
        <RatingForm key={orderId} orderId={orderId} />
      ))}
    </>
  );
}
