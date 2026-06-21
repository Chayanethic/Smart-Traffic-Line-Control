import { cn } from "@/lib/utils";

export function SignalOrb({ color, active, size = "md" }: { color: "red" | "yellow" | "green"; active: boolean; size?: "sm" | "md" | "lg" }) {
  return (
    <span className={cn(
      "block rounded-full border border-white/10 transition-all duration-300",
      size === "sm" && "h-3 w-3",
      size === "md" && "h-6 w-6",
      size === "lg" && "h-9 w-9",
      color === "red" && (active ? "signal-glow-red bg-rose-500" : "bg-rose-950/70"),
      color === "yellow" && (active ? "signal-glow-yellow bg-yellow-400" : "bg-yellow-950/70"),
      color === "green" && (active ? "signal-glow-green bg-primary" : "bg-teal-950/70"),
    )} />
  );
}
