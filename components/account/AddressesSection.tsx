"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import AddressForm from "@/components/account/AddressForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { deleteAddressAction, setDefaultAddressAction } from "@/lib/actions/addresses";
import { es } from "@/lib/i18n/es";
import type { Database } from "@/lib/supabase/database.types";

type AddressRow = Database["public"]["Tables"]["addresses"]["Row"];

export default function AddressesSection({ addresses }: { addresses: AddressRow[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) toast.error(result.message);
      else if (result.message) toast.success(result.message);
    });
  }

  return (
    <div className="grid gap-4">
      {addresses.length === 0 ? <p className="text-sm text-muted-foreground">{es.account.addressesEmpty}</p> : null}

      <ul className="grid gap-3">
        {addresses.map((address) => (
          <li key={address.id} className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium">{address.label || address.recipient_name}</span>
              {address.is_default ? <Badge variant="secondary">{es.account.defaultAddress}</Badge> : null}
            </div>
            <p className="text-muted-foreground">
              {address.street} {address.exterior_number}
              {address.interior_number ? ` int. ${address.interior_number}` : ""}, {address.neighborhood},{" "}
              {address.municipality}, {address.state}, C.P. {address.postal_code}
            </p>
            <div className="flex gap-2">
              {!address.is_default ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => run(() => setDefaultAddressAction(address.id))}
                >
                  {es.account.makeDefault}
                </Button>
              ) : null}
              <Button
                variant="destructive"
                size="sm"
                disabled={pending}
                onClick={() => run(() => deleteAddressAction(address.id))}
              >
                <Trash2 />
                {es.account.delete}
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button variant="outline" className="justify-self-start" />}>
          <Plus />
          {es.account.addAddress}
        </DialogTrigger>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{es.account.addAddress}</DialogTitle>
          </DialogHeader>
          <AddressForm onSaved={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
