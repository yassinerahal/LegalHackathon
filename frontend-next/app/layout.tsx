import type { Metadata } from "next";
import Script from "next/script";
import { AuthProvider } from "@/context/AuthContext";
import { NavigationBar } from "@/components/NavigationBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "NextAct",
  description: "Next.js client for the NextAct legal platform"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <div className="min-h-screen">
            <NavigationBar />
            <main className="container">{children}</main>
          </div>
        </AuthProvider>
        <Script id="gtranslate-settings" strategy="afterInteractive">
          {`
            window.gtranslateSettings = {
              default_language: "en",
              languages: ["en", "de"],
              wrapper_selector: ".gtranslate_wrapper",
              flag_style: "2d",
              alt_flags: { en: "usa" }
            };
          `}
        </Script>
        <Script src="https://cdn.gtranslate.net/widgets/latest/dropdown.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
