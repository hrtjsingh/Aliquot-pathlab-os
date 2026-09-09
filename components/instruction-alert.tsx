import type { ReactNode } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

export function InstructionAlert({
  title,
  children,
  variant = "info",
  icon,
  className,
}: {
  title: string;
  children: ReactNode;
  variant?: "default" | "info" | "warning" | "destructive";
  icon?: ReactNode;
  className?: string;
}) {
  const defaultIcon =
    variant === "destructive" || variant === "warning" ? <AlertTriangle /> : <Info />;

  return (
    <Alert variant={variant} className={cn("flex items-center gap-2", className)}>
      {icon ?? defaultIcon}
      <div className="flex min-w-0 flex-col">
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{children}</AlertDescription>
      </div>
    </Alert>
  );
}
