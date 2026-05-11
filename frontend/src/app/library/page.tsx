"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getSources } from "@/lib/api";
import type { Source } from "@/lib/types";
import { StatusBadge } from "@/components/ui/Badge";

const TYPE_ICONS: Record<string, string> = {
  pdf: "📄", epub: "📖", youtube: "▶️", text: "📝",
};

export default function LibraryPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSources().then(setSources).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-500">Loading library…</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Library</h1>
        <Link
          href="/import"
          className="text-sm bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
        >
          + Import
        </Link>
      </div>

      {sources.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📚</p>
          <p>No sources yet. Import a PDF, EPUB, YouTube video, or text.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sources.map((s) => (
            <Link
              key={s.id}
              href={`/library/${s.id}`}
              className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-2xl">{TYPE_ICONS[s.source_type] ?? "📝"}</span>
                <StatusBadge status={s.status} />
              </div>
              <h2 className="font-semibold text-sm mb-1 cjk line-clamp-2">{s.title}</h2>
              <p className="text-xs text-gray-400">
                {s.word_count > 0 ? `${s.word_count} words` : "—"}
                {" · "}
                {new Date(s.created_at).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
