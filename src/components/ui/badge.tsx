import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "default",
  ...props
}: React.ComponentProps<"span"> & { tone?: "default" | "warn" | "good" | "sample" | "muted" }) {
  const tones = {
    default: "bg-emerald-50 text-emerald-900 border-emerald-200",
    warn: "bg-amber-50 text-amber-900 border-amber-200",
    good: "bg-lime-50 text-lime-900 border-lime-200",
    sample: "bg-violet-50 text-violet-900 border-violet-200",
    muted: "bg-stone-100 text-stone-600 border-stone-200",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
