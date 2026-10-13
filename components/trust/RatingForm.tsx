"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { submitRatingAction } from "@/lib/actions/ratings";
import { es } from "@/lib/i18n/es";

export default function RatingForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await submitRatingAction(orderId, { stars, comment });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-xl border p-4">
      <h2 className="font-medium">{es.trust.ratings.rateTitle}</h2>
      <Field id={`stars-${orderId}`} label={es.trust.ratings.stars}>
        <NativeSelect id={`stars-${orderId}`} value={stars} onChange={(event) => setStars(Number(event.target.value))}>
          {[5, 4, 3, 2, 1].map((value) => (
            <option key={value} value={value}>
              {"★".repeat(value)} {es.trust.ratings.starsOption(value)}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field id={`comment-${orderId}`} label={es.trust.ratings.comment}>
        <Textarea id={`comment-${orderId}`} value={comment} maxLength={500} rows={3} onChange={(event) => setComment(event.target.value)} />
      </Field>
      <div>
        <Button type="submit" disabled={pending}>
          {es.trust.ratings.submit}
        </Button>
      </div>
    </form>
  );
}
