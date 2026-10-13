import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";

type FieldProps = {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
};

// Label + control + hint/error wrapper for React Hook Form inputs.
export function Field({ id, label, error, hint, children }: FieldProps) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
