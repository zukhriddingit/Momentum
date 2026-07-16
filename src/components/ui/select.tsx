import * as React from "react";

import { cn } from "@/lib/utils";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.ComponentProps<"select">
>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm transition-shadow outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 disabled:opacity-50",
      className,
    )}
    {...props}
  />
));

Select.displayName = "Select";
