import type { Metadata, Viewport } from "next";
import InstallPrompt from "@/components/ui/InstallPrompt";
import GlobalSubscriptionGuard from "@/components/shared/GlobalSubscriptionGuard";
import "./globals.css";
import { ConnectivityMonitor } from "@/components/shared/ConnectivityMonitor";
import { ClientLayout } from "@/components/shared/ClientLayout";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: "DawaBill | Smart Pharmacy POS",
  description: "Next-generation pharmacy billing and inventory management for Indian retail pharmacies.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "DawaBill",
  },
};

export const viewport: Viewport = {
  themeColor: "#10b981",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark selection:bg-emerald-500/30">
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
        {/* We use a high-end system font stack as a fallback for Satoshi until self-hosted */}
        <script src="https://checkout.razorpay.com/v1/checkout.js" async></script>
      </head>
      <body className="antialiased font-sans min-h-screen bg-background text-foreground transition-colors duration-500 overflow-x-hidden">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <ConnectivityMonitor />
          <Toaster>
            <GlobalSubscriptionGuard>
              <ClientLayout>{children}</ClientLayout>
            </GlobalSubscriptionGuard>
          </Toaster>
          <InstallPrompt />
        </ThemeProvider>
      </body>
    </html>
  );
}
