import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { parseTheme, resolvedFromPreference } from "@/lib/theme";
import { cn } from "@/lib/utils";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: "Aliquot",
  title: {
    default: "Aliquot",
    template: "%s · Aliquot",
  },
  description: "Generate, authorize, and release diagnostic lab reports.",
  appleWebApp: {
    capable: true,
    title: "Aliquot",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1C3F52",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const jar = await cookies();
  const theme = parseTheme(jar.get("aliquot-theme")?.value);
  const resolvedTheme = resolvedFromPreference(theme, jar.get("aliquot-theme-resolved")?.value);

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(geistSans.variable, geistMono.variable, "h-full antialiased", resolvedTheme)}
      style={{ colorScheme: resolvedTheme }}
    >
      <body className="min-h-full flex flex-col">
        <Providers theme={theme} resolvedTheme={resolvedTheme}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
