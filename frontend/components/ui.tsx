import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Card = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("rounded-2xl border border-border bg-white shadow-[0_8px_30px_rgba(35,65,52,.06)]", className)} {...props} />
);

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" }>(
  ({ className, variant = "primary", ...props }, ref) => (
    <button ref={ref} className={cn(
      "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-50",
      variant === "primary" && "bg-primary text-white hover:bg-[#0f654c]",
      variant === "secondary" && "border border-border bg-white text-[#29483c] hover:bg-[#f0f5f2]",
      variant === "danger" && "bg-red-600 text-white hover:bg-red-700",
      variant === "ghost" && "text-muted hover:bg-[#e8efeb] hover:text-[#183c30]",
      className,
    )} {...props} />
  ),
);
Button.displayName = "Button";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn("h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-[#183c30] outline-none transition placeholder:text-[#95a49d] focus:border-primary focus:ring-2 focus:ring-primary/10", className)} {...props} />
));
Input.displayName = "Input";

export const Badge = ({ className, ...props }: HTMLAttributes<HTMLSpanElement>) => (
  <span className={cn("inline-flex items-center gap-1.5 rounded-full border border-border bg-[#f6f9f7] px-2.5 py-1 text-xs font-medium text-[#50645b]", className)} {...props} />
);

export function SectionTitle({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h1 className="text-2xl font-bold tracking-tight text-[#173b2f]">{title}</h1>{description && <p className="mt-1 text-sm text-muted">{description}</p>}</div>{action}</div>;
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cn("h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent", className)} aria-hidden />;
}

export function PageSkeleton() {
  return <div className="space-y-5" aria-label="Loading page"><div className="space-y-2"><div className="skeleton h-8 w-64 rounded-lg" /><div className="skeleton h-4 w-96 max-w-full rounded" /></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="skeleton h-28 rounded-2xl" />)}</div><div className="grid gap-5 xl:grid-cols-2"><div className="skeleton h-[430px] rounded-2xl" /><div className="skeleton h-[430px] rounded-2xl" /></div></div>;
}
