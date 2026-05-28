import "./globals.css";
import { Providers } from "./Providers";

export const metadata = {
  title: "OpenContrib | GSSoC Issue Finder",
  description: "The smartest way to discover open-source issues",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {/* Ye Providers ab error ko permanently rok dega */}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}