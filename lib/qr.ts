import QRCode from "qrcode";

export async function qrPngDataUrl(text: string) {
  return QRCode.toDataURL(text, {
    margin: 1,
    width: 192,
    errorCorrectionLevel: "M",
    color: { dark: "#14181c", light: "#ffffff" },
  });
}
