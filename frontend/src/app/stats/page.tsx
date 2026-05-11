"use client";
import { useEffect, useState } from "react";
import { getStats, getSourceStats } from "@/lib/api";
import type { Stats, SourceStats, DailyReview } from "@/lib/types";

function Heatmap({ data }: { data: DailyReview[] }) {
  const map: Record<string, number> = {};
  data.forEach((d) => { map[d.day] = d.count; });

  const days: string[] = [];
  const today = new Date();
  for (let i = 59; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split("T")[0]);
  }

  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div>
      <div className="flex flex-wrap gap-1">
        {days.map((day) => {
          const count = map[day] ?? 0;
          const intensity = count === 0 ? 0 : Math.ceil((count / max) * 4);
          const colors = ["bg-gray-100", "bg-green-100", "bg-green-300", "bg-green-500", "bg-green-700"];
          return (
            <div
              key={day}
              className={`w-3 h-3 rounded-sm ${colors[intensity]}`}
              title={`${day}: ${count} reviews`}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
        <span>Less</span>
        {["bg-gray-100", "bg-green-100", "bg-green-300", "bg-green-500", "bg-green-700"].map((c, i) => (
          <div key={i} className={`w-3 h-3 rounded-sm ${c}`} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

function LevelBar({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-16 text-right text-gray-500 text-xs flex-shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-3">
        <div className="bg-red-400 h-3 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-gray-500 text-xs">{count}</span>
    </div>
  );
}

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [sourceStats, setSourceStats] = useState<SourceStats[]>([]);

  useEffect(() => {
    getStats().then(setStats);
    getSourceStats().then(setSourceStats);
  }, []);

  if (!stats) return <p className="text-gray-500">Loading stats…</p>;

  const maxHsk = Math.max(...stats.hsk_distribution.map((d) => d.count), 1);
  const maxTocfl = Math.max(...stats.tocfl_distribution.map((d) => d.count), 1);

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Stats</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Cards", value: stats.total_cards, color: "text-gray-800" },
          { label: "Due Today", value: stats.due_today, color: "text-orange-600" },
          { label: "Mastered", value: stats.mastered_cards, color: "text-green-600" },
          { label: "Streak", value: `${stats.streak_days}d`, color: "text-red-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-gray-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Review heatmap */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold mb-4">Review Activity (60 days)</h2>
        <Heatmap data={stats.daily_reviews} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* HSK distribution */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-4">Cards by HSK Level</h2>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6, 7].map((l) => {
              const count = stats.hsk_distribution.find((d) => d.level === l)?.count ?? 0;
              return (
                <LevelBar
                  key={l}
                  label={l === 7 ? "7-9" : `HSK ${l}`}
                  count={count}
                  max={maxHsk}
                />
              );
            })}
            <LevelBar
              label="Unknown"
              count={stats.hsk_distribution.find((d) => d.level === null)?.count ?? 0}
              max={maxHsk}
            />
          </div>
        </div>

        {/* TOCFL distribution */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-4">Cards by TOCFL Level</h2>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6, 7].map((l) => {
              const count = stats.tocfl_distribution.find((d) => d.level === l)?.count ?? 0;
              return <LevelBar key={l} label={`TOCFL ${l}`} count={count} max={maxTocfl} />;
            })}
            <LevelBar
              label="Unknown"
              count={stats.tocfl_distribution.find((d) => d.level === null)?.count ?? 0}
              max={maxTocfl}
            />
          </div>
        </div>
      </div>

      {/* Per-source breakdown */}
      {sourceStats.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <h2 className="text-sm font-semibold p-4 border-b border-gray-200">By Source</h2>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="text-left px-4 py-2">Source</th>
                <th className="text-right px-4 py-2">Cards</th>
                <th className="text-right px-4 py-2">Mastered</th>
                <th className="text-right px-4 py-2">Due Today</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sourceStats.map((s) => (
                <tr key={s.source_id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 cjk">{s.title}</td>
                  <td className="px-4 py-2 text-right">{s.total_cards}</td>
                  <td className="px-4 py-2 text-right text-green-600">{s.mastered_cards}</td>
                  <td className="px-4 py-2 text-right text-orange-600">{s.due_today}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
