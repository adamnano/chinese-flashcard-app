"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getDueCount, getSources, startReviewSession } from "@/lib/api";
import type { Source, DueCount } from "@/lib/types";

export default function ReviewPage() {
  const router = useRouter();
  const [due, setDue] = useState<DueCount | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [selectedSources, setSelectedSources] = useState<number[]>([]);
  const [selectedHsk, setSelectedHsk] = useState<number[]>([]);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getDueCount().then(setDue);
    getSources().then((s) => setSources(s.filter((x) => x.status === "done")));
  }, []);

  async function start() {
    setLoading(true);
    try {
      const session = await startReviewSession({
        source_ids: selectedSources.length ? selectedSources : undefined,
        hsk_levels: selectedHsk.length ? selectedHsk : undefined,
        limit,
      });
      if (!session.card) { alert("No cards due with the current filter."); return; }
      router.push(`/review/session?session_id=${session.session_id}&card_id=${session.card.id}`);
    } finally {
      setLoading(false);
    }
  }

  const toggleSource = (id: number) =>
    setSelectedSources((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  const toggleHsk = (l: number) =>
    setSelectedHsk((s) => s.includes(l) ? s.filter((x) => x !== l) : [...s, l]);

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Review Session</h1>

      {due && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-900 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">{due.due_today}</div>
            <div className="text-sm text-orange-700 dark:text-orange-300 mt-1">Due today</div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{due.due_this_week}</div>
            <div className="text-sm text-blue-700 dark:text-blue-300 mt-1">Due this week</div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 space-y-5">
        <div>
          <label className="block text-sm font-semibold mb-2">Filter by Source (optional)</label>
          <div className="flex flex-wrap gap-2">
            {sources.map((s) => (
              <button
                key={s.id}
                onClick={() => toggleSource(s.id)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors
                  ${selectedSources.includes(s.id)
                    ? "bg-red-100 dark:bg-red-950 border-red-400 dark:border-red-700 text-red-700 dark:text-red-400"
                    : "border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500"
                  }`}
              >
                {s.title}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2">Filter by HSK Level (optional)</label>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 7].map((l) => (
              <button
                key={l}
                onClick={() => toggleHsk(l)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors
                  ${selectedHsk.includes(l)
                    ? "bg-blue-100 dark:bg-blue-950 border-blue-400 dark:border-blue-700 text-blue-700 dark:text-blue-400"
                    : "border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500"
                  }`}
              >
                {l === 7 ? "HSK 7-9" : `HSK ${l}`}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2">
            Max cards per session: <span className="text-red-600 dark:text-red-400">{limit}</span>
          </label>
          <input
            type="range" min={5} max={100} step={5} value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="w-full accent-red-600"
          />
          <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mt-1">
            <span>5</span><span>100</span>
          </div>
        </div>

        <button
          onClick={start}
          disabled={loading || (due?.due_today === 0 && selectedSources.length === 0)}
          className="w-full bg-red-600 text-white rounded-lg py-3 font-semibold
            hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Starting…" : "Start Review"}
        </button>
      </div>
    </div>
  );
}
