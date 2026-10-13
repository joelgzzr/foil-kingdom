import { ImageResponse } from "next/og";

import { getSellerCollectionStats } from "@/lib/data/listings";
import { getSellerProfile } from "@/lib/data/trust";
import { es } from "@/lib/i18n/es";

export const alt = es.brand.name;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Preview card shown when a seller shares their collection link (WhatsApp, Facebook, Discord).
export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const seller = await getSellerProfile(decodeURIComponent(username));
  const stats = seller ? await getSellerCollectionStats(seller.profile.id) : null;
  const name = seller ? (seller.profile.display_name ?? seller.profile.username) : es.brand.name;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
          color: "white",
        }}
      >
        <div style={{ fontSize: 36, opacity: 0.8 }}>{es.brand.name}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.1 }}>{name}</div>
          <div style={{ fontSize: 40, opacity: 0.9 }}>{es.collection.forSale}</div>
        </div>
        <div style={{ display: "flex", gap: 32, fontSize: 36 }}>
          {stats ? <div>{es.collection.stats.listings(stats.listingCount)}</div> : null}
          {stats ? <div>{es.collection.stats.copies(stats.totalCopies)}</div> : null}
          {seller && seller.profile.rating_count > 0 ? <div>{`★ ${Number(seller.profile.rating_avg).toFixed(1)}`}</div> : null}
        </div>
      </div>
    ),
    size,
  );
}
