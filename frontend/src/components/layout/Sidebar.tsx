"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/import", label: "Import", icon: "↑" },
  { href: "/library", label: "Library", icon: "📚" },
  { href: "/flashcards", label: "Flashcards", icon: "🗂" },
  { href: "/review", label: "Review", icon: "✏️" },
  { href: "/stats", label: "Stats", icon: "📊" },
  { href: "/about", label: "About", icon: "ℹ" },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <nav className="w-56 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col py-6 gap-1">
      <div className="px-5 pb-4">
        <span className="text-xl font-bold cjk text-red-700">漢字卡</span>
        <span className="block text-xs text-gray-400 mt-0.5">Chinese Flashcards</span>
      </div>
      {NAV.map(({ href, label, icon }) => {
        const active = path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-5 py-2.5 text-sm rounded-none transition-colors
              ${active
                ? "bg-red-50 text-red-700 font-semibold border-r-2 border-red-600"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
          >
            <span className="w-5 text-center">{icon}</span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
