import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "TaskWizard",
  description: "Inbox de verificare pentru taskuri extrase din emailuri si minute",
  icons: {
    icon: [
      {
        url: "/assets/taskwizard-hat.png",
        type: "image/png"
      }
    ]
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ro">
      <body>{children}</body>
    </html>
  );
}
