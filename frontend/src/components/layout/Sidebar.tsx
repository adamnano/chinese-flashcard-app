"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/import", label: "Import", icon: "↑" },
  { href: "/library", label: "Library", icon: "📚" },
  { href: "/flashcards", label: "Flashcards", icon: "🗂" },
  { href: "/review", label: "Review", icon: "✏️" },
  { href: "/stats", label: "Stats", icon: "📊" },
  { href: "/about", label: "About", icon: "ℹ" },
];

function useTheme() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  return { dark, toggle };
}

export default function Sidebar() {
  const path = usePathname();
  const { dark, toggle } = useTheme();

  return (
    <nav className="w-56 flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col py-6 gap-1">
      <div className="px-5 pb-4">
        <span className="text-xl font-bold cjk text-red-700 dark:text-red-400">漢字卡</span>
        <span className="block text-xs text-gray-400 dark:text-gray-500 mt-0.5">Chinese Flashcards</span>
      </div>

      {NAV.map(({ href, label, icon }) => {
        const active = path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-5 py-2.5 text-sm rounded-none transition-colors
              ${active
                ? "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400 font-semibold border-r-2 border-red-600 dark:border-red-500"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100"
              }`}
          >
            <span className="w-5 text-center">{icon}</span>
            {label}
          </Link>
        );
      })}

      {/* Dark mode toggle at the bottom */}
      <div className="mt-auto px-5 pt-4 border-t border-gray-100 dark:border-gray-800">
        <button
          onClick={toggle}
          className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors w-full"
        >
          <span className="text-base">{dark ? "☀️" : "🌙"}</span>
          {dark ? "Light mode" : "Dark mode"}
        </button>
      </div>
    </nav>
  );
}
