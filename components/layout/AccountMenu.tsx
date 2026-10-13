"use client";

import { Heart, LogOut, Package, Store, User } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { signOutAction } from "@/lib/actions/auth";
import { avatarInitials } from "@/lib/avatar";
import { es } from "@/lib/i18n/es";

type Props = { username: string; displayName: string | null; avatarUrl: string | null };

const itemClass = "flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-muted";

export default function AccountMenu({ username, displayName, avatarUrl }: Props) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        title={es.nav.account}
        aria-label={es.nav.accountMenu}
        className="ml-1 cursor-pointer rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Avatar>
          {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
          <AvatarFallback>{avatarInitials(displayName, username)}</AvatarFallback>
        </Avatar>
      </PopoverTrigger>
      <PopoverContent className="w-60">
        <div className="border-b px-3 py-2">
          <p className="truncate font-medium">{displayName ?? username}</p>
          <p className="truncate text-xs text-muted-foreground">@{username}</p>
        </div>
        <nav className="grid py-1">
          <Link href="/account" onClick={close} className={itemClass}>
            <User className="size-4" aria-hidden />
            {es.nav.account}
          </Link>
          <Link href={`/sellers/${encodeURIComponent(username)}`} onClick={close} className={itemClass}>
            <Store className="size-4" aria-hidden />
            {es.nav.collection}
          </Link>
          <Link href="/wishlist" onClick={close} className={itemClass}>
            <Heart className="size-4" aria-hidden />
            {es.nav.wishlist}
          </Link>
          <Link href="/orders" onClick={close} className={itemClass}>
            <Package className="size-4" aria-hidden />
            {es.nav.orders}
          </Link>
        </nav>
        <form action={signOutAction} className="border-t py-1">
          <button type="submit" className={itemClass}>
            <LogOut className="size-4" aria-hidden />
            {es.nav.logout}
          </button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
