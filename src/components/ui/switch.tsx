"use client";

import * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default";
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 cursor-pointer items-center rounded-full border border-border/70 shadow-xs transition-[background-color,border-color,box-shadow] outline-none after:absolute after:-inset-x-2 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[size=default]:h-7 data-[size=default]:w-12 data-[size=sm]:h-6 data-[size=sm]:w-10 data-[state=checked]:border-primary/70 data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted/80 data-disabled:cursor-not-allowed data-disabled:opacity-50 dark:border-border/60 dark:data-[state=unchecked]:bg-muted/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}>
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block rounded-full border border-black/5 bg-white shadow-sm ring-0 transition-transform duration-200 group-data-[size=default]/switch:size-5 group-data-[size=sm]/switch:size-4 group-data-[size=default]/switch:translate-x-1 group-data-[size=sm]/switch:translate-x-1 group-data-[size=default]/switch:group-data-[state=checked]/switch:translate-x-6 group-data-[size=sm]/switch:group-data-[state=checked]/switch:translate-x-5 dark:border-white/10 dark:bg-zinc-950 dark:group-data-[state=checked]/switch:bg-white"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
