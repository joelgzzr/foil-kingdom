import Link from "next/link";

import AccountMenu from "@/components/layout/AccountMenu";
import NavActions from "@/components/layout/NavActions";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth-guard";
import { getNavProfile } from "@/lib/data/account";
import { getUnreadCounts } from "@/lib/data/messages";
import { es } from "@/lib/i18n/es";

export default async function UserNav() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <nav className="flex items-center gap-2">
        <Link href="/login" className={buttonVariants({ variant: "ghost" })}>
          {es.nav.login}
        </Link>
        <Link href="/signup" className={buttonVariants()}>
          {es.nav.signup}
        </Link>
      </nav>
    );
  }

  const [unread, profile] = await Promise.all([getUnreadCounts(user.id), getNavProfile(user.id)]);

  return (
    <nav className="flex items-center gap-0.5">
      <NavActions userId={user.id} initial={unread} />
      <AccountMenu
        username={profile?.username ?? "?"}
        displayName={profile?.display_name ?? null}
        avatarUrl={profile?.avatar_url ?? null}
      />
    </nav>
  );
}
