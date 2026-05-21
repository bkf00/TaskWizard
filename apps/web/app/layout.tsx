import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Taskuri AI",
  description: "Taskuri propuse din Teams si emailuri"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ro">
      <body>{children}</body>
    </html>
  );
}

