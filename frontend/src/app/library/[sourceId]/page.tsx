"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getSource, getChapterWords, getIngestStatus, deleteSource } from "@/lib/api";
import type { SourceDetail, Chapter, WordOccurrence } from "@/lib/types";
import { HskBadge, TocflBadge, StatusBadge } from "@/components/ui/Badge";

export default function SourceDetailPage() {
  const { sourceId } = useParams<{ sourceId: string }>();
  const router = useRouter();
  const id = Number(sourceId);
  const [source, setSource] = useState<SourceDetail | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [words, setWords] = useState<WordOccurrence[]>([]);
  const [polling, setPolling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadSource = useCallback(() => {
    getSource(id).then((s) => {
      setSource(s);
      if (s.status === "processing" || s.status === "pending") {
        setPolling(true);
      } else {
        setPolling(false);
        if (s.chapters.length > 0 && !selectedChapter) {
          setSelectedChapter(s.chapters[0]);
        }
      }
    });
  }, [id, selectedChapter]);

  useEffect(() => { loadSource(); }, [loadSource]);

  // Poll while processing
  useEffect(() => {
    if (!polling) return;
    const timer = setInterval(() => {
      getIngestStatus(id).then((s) => {
        if (s.status === "done" || s.status === "error") {
          setPolling(false);
          loadSource();
        }
      });
    }, 2000);
    return () => clearInterval(timer);
  }, [polling, id, loadSource]);

  useEffect(() => {
    if (!selectedChapter || !source) return;
    getChapterWords(source.id, selectedChapter.id).then(setWords);
  }, [selectedChapter, source]);

  if (!source) return <p className="text-gray-500">Loading…</p>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/library" className="text-gray-400 hover:text-gray-600 text-sm">← Library</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold cjk flex-1">{source.title}</h1>
        <StatusBadge status={source.status} />
        <button
          onClick={async () => {
            if (!confirm(`Delete "${source.title}" and all its flashcards?`)) return;
            setDeleting(true);
            await deleteSource(id);
            router.push("/library");
          }}
          disabled={deleting}
          className="text-xs text-red-500 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Delete source"}
        </button>
      </div>

      {(source.status === "processing" || source.status === "pending") && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
          <div>
            <p className="text-sm font-medium text-yellow-800">Processing text…</p>
            <p className="text-xs text-yellow-600">Tokenizing, classifying vocabulary, and generating flashcards.</p>
          </div>
        </div>
      )}

      {source.status === "error" && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="text-sm font-medium text-red-700">Processing error</p>
          <p className="text-xs text-red-500 mt-1">{source.error_msg}</p>
        </div>
      )}

      <div className="flex gap-4">
        {/* Chapter list */}
        <div className="w-52 flex-shrink-0">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Chapters</h2>
          <div className="space-y-1">
            {source.chapters.map((ch) => (
              <button
                key={ch.id}
                onClick={() => setSelectedChapter(ch)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors
                  ${selectedChapter?.id === ch.id
                    ? "bg-red-50 text-red-700 font-medium"
                    : "text-gray-600 hover:bg-gray-100"
                  }`}
              >
                <div className="truncate">{ch.title}</div>
                <div className="text-xs text-gray-400">{ch.word_count} words</div>
              </button>
            ))}
          </div>
        </div>

        {/* Word list */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-600">
              {selectedChapter ? selectedChapter.title : "Select a chapter"}
            </h2>
            {selectedChapter && (
              <Link
                href={`/flashcards?source_id=${source.id}`}
                className="text-xs text-red-600 hover:underline"
              >
                View flashcards →
              </Link>
            )}
          </div>
          {words.length === 0 ? (
            <p className="text-sm text-gray-400">No vocabulary data yet.</p>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Word</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Pinyin</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Level</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Count</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Context</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {words.map((w) => (
                    <tr key={w.word_id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium cjk text-lg">{w.traditional}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs">{w.pinyin ?? "—"}</td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1 flex-wrap">
                          <HskBadge level={w.hsk_level} />
                          <TocflBadge level={w.tocfl_level} />
                        </div>
                      </td>
                      <td className="px-4 py-2 text-gray-500">{w.count}×</td>
                      <td className="px-4 py-2 text-xs text-gray-400 max-w-xs truncate cjk">
                        {w.context_snippet ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
