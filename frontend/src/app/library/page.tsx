"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getSources, getSourceStats } from "@/lib/api";
import type { Source, SourceStats } from "@/lib/types";
import { StatusBadge } from "@/components/ui/Badge";

const TYPE_ICONS: Record<string, string> = {
  pdf: "📄", epub: "📖", youtube: "▶️", text: "📝",
};

const TYPE_LABELS: Record<string, string> = {
  pdf: "PDF", epub: "EPUB", youtube: "YouTube", text: "Text",
};

export default function LibraryPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [statsMap, setStatsMap] = useState<Record<number, SourceStats>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getSources(), getSourceStats()])
      .then(([srcs, stats]) => {
        setSources(srcs);
        const map: Record<number, SourceStats> = {};
        stats.forEach((s) => { map[s.source_id] = s; });
        setStatsMap(map);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-500 dark:text-gray-400">Loading library…</p>;

  const totalCards = Object.values(statsMap).reduce((s, v) => s + v.total_cards, 0);
  const totalDue   = Object.values(statsMap).reduce((s, v) => s + v.due_today, 0);
  const totalWords = sources.reduce((s, v) => s + v.word_count, 0);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold dark:text-white">Library</h1>
          {sources.length > 0 && (
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
              {sources.length} source{sources.length !== 1 ? "s" : ""} · {totalWords.toLocaleString()} tokens · {totalCards} flashcards
            </p>
          )}
        </div>
        <Link
          href="/import"
          className="text-sm bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors font-medium"
        >
          + Import
        </Link>
      </div>

      {/* Summary strip */}
      {sources.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { label: "Total Sources", value: sources.length, color: "text-gray-800 dark:text-gray-100" },
            { label: "Flashcards", value: totalCards.toLocaleString(), color: "text-red-600 dark:text-red-400" },
            { label: "Due Today", value: totalDue.toLocaleString(), color: "text-orange-600 dark:text-orange-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 text-center">
              <div className={`text-3xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-gray-400 dark:text-gray-500 mt-1 font-medium uppercase tracking-wide">{label}</div>
            </div>
          ))}
        </div>
      )}

      {sources.length === 0 ? (
        <div className="text-center py-24 text-gray-400 dark:text-gray-500">
          <p className="text-5xl mb-4">📚</p>
          <p className="text-lg font-medium text-gray-500 dark:text-gray-400 mb-2">Your library is empty</p>
          <p className="text-sm">Import a PDF, EPUB, YouTube video, or paste text to get started.</p>
          <Link
            href="/import"
            className="inline-block mt-6 bg-red-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-red-700 transition-colors"
          >
            Import your first source
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {sources.map((s) => {
            const st = statsMap[s.id];
            const masteredPct = st && st.total_cards > 0 ? (st.mastered_cards / st.total_cards) * 100 : 0;
            return (
              <Link
                key={s.id}
                href={`/library/${s.id}`}
                className="group bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 hover:border-red-300 dark:hover:border-red-800 hover:shadow-lg dark:hover:shadow-gray-900 transition-all"
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{TYPE_ICONS[s.source_type] ?? "📝"}</span>
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        {TYPE_LABELS[s.source_type] ?? s.source_type}
                      </span>
                      <h2 className="font-bold text-base cjk text-gray-900 dark:text-gray-100 leading-snug line-clamp-2 group-hover:text-red-700 dark:group-hover:text-red-400 transition-colors">
                        {s.title}
                      </h2>
                    </div>
                  </div>
                  <StatusBadge status={s.status} />
                </div>

                {/* Stats grid */}
                {st && st.total_cards > 0 ? (
                  <>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="text-center">
                        <div className="text-xl font-bold text-gray-800 dark:text-gray-200">{st.total_cards}</div>
                        <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide">Cards</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-green-600 dark:text-green-400">{st.mastered_cards}</div>
                        <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide">Mastered</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-xl font-bold ${st.due_today > 0 ? "text-orange-500 dark:text-orange-400" : "text-gray-400 dark:text-gray-600"}`}>
                          {st.due_today}
                        </div>
                        <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide">Due</div>
                      </div>
                    </div>

                    {/* Mastery progress bar */}
                    <div className="mb-3">
                      <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500 mb-1">
                        <span>Mastery</span>
                        <span>{Math.round(masteredPct)}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 dark:bg-green-500 rounded-full transition-all"
                          style={{ width: `${masteredPct}%` }}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="mb-4 text-sm text-gray-400 dark:text-gray-500">
                    {s.status === "done" ? "No flashcards yet" : s.status === "processing" ? "Processing…" : "—"}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
                  <span>{s.word_count > 0 ? `${s.word_count.toLocaleString()} tokens` : "—"}</span>
                  <span>{new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
