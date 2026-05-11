"use client";
import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getFlashcard, submitReviewAnswer } from "@/lib/api";
import type { Flashcard, SessionSummary } from "@/lib/types";
import { HskBadge, TocflBadge } from "@/components/ui/Badge";

const RATINGS = [
  { quality: 0, label: "Blackout", color: "bg-red-100 text-red-700 border-red-300 hover:bg-red-200" },
  { quality: 1, label: "Wrong", color: "bg-red-50 text-red-600 border-red-200 hover:bg-red-100" },
  { quality: 2, label: "Knew it (wrong)", color: "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100" },
  { quality: 3, label: "Hard", color: "bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100" },
  { quality: 4, label: "Good", color: "bg-green-50 text-green-700 border-green-200 hover:bg-green-100" },
  { quality: 5, label: "Easy", color: "bg-green-100 text-green-800 border-green-300 hover:bg-green-200" },
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

  // Load the first card — passed via URL or re-fetched
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
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="text-2xl font-bold">{summary.cards_reviewed}</div>
            <div className="text-xs text-gray-500">Reviewed</div>
          </div>
          <div className="bg-green-50 rounded-xl p-3">
            <div className="text-2xl font-bold text-green-700">{summary.cards_correct}</div>
            <div className="text-xs text-gray-500">Correct</div>
          </div>
          <div className="bg-blue-50 rounded-xl p-3">
            <div className="text-2xl font-bold text-blue-700">{summary.accuracy_pct}%</div>
            <div className="text-xs text-gray-500">Accuracy</div>
          </div>
        </div>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => router.push("/review")}
            className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
          >
            Review Again
          </button>
          <button
            onClick={() => router.push("/stats")}
            className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
          >
            View Stats
          </button>
        </div>
      </div>
    );
  }

  if (!card) {
    return <p className="text-center py-16 text-gray-500">Loading card…</p>;
  }

  return (
    <div className="max-w-xl mx-auto">
      {remaining !== null && (
        <p className="text-xs text-gray-400 text-right mb-4">{remaining} cards remaining</p>
      )}

      {/* Flashcard */}
      <div className="card-flip cursor-pointer mb-6" onClick={() => !flipped && setFlipped(true)}>
        <div className={`card-flip-inner ${flipped ? "flipped" : ""}`} style={{ minHeight: 260 }}>
          {/* Front */}
          <div className="card-face absolute inset-0 bg-white border-2 border-gray-200 rounded-2xl flex flex-col items-center justify-center p-8">
            <div className="text-6xl font-medium cjk mb-3">{card.traditional}</div>
            {!flipped && (
              <p className="text-xs text-gray-400 mt-4">Tap to reveal</p>
            )}
          </div>
          {/* Back */}
          <div className="card-face card-back absolute inset-0 bg-white border-2 border-red-200 rounded-2xl p-6 overflow-y-auto">
            <div className="text-4xl font-medium cjk mb-1">{card.traditional}</div>
            {card.simplified && card.simplified !== card.traditional && (
              <div className="text-lg text-gray-400 cjk">{card.simplified}</div>
            )}
            <div className="text-sm text-gray-500 mb-2">{card.pinyin}</div>
            <div className="flex gap-1 mb-3">
              <HskBadge level={card.hsk_level} />
              <TocflBadge level={card.tocfl_level} />
            </div>

            {/* Primary meaning — short direct translation */}
            <p className="text-xl font-semibold text-gray-900 mb-4">{card.base_meaning}</p>

            {/* Context toggle */}
            {card.contextual_meaning && (
              <div className="mb-3">
                <button
                  onClick={(e) => { e.stopPropagation(); setContextOpen(o => !o); }}
                  className="text-xs text-red-600 border border-red-200 rounded-full px-3 py-1 hover:bg-red-50 transition-colors"
                >
                  {contextOpen ? "Hide context" : "In what context was this used?"}
                </button>
                {contextOpen && (
                  <p className="mt-2 text-sm text-gray-600 italic leading-relaxed">
                    {card.contextual_meaning}
                  </p>
                )}
              </div>
            )}

            {card.example_sentence && (
              <div className="bg-gray-50 rounded-lg p-3 text-sm cjk text-gray-700 border-l-4 border-red-300">
                {card.example_sentence}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rating buttons — only shown after flip */}
      {flipped && (
        <div className="grid grid-cols-3 gap-2">
          {RATINGS.map(({ quality, label, color }) => (
            <button
              key={quality}
              onClick={() => answer(quality)}
              disabled={submitting}
              className={`py-2.5 rounded-xl border text-xs font-semibold transition-colors disabled:opacity-50 ${color}`}
            >
              <span className="block text-lg font-bold">{quality}</span>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
