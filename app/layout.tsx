import { Suspense } from "react";
import { AccountMenuSlot } from "@/components/AccountMenuSlot";
import { NavigationTracker } from "@/components/NavigationTracker";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/seo";
import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { Figtree, Geist, Geist_Mono } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import "./globals.css";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "h-full font-sans antialiased",
        geistSans.variable,
        geistMono.variable,
        figtree.variable,
      )}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <NuqsAdapter>
            <Suspense fallback={null}>
              <NavigationTracker />
            </Suspense>
            <main className="relative flex flex-1 flex-col">
              <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-end px-4 pt-4">
                <div className="pointer-events-auto">
                  <Suspense fallback={<div className="size-9" aria-hidden />}>
                    <AccountMenuSlot />
                  </Suspense>
                </div>
              </div>
              {children}
            </main>
            <Toaster richColors position="top-right" />
          </NuqsAdapter>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
