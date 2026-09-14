import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "flex h-9 w-full rounded-md border border-stone-300 bg-white px-3 text-sm shadow-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("text-xs font-medium text-stone-700", className)} {...props} />;
}
