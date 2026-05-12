import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";

export const metadata: Metadata = {
  title: "Tangbao",
  description: "Traditional Chinese vocabulary learning with spaced repetition",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant" suppressHydrationWarning>
      <head>
        {/* Anti-flash: apply dark class before first paint */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            const t = localStorage.getItem('theme');
            const sys = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (t === 'dark' || (!t && sys)) document.documentElement.classList.add('dark');
          } catch(e) {}
        ` }} />
      </head>
      <body className="flex h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-hidden transition-colors duration-200">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </body>
    </html>
  );
}
