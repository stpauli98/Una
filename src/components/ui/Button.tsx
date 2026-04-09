import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "gold" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-rose text-white hover:bg-rose-hover focus-visible:outline-rose",
  gold: "bg-gold text-white hover:bg-[#A17E47] focus-visible:outline-gold",
  ghost: "bg-transparent text-dark hover:bg-warm",
  outline:
    "bg-transparent text-white border border-white/40 hover:bg-white/10",
};

const sizeStyles: Record<Size, string> = {
  sm: "px-4 py-2 text-[10px]",
  md: "px-8 py-3.5 text-[11px]",
  lg: "px-10 py-4 text-xs",
};

const base =
  "inline-flex items-center justify-center gap-2 font-body font-medium uppercase tracking-[0.2em] transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";

type SharedProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
};

type ButtonProps = SharedProps & ComponentProps<"button">;
type LinkButtonProps = SharedProps & ComponentProps<typeof Link>;

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(base, variantStyles[variant], sizeStyles[size], className)}
      {...rest}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: LinkButtonProps) {
  return (
    <Link
      className={cn(base, variantStyles[variant], sizeStyles[size], className)}
      {...rest}
    >
      {children}
    </Link>
  );
}
