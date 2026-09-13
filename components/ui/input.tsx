import * as React from "react";
import { cn } from "@/lib/utils";

type NumericMode = "int" | "decimal";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  /** Text input that only accepts digits, or digits and one decimal point. Blank is allowed. */
  numeric?: NumericMode;
};

function sanitizeNumeric(value: string, mode: NumericMode) {
  if (mode === "int") return value.replace(/\D/g, "");
  if (value === "-" || value === "." || value === "-.") return value;
  const negative = value.startsWith("-");
  const body = (negative ? value.slice(1) : value).replace(/[^\d.]/g, "");
  const dot = body.indexOf(".");
  const next = dot === -1 ? body : `${body.slice(0, dot + 1)}${body.slice(dot + 1).replace(/\./g, "")}`;
  return `${negative ? "-" : ""}${next}`;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, numeric, onChange, inputMode, autoComplete, ...props }, ref) => {
    function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
      if (numeric) {
        const next = sanitizeNumeric(event.target.value, numeric);
        if (next !== event.target.value) event.target.value = next;
      }
      onChange?.(event);
    }

    return (
      <input
        {...props}
        type={numeric ? "text" : type}
        ref={ref}
        inputMode={numeric ? (numeric === "decimal" ? "decimal" : "numeric") : inputMode}
        autoComplete={numeric ? "off" : autoComplete}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        onChange={handleChange}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
