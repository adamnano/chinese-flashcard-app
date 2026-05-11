"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getFlashcards, updateFlashcard } from "@/lib/api";
import type { Flashcard } from "@/lib/types";
import { HskBadge, TocflBadge } from "@/components/ui/Badge";

const HSK_LEVELS = [1, 2, 3, 4, 5, 6, 7];
const TOCFL_LEVELS = [1, 2, 3, 4, 5, 6, 7];

export default function FlashcardsPage() {
  const searchParams = useSearchParams();
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [hskFilter, setHskFilter] = useState<number | undefined>(undefined);
  const [tocflFilter, setTocflFilter] = useState<number | undefined>(undefined);
  const [sourceId] = useState<number | undefined>(
    searchParams.get("source_id") ? Number(searchParams.get("source_id")) : undefined
  );

  useEffect(() => {
    setLoading(true);
    getFlashcards({
      source_id: sourceId,
      hsk_level: hskFilter,
      tocfl_level: tocflFilter,
      limit: 100,
    })
      .then(setCards)
      .finally(() => setLoading(false));
  }, [sourceId, hskFilter, tocflFilter]);

  const today = new Date().toISOString().split("T")[0];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Flashcards</h1>
        <Link
          href="/review"
          className="text-sm bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
        >
          Start Review →
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap mb-6">
        <div>
          <label className="block text-xs text-gray-500 mb-1">HSK Level</label>
          <select
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
            value={hskFilter ?? ""}
            onChange={(e) => setHskFilter(e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">All HSK</option>
            {HSK_LEVELS.map((l) => (
              <option key={l} value={l}>{l === 7 ? "HSK 7-9" : `HSK ${l}`}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">TOCFL Level</label>
          <select
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
            value={tocflFilter ?? ""}
            onChange={(e) => setTocflFilter(e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">All TOCFL</option>
            {TOCFL_LEVELS.map((l) => (
              <option key={l} value={l}>TOCFL {l}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading flashcards…</p>
      ) : cards.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🗂</p>
          <p>No flashcards found. Import a source first.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-4">{cards.length} cards</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {cards.map((card) => (
              <div
                key={card.id}
                className={`bg-white rounded-xl border p-4 ${
                  card.is_suspended ? "opacity-50 border-gray-200" : "border-gray-200"
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-3xl font-medium cjk">{card.traditional}</span>
                  <div className="flex gap-1 flex-wrap justify-end">
                    {card.next_review <= today && !card.is_suspended && (
                      <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">
                        Due
                      </span>
                    )}
                    <HskBadge level={card.hsk_level} />
                    <TocflBadge level={card.tocfl_level} />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mb-1">{card.pinyin}</p>
                <p className="text-sm text-gray-700 line-clamp-2">{card.contextual_meaning}</p>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-gray-400">
                    interval: {card.interval}d
                  </span>
                  <button
                    onClick={() =>
                      updateFlashcard(card.id, { is_suspended: !card.is_suspended }).then((updated) =>
                        setCards((cs) => cs.map((c) => (c.id === card.id ? updated : c)))
                      )
                    }
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    {card.is_suspended ? "Unsuspend" : "Suspend"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
