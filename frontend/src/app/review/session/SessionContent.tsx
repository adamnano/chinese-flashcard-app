"use client";
import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getFlashcard, submitReviewAnswer } from "@/lib/api";
import type { Flashcard, SessionSummary } from "@/lib/types";
import { HskBadge, TocflBadge } from "@/components/ui/Badge";

const RATINGS = [
  { quality: 1, label: "Again", color: "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800 hover:bg-red-200 dark:hover:bg-red-900" },
  { quality: 3, label: "Hard",  color: "bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-300 border-orange-200 dark:border-orange-800 hover:bg-orange-200 dark:hover:bg-orange-900" },
  { quality: 4, label: "Good",  color: "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800 hover:bg-blue-200 dark:hover:bg-blue-900" },
  { quality: 5, label: "Easy",  color: "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-300 dark:border-green-800 hover:bg-green-200 dark:hover:bg-green-900" },
];

export default function ReviewSessionPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = Number(searchParams.get("session_id"));
  const initialCardId = Number(searchParams.get("card_id"));

  const [card, setCard] = useState<Flashcard | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadInitialCard = useCallback(async () => {
    if (initialCardId) {
      const c = await getFlashcard(initialCardId);
      setCard(c);
    }
  }, [initialCardId]);

  useEffect(() => { loadInitialCard(); }, [loadInitialCard]);

  async function answer(quality: number) {
    if (!card || submitting) return;
    setSubmitting(true);
    try {
      const result = await submitReviewAnswer(sessionId, card.id, quality);
      if (result.session_summary) {
        setSummary(result.session_summary);
        setCard(null);
      } else {
        setCard(result.next_card);
        setRemaining(result.cards_remaining);
        setFlipped(false);
        setContextOpen(false);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (summary) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold mb-2">Session Complete!</h2>
        <div className="grid grid-cols-3 gap-3 my-6 text-center">
          <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-3">
            <div className="text-2xl font-bold">{summary.cards_reviewed}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Reviewed</div>
          </div>
          <div className="bg-green-50 dark:bg-green-950 rounded-xl p-3">
            <div className="text-2xl font-bold text-green-700 dark:text-green-400">{summary.cards_correct}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Correct</div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-950 rounded-xl p-3">
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{summary.accuracy_pct}%</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Accuracy</div>
          </div>
        </div>
        <div className="flex gap-3 justify-center">
          <button onClick={() => router.push("/review")} className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
            Review Again
          </button>
          <button onClick={() => router.push("/stats")} className="px-5 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800">
            View Stats
          </button>
        </div>
      </div>
    );
  }

  if (!card) {
    return <p className="text-center py-16 text-gray-500 dark:text-gray-400">Loading card…</p>;
  }

  return (
    <div className="max-w-xl mx-auto">
      {remaining !== null && (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-right mb-4">{remaining} cards remaining</p>
      )}

      {/* Flashcard */}
      <div className="card-flip cursor-pointer mb-6" onClick={() => !flipped && setFlipped(true)}>
        <div className={`card-flip-inner ${flipped ? "flipped" : ""}`}>
          {/* Front */}
          <div className="card-face bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-2xl flex flex-col items-center justify-center p-8 min-h-48">
            <div className="text-6xl font-medium cjk mb-3">{card.traditional}</div>
            {!flipped && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">Tap to reveal</p>
            )}
          </div>
          {/* Back */}
          <div className="card-face card-back bg-white dark:bg-gray-900 border-2 border-red-200 dark:border-red-900 rounded-2xl p-6">
            <div className="text-4xl font-medium cjk mb-1">{card.traditional}</div>
            {card.simplified && card.simplified !== card.traditional && (
              <div className="text-lg text-gray-400 dark:text-gray-500 cjk">{card.simplified}</div>
            )}
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">{card.pinyin}</div>
            <div className="flex gap-1 mb-3">
              <HskBadge level={card.hsk_level} />
              <TocflBadge level={card.tocfl_level} />
            </div>

            {/* Primary meaning */}
            <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">{card.base_meaning}</p>

            {/* Context toggle */}
            {card.contextual_meaning && (
              <div className="mb-3">
                <button
                  onClick={(e) => { e.stopPropagation(); setContextOpen(o => !o); }}
                  className="text-xs text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-full px-3 py-1 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                >
                  {contextOpen ? "Hide context" : "In what context was this used?"}
                </button>
                {contextOpen && (
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 italic leading-relaxed">
                    {card.contextual_meaning}
                  </p>
                )}
              </div>
            )}

            {card.example_sentence && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm cjk text-gray-700 dark:text-gray-300 border-l-4 border-red-300 dark:border-red-700">
                <span className="block text-xs text-gray-400 dark:text-gray-500 not-cjk mb-1">Example sentence</span>
                {card.example_sentence}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rating buttons */}
      {flipped && (
        <div className="grid grid-cols-4 gap-2">
          {RATINGS.map(({ quality, label, color }) => (
            <button
              key={quality}
              onClick={() => answer(quality)}
              disabled={submitting}
              className={`py-3 rounded-xl border text-sm font-semibold transition-colors disabled:opacity-50 ${color}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
