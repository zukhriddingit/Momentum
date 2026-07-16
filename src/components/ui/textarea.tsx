import * as React from "react";

import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-24 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm transition-shadow outline-none placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 disabled:opacity-50",
      className,
    )}
    {...props}
  />
));

Textarea.displayName = "Textarea";
