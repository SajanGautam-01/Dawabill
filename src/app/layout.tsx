import type { Metadata } from "next";
import InstallPrompt from "@/components/ui/InstallPrompt";
import GlobalSubscriptionGuard from "@/components/shared/GlobalSubscriptionGuard";
import "./globals.css";
import { ConnectivityMonitor } from "@/components/shared/ConnectivityMonitor";
import { ClientLayout } from "@/components/shared/ClientLayout";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "DawaBill - SaaS for Medical Stores",
  description: "Production-ready multi-tenant SaaS application for medical stores in India.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#2563eb" />
      </head>
      <body className="antialiased font-sans min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 relative">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <ConnectivityMonitor />
          <GlobalSubscriptionGuard>
            <ClientLayout>{children}</ClientLayout>
          </GlobalSubscriptionGuard>
          <InstallPrompt />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator && window.location.hostname !== 'localhost') {
                window.addEventListener('load', function() {
                  const isAuth = window.location.pathname.startsWith('/auth');
                  if (!isAuth) {
                    navigator.serviceWorker.register('/sw.js').then(function(registration) {
                      console.log('ServiceWorker registration successful');
                    }, function(err) {
                      console.log('ServiceWorker registration failed: ', err);
                    });
                  } else {
                    console.log('SW registration skipped for auth routes');
                  }
                });
              }
            `,
          }}
        />
        </ThemeProvider>
      </body>
    </html>
  );
}
