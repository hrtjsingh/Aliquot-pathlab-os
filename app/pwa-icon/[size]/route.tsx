import { ImageResponse } from "next/og";
import { PwaIconMarkup } from "@/lib/pwa-icon-markup";

export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const px = Number(size) === 512 ? 512 : 192;
  return new ImageResponse(<PwaIconMarkup />, { width: px, height: px });
}
