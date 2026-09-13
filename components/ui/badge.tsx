import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-150 shadow-2xs",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "border-sidebar-border bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/90",
        warning: "border-transparent bg-warning text-warning-foreground hover:bg-warning/90",
        success: "border-transparent bg-success text-success-foreground hover:bg-success/90",
        outline: "border-border/80 bg-background/50 text-foreground hover:bg-secondary/50",
        "soft-destructive": "border-destructive/25 bg-destructive/12 text-destructive dark:bg-destructive/20",
        "soft-warning": "border-warning/30 bg-warning/12 text-warning dark:bg-warning/20",
        "soft-success": "border-success/30 bg-success/12 text-success dark:bg-success/20",
        "soft-accent": "border-accent/30 bg-accent/12 text-accent dark:bg-accent/20",
        "soft-primary": "border-primary/25 bg-primary/10 text-primary dark:bg-primary/20",
        panic: "border-panic-border bg-panic-bg text-panic-text animate-pulse-subtle font-bold",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
