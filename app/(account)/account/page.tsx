import type { Metadata } from "next";
import { Suspense } from "react";

import AddressesSection from "@/components/account/AddressesSection";
import AvatarUploader from "@/components/account/AvatarUploader";
import PhoneVerificationForm from "@/components/account/PhoneVerificationForm";
import ProfileForm from "@/components/account/ProfileForm";
import WhatsappForm from "@/components/account/WhatsappForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth-guard";
import { getAccountData } from "@/lib/data/account";
import { es } from "@/lib/i18n/es";
import { MX_STATES } from "@/lib/mx";

export const metadata: Metadata = { title: es.account.title };

async function AccountContent() {
  const user = await requireUser();
  const { profile, contact, addresses } = await getAccountData(user.id);

  const state = MX_STATES.find((s) => s === profile.state) ?? "";

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{es.account.profileTitle}</CardTitle>
          <CardDescription>
            @{profile.username} · {es.account.profileSubtitle}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <AvatarUploader
            userId={user.id}
            avatarUrl={profile.avatar_url}
            displayName={profile.display_name}
            username={profile.username}
          />
          <ProfileForm
            defaultValues={{
              displayName: profile.display_name ?? "",
              bio: profile.bio ?? "",
              state,
              city: profile.city ?? "",
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{es.account.phoneTitle}</CardTitle>
          <CardDescription>{es.account.phoneSubtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <PhoneVerificationForm verified={profile.phone_verified} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{es.account.whatsappTitle}</CardTitle>
          <CardDescription>{es.account.whatsappSubtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <WhatsappForm
            defaultValues={{
              number: (contact.whatsapp_number ?? "").replace(/^\+52/, ""),
              visible: contact.whatsapp_visible,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{es.account.addressesTitle}</CardTitle>
          <CardDescription>{es.account.addressesSubtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <AddressesSection addresses={addresses} />
        </CardContent>
      </Card>
    </div>
  );
}

export default function AccountPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">{es.account.title}</h1>
      <Suspense fallback={<div className="h-96" aria-hidden />}>
        <AccountContent />
      </Suspense>
    </main>
  );
}
