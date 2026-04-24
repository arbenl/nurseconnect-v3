import "../styles/globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { Providers } from "@/components/providers";
import { ThemeProvider } from "@/components/theme-provider";
import { shouldEnableVercelClientTelemetry } from "@/lib/vercel-telemetry";

const enableVercelClientTelemetry = shouldEnableVercelClientTelemetry();

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <body className="min-h-screen bg-background text-foreground">
        <Providers>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        </Providers>
        {enableVercelClientTelemetry ? (
          <>
            <Analytics />
            <SpeedInsights />
          </>
        ) : null}
      </body>
    </html>
  );
}
