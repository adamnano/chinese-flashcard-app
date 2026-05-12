"use client";
import { useEffect, useState } from "react";
import { Playfair_Display } from "next/font/google";
import { getStats, getSourceStats } from "@/lib/api";
import type { Stats, SourceStats, DailyReview } from "@/lib/types";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
});

// ─── Heatmap ──────────────────────────────────────────────────────────────────
function Heatmap({ data }: { data: DailyReview[] }) {
  const map: Record<string, number> = {};
  data.forEach((d) => { map[d.day] = d.count; });

  const days: string[] = [];
  const today = new Date();
  for (let i = 83; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split("T")[0]);
  }

  const max = Math.max(...data.map((d) => d.count), 1);

  const COLORS = [
    "bg-gray-100 dark:bg-gray-800",
    "bg-red-100 dark:bg-red-950",
    "bg-red-300 dark:bg-red-800",
    "bg-red-500 dark:bg-red-600",
    "bg-red-700 dark:bg-red-400",
  ];

  const weeks: string[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <div>
      <div className="flex gap-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((day) => {
              const count = map[day] ?? 0;
              const intensity = count === 0 ? 0 : Math.min(4, Math.ceil((count / max) * 4));
              return (
                <div
                  key={day}
                  className={`w-3.5 h-3.5 rounded-sm ${COLORS[intensity]}`}
                  title={`${day}: ${count} review${count !== 1 ? "s" : ""}`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-400 dark:text-gray-500">
        <span>Less</span>
        {COLORS.map((c, i) => <div key={i} className={`w-3.5 h-3.5 rounded-sm ${c}`} />)}
        <span>More</span>
      </div>
    </div>
  );
}

// ─── Level bar chart (vertical) ───────────────────────────────────────────────
function LevelBars({
  items,
  colorClass,
}: {
  items: { label: string; count: number }[];
  colorClass: string;
}) {
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className="flex items-end gap-2 h-28">
      {items.map(({ label, count }) => (
        <div key={label} className="flex flex-col items-center gap-1 flex-1">
          {count > 0 && (
            <span className="text-[9px] font-bold text-gray-500 dark:text-gray-400">{count}</span>
          )}
          <div
            className={`w-full rounded-t-md ${colorClass}`}
            style={{ height: `${(count / max) * 100}%`, minHeight: count > 0 ? 4 : 0 }}
          />
          <span className="text-[9px] text-gray-400 dark:text-gray-500 text-center leading-tight">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [sourceStats, setSourceStats] = useState<SourceStats[]>([]);

  useEffect(() => {
    Promise.all([getStats(), getSourceStats()]).then(([s, ss]) => {
      setStats(s);
      setSourceStats(ss);
    });
  }, []);

  if (!stats) return <p className="text-gray-500 dark:text-gray-400">Loading stats…</p>;

  const totalReviews = stats.daily_reviews.reduce((s, d) => s + d.count, 0);

  const hskItems = [1, 2, 3, 4, 5, 6, 7].map((l) => ({
    label: l === 7 ? "7–9" : `${l}`,
    count: stats.hsk_distribution.find((d) => d.level === l)?.count ?? 0,
  }));
  hskItems.push({
    label: "?",
    count: stats.hsk_distribution.find((d) => d.level === null)?.count ?? 0,
  });

  const tocflItems = [1, 2, 3, 4, 5, 6, 7].map((l) => ({
    label: `${l}`,
    count: stats.tocfl_distribution.find((d) => d.level === l)?.count ?? 0,
  }));
  tocflItems.push({
    label: "?",
    count: stats.tocfl_distribution.find((d) => d.level === null)?.count ?? 0,
  });

  return (
    <div className={`${playfair.variable} max-w-4xl mx-auto pb-20`}>

      {/* Hero */}
      <div className="mb-12 border-b border-gray-200 dark:border-gray-800 pb-10">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-red-500 dark:text-red-400 mb-4">
          Your progress
        </p>
        <h1 className="font-[family-name:var(--font-playfair)] text-5xl font-bold leading-tight text-gray-900 dark:text-gray-50 mb-3">
          {stats.streak_days > 0 ? (
            <>
              {stats.streak_days}-day streak.{" "}
              <span className="italic text-red-600 dark:text-red-400">Keep going.</span>
            </>
          ) : (
            <>
              Start your{" "}
              <span className="italic text-red-600 dark:text-red-400">streak today.</span>
            </>
          )}
        </h1>
        <p className="text-gray-400 dark:text-gray-500 text-sm">
          {totalReviews.toLocaleString()} total reviews across {stats.total_cards} flashcards
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
        {[
          { label: "Total Cards", value: stats.total_cards.toLocaleString(), color: "text-gray-800 dark:text-gray-200", sub: "in your collection" },
          { label: "Due Today", value: stats.due_today.toLocaleString(), color: "text-orange-600 dark:text-orange-400", sub: stats.due_today === 0 ? "all caught up!" : "ready to review" },
          { label: "Mastered", value: stats.mastered_cards.toLocaleString(), color: "text-green-600 dark:text-green-400", sub: `${stats.total_cards > 0 ? Math.round((stats.mastered_cards / stats.total_cards) * 100) : 0}% of cards` },
          { label: "Streak", value: `${stats.streak_days}d`, color: "text-red-600 dark:text-red-400", sub: stats.streak_days === 1 ? "day in a row" : "days in a row" },
        ].map(({ label, value, color, sub }) => (
          <div key={label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 text-center">
            <div className={`text-3xl font-bold ${color}`}>{value}</div>
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wide">{label}</div>
            <div className="text-[10px] text-gray-300 dark:text-gray-600 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* Heatmap */}
      <section className="mb-10">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="font-[family-name:var(--font-playfair)] text-xl font-bold dark:text-white">
              Review Activity
            </h2>
            <span className="text-xs text-gray-400 dark:text-gray-500">Last 12 weeks</span>
          </div>
          <Heatmap data={stats.daily_reviews} />
        </div>
      </section>

      {/* Level distribution */}
      <section className="mb-10">
        <h2 className="font-[family-name:var(--font-playfair)] text-xl font-bold dark:text-white mb-4">
          Vocabulary breakdown
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
            <div className="flex items-baseline justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">By HSK Level</h3>
              <span className="text-xs text-gray-300 dark:text-gray-600 font-mono">2021 standard</span>
            </div>
            <LevelBars items={hskItems} colorClass="bg-red-400 dark:bg-red-600" />
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
            <div className="flex items-baseline justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">By TOCFL Level</h3>
              <span className="text-xs text-gray-300 dark:text-gray-600 font-mono">Taiwan standard</span>
            </div>
            <LevelBars items={tocflItems} colorClass="bg-sky-400 dark:bg-sky-600" />
          </div>
        </div>
      </section>

      {/* Mastery overview */}
      {stats.total_cards > 0 && (
        <section className="mb-10">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
            <h2 className="font-[family-name:var(--font-playfair)] text-xl font-bold dark:text-white mb-5">
              Mastery
            </h2>
            <div className="flex items-center gap-4 mb-3">
              <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-4 overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${(stats.mastered_cards / stats.total_cards) * 100}%` }}
                />
              </div>
              <span className="text-sm font-bold text-green-600 dark:text-green-400 w-12 text-right">
                {Math.round((stats.mastered_cards / stats.total_cards) * 100)}%
              </span>
            </div>
            <div className="flex gap-6 text-xs text-gray-500 dark:text-gray-400">
              <span>
                <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1.5" />
                {stats.mastered_cards} mastered (interval ≥ 21 days)
              </span>
              <span>
                <span className="inline-block w-2 h-2 rounded-full bg-gray-200 dark:bg-gray-700 mr-1.5" />
                {stats.total_cards - stats.mastered_cards} in progress
              </span>
            </div>
          </div>
        </section>
      )}

      {/* By source */}
      {sourceStats.length > 0 && (
        <section>
          <h2 className="font-[family-name:var(--font-playfair)] text-xl font-bold dark:text-white mb-4">
            By source
          </h2>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                <tr>
                  <th className="text-left px-5 py-3">Source</th>
                  <th className="text-right px-4 py-3">Cards</th>
                  <th className="text-right px-4 py-3">Mastered</th>
                  <th className="text-right px-4 py-3">Due</th>
                  <th className="text-right px-5 py-3">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {sourceStats.map((s) => {
                  const pct = s.total_cards > 0 ? (s.mastered_cards / s.total_cards) * 100 : 0;
                  return (
                    <tr key={s.source_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-5 py-3 cjk font-medium text-gray-800 dark:text-gray-200 max-w-[180px] truncate">
                        {s.title}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{s.total_cards}</td>
                      <td className="px-4 py-3 text-right text-green-600 dark:text-green-400 font-medium">{s.mastered_cards}</td>
                      <td className={`px-4 py-3 text-right font-medium ${s.due_today > 0 ? "text-orange-500 dark:text-orange-400" : "text-gray-300 dark:text-gray-600"}`}>
                        {s.due_today}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <div className="w-20 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full bg-green-500 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 w-8 text-right">
                            {Math.round(pct)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
