"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { PickedCard } from "@/components/listings/CardPicker";
import ScanReviewRow from "@/components/scan/ScanReviewRow";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { createListingsFromScanAction } from "@/lib/actions/scan";
import { es } from "@/lib/i18n/es";
import { formatMXN } from "@/lib/money";
import { analyzePage, ScanError, type ReviewCard } from "@/lib/scan/client-pipeline";
import { marketPesos, suggestedPesos } from "@/lib/scan/pricing";
import type { ScanPrintOption } from "@/lib/scan/types";
import { CONDITIONS } from "@/lib/schemas/listing";

const MAX_PAGES = 12;
const CONCURRENCY = 3;
const PERCENT_CHOICES = [110, 100, 90, 80, 70, 60, 50];

type Step = "upload" | "processing" | "review" | "confirm";
type PageState = { status: "queued" | "detecting" | "identifying" | "done" | "error"; count?: number; error?: ScanError["code"] };
type PhotoFile = { id: string; file: File; previewUrl: string };

export default function ScanFlow({ phoneVerified, listedPrintIds }: { phoneVerified: boolean; listedPrintIds: string[] }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [photos, setPhotos] = useState<PhotoFile[]>([]);
  const [pages, setPages] = useState<Record<string, PageState>>({});
  const [cards, setCards] = useState<ReviewCard[]>([]);
  const [usdMxnRate, setUsdMxnRate] = useState(18);
  const [percent, setPercent] = useState(100);
  const [onlyReview, setOnlyReview] = useState(false);
  const [publish, setPublish] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const listed = useMemo(() => new Set(listedPrintIds), [listedPrintIds]);

  // Object URLs are released when the page unmounts.
  const urlsRef = useRef<string[]>([]);
  useEffect(() => {
    const urls = urlsRef.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...list]
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, Math.max(0, MAX_PAGES - photos.length))
      .map((file) => {
        const previewUrl = URL.createObjectURL(file);
        urlsRef.current.push(previewUrl);
        return { id: crypto.randomUUID(), file, previewUrl };
      });
    setPhotos((current) => [...current, ...next]);
  }

  const setPage = (id: string, patch: PageState) => setPages((current) => ({ ...current, [id]: patch }));

  async function processPhoto(photo: PhotoFile) {
    setPage(photo.id, { status: "detecting" });
    try {
      const result = await analyzePage(photo.file, photo.id, (stage) => setPage(photo.id, { status: stage }));
      result.cards.forEach((card) => urlsRef.current.push(card.cropUrl));
      setCards((current) => [...current.filter((card) => card.pageId !== photo.id), ...result.cards]);
      if (result.usdMxnRate) setUsdMxnRate(result.usdMxnRate);
      setPage(photo.id, { status: "done", count: result.cards.length });
      return true;
    } catch (error) {
      setPage(photo.id, { status: "error", error: error instanceof ScanError ? error.code : "failed" });
      return false;
    }
  }

  async function run(queueItems: PhotoFile[]) {
    const queue = [...queueItems];
    let failures = 0;
    const worker = async () => {
      for (let photo = queue.shift(); photo; photo = queue.shift()) {
        if (!(await processPhoto(photo))) failures++;
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queueItems.length) }, worker));
    return failures;
  }

  async function startScan() {
    setPages(Object.fromEntries(photos.map((photo) => [photo.id, { status: "queued" } as PageState])));
    setStep("processing");
    const failures = await run(photos);
    if (failures === 0) setStep("review");
  }

  const settled = photos.length > 0 && photos.every((p) => pages[p.id]?.status === "done" || pages[p.id]?.status === "error");

  const updateCard = (id: string, patch: Partial<ReviewCard>) =>
    setCards((current) => current.map((card) => (card.id === id ? { ...card, ...patch } : card)));

  function pickCard(id: string, picked: PickedCard) {
    const option: ScanPrintOption = {
      printId: picked.id,
      slug: picked.id,
      code: picked.code,
      name: picked.name,
      variantLabel: picked.variantLabel,
      isDefault: false,
      imageUrl: picked.imageUrl,
      marketUsdCents: { normal: null, foil: null },
    };
    setCards((current) =>
      current.map((card) =>
        card.id === id
          ? {
              ...card,
              options: card.options.some((o) => o.printId === picked.id) ? card.options : [...card.options, option],
              printId: picked.id,
              include: true,
            }
          : card,
      ),
    );
  }

  const optionOf = (card: ReviewCard) => card.options.find((option) => option.printId === card.printId);
  const priceOf = (card: ReviewCard) =>
    card.priceOverride ?? suggestedPesos(optionOf(card), card.finish, usdMxnRate, percent);

  const included = cards.filter((card) => card.include && card.printId);
  const reviewCount = cards.filter((card) => card.status !== "matched").length;
  const visible = onlyReview ? cards.filter((card) => card.status !== "matched") : cards;
  const pendingMatched = cards.filter((card) => card.status === "matched" && card.printId && !card.include);
  const missingPrice = included.some((card) => priceOf(card) === null);

  // Identical copies (same print, condition, finish, language and price) become one listing with a quantity.
  const finalItems = useMemo(() => {
    const merged = new Map<string, { printId: string; condition: ReviewCard["condition"]; language: ReviewCard["language"]; finish: ReviewCard["finish"]; quantity: number; price: number }>();
    for (const card of cards) {
      if (!card.include || !card.printId) continue;
      const option = card.options.find((o) => o.printId === card.printId);
      const price = card.priceOverride ?? suggestedPesos(option, card.finish, usdMxnRate, percent);
      if (price === null) continue;
      const key = [card.printId, card.condition, card.finish, card.language, price].join("|");
      const existing = merged.get(key);
      if (existing) existing.quantity = Math.min(999, existing.quantity + card.quantity);
      else merged.set(key, { printId: card.printId, condition: card.condition, language: card.language, finish: card.finish, quantity: card.quantity, price });
    }
    return [...merged.values()];
  }, [cards, percent, usdMxnRate]);

  const totalValue = finalItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  async function submit() {
    setSubmitting(true);
    const corrected = included.filter((card) => optionOf(card)?.code !== card.suggestedCode).length;
    const result = await createListingsFromScanAction({
      items: finalItems,
      publish: publish && phoneVerified,
      corrected,
    });
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    router.push("/sell");
    router.refresh();
  }

  if (step === "upload") {
    return (
      <div className="grid gap-5">
        <section className="grid gap-2 rounded-xl border bg-muted/40 p-4">
          <h2 className="text-sm font-medium">{es.scan.tipsTitle}</h2>
          <ul className="grid list-disc gap-1 pl-5 text-sm text-muted-foreground">
            {es.scan.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </section>

        <div className="flex flex-wrap gap-2">
          <label className="inline-flex h-9 cursor-pointer items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/80">
            {es.scan.takePhoto}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
          <label className="inline-flex h-9 cursor-pointer items-center rounded-lg border bg-background px-4 text-sm font-medium hover:bg-muted">
            {es.scan.choosePhotos}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              multiple
              className="sr-only"
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
        </div>

        {photos.length > 0 ? (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {photos.map((photo) => (
              <li key={photo.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.previewUrl} alt="" className="aspect-[3/4] w-full rounded-lg object-cover" />
                <button
                  type="button"
                  aria-label={es.scan.removePhoto}
                  onClick={() => setPhotos((current) => current.filter((p) => p.id !== photo.id))}
                  className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-background/90 text-xs shadow"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="grid gap-2">
          <Button type="button" disabled={photos.length === 0} onClick={startScan}>
            {es.scan.start} ({es.scan.photosCount(photos.length)})
          </Button>
          <p className="text-xs text-muted-foreground">{es.scan.privacy}</p>
        </div>
      </div>
    );
  }

  if (step === "processing") {
    const labels: Record<PageState["status"], string> = {
      queued: es.scan.pageQueued,
      detecting: es.scan.pageDetecting,
      identifying: es.scan.pageIdentifying,
      done: "",
      error: es.scan.pageError,
    };
    return (
      <div className="grid gap-4">
        <h2 className="text-lg font-medium">{es.scan.processing}</h2>
        <ul className="grid divide-y rounded-xl border">
          {photos.map((photo, index) => {
            const state = pages[photo.id] ?? { status: "queued" as const };
            return (
              <li key={photo.id} className="flex items-center gap-3 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.previewUrl} alt="" className="h-14 w-10 rounded object-cover" />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium">{`#${index + 1}`}</p>
                  <p className="text-muted-foreground" aria-live="polite">
                    {state.status === "done"
                      ? state.count === 0
                        ? es.scan.noCards
                        : es.scan.pageDone(state.count ?? 0)
                      : state.error === "daily_limit"
                        ? es.scan.dailyLimit
                        : state.error === "invalid_image"
                          ? es.scan.errors.invalidImage
                          : labels[state.status]}
                  </p>
                </div>
                {state.status === "error" && state.error !== "daily_limit" ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => processPhoto(photo)}>
                    {es.scan.retry}
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
        {settled ? (
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep("upload")}>
              {es.scan.back}
            </Button>
            <Button type="button" disabled={cards.length === 0} onClick={() => setStep("review")}>
              {es.scan.continue}
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  if (step === "review") {
    return (
      <div className="grid gap-4">
        <header className="grid gap-1">
          <h2 className="text-lg font-medium">{es.scan.reviewTitle}</h2>
          <p className="text-sm text-muted-foreground">{es.scan.reviewSummary(cards.length, reviewCount)}</p>
        </header>

        <section className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="grid gap-1">
            <label htmlFor="bulk-condition" className="text-xs text-muted-foreground">
              {es.scan.bulkTitle}: {es.scan.bulkCondition}
            </label>
            <NativeSelect
              id="bulk-condition"
              value=""
              onChange={(event) => {
                const condition = event.target.value as ReviewCard["condition"];
                if (condition) setCards((current) => current.map((card) => (card.include ? { ...card, condition } : card)));
              }}
            >
              <option value="">—</option>
              {CONDITIONS.map((value) => (
                <option key={value} value={value}>
                  {es.listing.conditions[value]}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1">
            <label htmlFor="bulk-percent" className="text-xs text-muted-foreground">
              {es.scan.bulkPrice}
            </label>
            <NativeSelect id="bulk-percent" value={percent} onChange={(event) => setPercent(Number(event.target.value))}>
              {PERCENT_CHOICES.map((value) => (
                <option key={value} value={value}>
                  {value}%
                </option>
              ))}
            </NativeSelect>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setCards((current) => current.map((card) => ({ ...card, priceOverride: null })))}
          >
            {es.scan.resetPrices}
          </Button>
        </section>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-primary" checked={onlyReview} onChange={(e) => setOnlyReview(e.target.checked)} />
          {es.scan.onlyReview}
        </label>

        {pendingMatched.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setCards((current) => current.map((card) => (card.status === "matched" && card.printId ? { ...card, include: true } : card)))}
          >
            {es.scan.confirmMatched(pendingMatched.length)}
          </Button>
        ) : null}

        <ul className="grid gap-3">
          {visible.map((card) => (
            <ScanReviewRow
              key={card.id}
              card={card}
              suggestedPrice={suggestedPesos(optionOf(card), card.finish, usdMxnRate, percent)}
              marketPrice={marketPesos(optionOf(card), card.finish, usdMxnRate)}
              artMarket={(option) => marketPesos(option, card.finish, usdMxnRate)}
              alreadyListed={card.printId ? listed.has(card.printId) : false}
              onChange={(patch) => updateCard(card.id, patch)}
              onPickCard={(picked) => pickCard(card.id, picked)}
            />
          ))}
        </ul>

        <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur">
          <p className="text-sm" aria-live="polite">
            {missingPrice ? es.scan.errors.missingPrice : es.scan.confirmSummary(included.length, finalItems.length)}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep("upload")}>
              {es.scan.back}
            </Button>
            <Button type="button" disabled={finalItems.length === 0 || missingPrice} onClick={() => setStep("confirm")}>
              {es.scan.continue}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <header className="grid gap-1">
        <h2 className="text-lg font-medium">{es.scan.confirmTitle}</h2>
        <p className="text-sm">{es.scan.confirmSummary(included.length, finalItems.length)}</p>
        <p className="text-sm text-muted-foreground">{es.scan.totalValue(formatMXN(totalValue * 100))}</p>
      </header>

      <fieldset className="grid gap-2">
        <label className="flex items-start gap-2 rounded-lg border p-3 text-sm">
          <input type="radio" name="mode" className="mt-0.5 accent-primary" checked={!publish} onChange={() => setPublish(false)} />
          <span>
            <span className="font-medium">{es.scan.modeDraft}</span>
            <span className="block text-muted-foreground">{es.scan.modeDraftHint}</span>
          </span>
        </label>
        <label className="flex items-start gap-2 rounded-lg border p-3 text-sm aria-disabled:opacity-60" aria-disabled={!phoneVerified}>
          <input
            type="radio"
            name="mode"
            className="mt-0.5 accent-primary"
            checked={publish}
            disabled={!phoneVerified}
            onChange={() => setPublish(true)}
          />
          <span>
            <span className="font-medium">{es.scan.modePublish}</span>
            <span className="block text-muted-foreground">{es.scan.modePublishHint}</span>
          </span>
        </label>
        {phoneVerified ? null : (
          <p className="text-xs text-muted-foreground">
            {es.scan.phoneRequired}{" "}
            <Link href="/account" className="underline">
              {es.nav.account}
            </Link>
          </p>
        )}
      </fieldset>

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={() => setStep("review")} disabled={submitting}>
          {es.scan.back}
        </Button>
        <Button type="button" onClick={submit} disabled={submitting || finalItems.length === 0}>
          {submitting ? es.scan.creating : es.scan.create}
        </Button>
      </div>
    </div>
  );
}
