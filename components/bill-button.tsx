"use client";

import { Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openBillPopup } from "@/lib/open-bill-popup";

export function BillButton({
  orderId,
  size = "sm",
  variant = "ghost",
}: {
  orderId: string;
  size?: "sm" | "default";
  variant?: "ghost" | "outline" | "default";
}) {
  return (
    <Button type="button" size={size} variant={variant} onClick={() => openBillPopup(orderId)}>
      <Receipt />
      Bill
    </Button>
  );
}
