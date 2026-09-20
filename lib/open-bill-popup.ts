const BILL_WIDTH = 680;
const BILL_HEIGHT = 900;

function billFeatures(): string {
  const left = Math.max(0, Math.round((window.screen.availWidth - BILL_WIDTH) / 2));
  const top = Math.max(0, Math.round((window.screen.availHeight - BILL_HEIGHT) / 2));
  return `popup=yes,width=${BILL_WIDTH},height=${BILL_HEIGHT},left=${left},top=${top},scrollbars=yes,resizable=yes`;
}

export function billUrl(orderId: string): string {
  return `/api/orders/${orderId}/bill`;
}

export function openBillPopup(orderId: string) {
  const popup = window.open(billUrl(orderId), `bill-${orderId}`, billFeatures());
  popup?.focus();
  return popup;
}

/** Open blank popup during the click, then point it at the bill after create. Avoids popup blockers. */
export function openBillPopupPlaceholder() {
  return window.open("about:blank", "aliquot-bill", billFeatures());
}

export function showBillInPopup(popup: Window | null, orderId: string) {
  if (!popup || popup.closed) {
    openBillPopup(orderId);
    return;
  }
  popup.location.href = billUrl(orderId);
  popup.focus();
}
