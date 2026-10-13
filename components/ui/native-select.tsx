import type { ComponentProps } from "react";
import { cn } from "cn";

// Native select keeps the OS picker on mobile and works directly with React Hook Form's register().
export function NativeSelect({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
