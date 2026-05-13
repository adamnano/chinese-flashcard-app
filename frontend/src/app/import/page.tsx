"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ingestText, ingestYoutube, ingestFile, previewChapters } from "@/lib/api";
import type { ChapterPreview } from "@/lib/types";

type InputType = "text" | "youtube" | "pdf" | "epub";

const TYPES: { id: InputType; label: string; desc: string; icon: string }[] = [
  { id: "text",    label: "Text Paste", desc: "Paste Traditional Chinese text directly", icon: "📝" },
  { id: "youtube", label: "YouTube",    desc: "Enter a YouTube URL with Chinese captions", icon: "▶️" },
  { id: "pdf",     label: "PDF",        desc: "Upload a PDF file", icon: "📄" },
  { id: "epub",    label: "EPUB",       desc: "Upload an EPUB ebook", icon: "📖" },
];

const HSK_OPTIONS  = [null, 1, 2, 3, 4, 5, 6, 7] as const;
const TOCFL_OPTIONS = [null, 1, 2, 3, 4, 5, 6, 7] as const;

function LevelSelect({
  label, prefix, value, onChange,
}: {
  label: string;
  prefix: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => onChange(null)}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
            value === null
              ? "bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 border-gray-800 dark:border-gray-200"
              : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-400"
          }`}
        >
          All
        </button>
        {[1, 2, 3, 4, 5, 6, 7].map((l) => (
          <button
            key={l}
            onClick={() => onChange(l)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
              value === l
                ? "bg-red-600 text-white border-red-600"
                : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-red-400 hover:text-red-600"
            }`}
          >
            {prefix}{l}{l === 7 && prefix === "HSK " ? "–9" : ""}+
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ImportPage() {
  const router = useRouter();
  const [type, setType] = useState<InputType | null>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Chapter selection
  const [chapters, setChapters] = useState<ChapterPreview[]>([]);
  const [chaptersLoading, setChaptersLoading] = useState(false);
  const [selectedChapters, setSelectedChapters] = useState<Set<number>>(new Set());

  // Level filters
  const [minHsk, setMinHsk] = useState<number | null>(null);
  const [minTocfl, setMinTocfl] = useState<number | null>(null);
  const [includeUnclassified, setIncludeUnclassified] = useState(true);

  // Auto-preview chapters when a file is selected
  useEffect(() => {
    if (!file || (type !== "pdf" && type !== "epub")) {
      setChapters([]);
      setSelectedChapters(new Set());
      return;
    }
    setChaptersLoading(true);
    previewChapters(type, file)
      .then((ch) => {
        setChapters(ch);
        setSelectedChapters(new Set(ch.map((c) => c.index)));
      })
      .catch((e: unknown) => {
        setChapters([]);
        setError(e instanceof Error ? `Could not read file: ${e.message}` : "Could not read file — make sure it is a valid EPUB/PDF.");
      })
      .finally(() => setChaptersLoading(false));
  }, [file, type]);

  function toggleChapter(idx: number) {
    setSelectedChapters((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }

  function toggleAll(select: boolean) {
    setSelectedChapters(select ? new Set(chapters.map((c) => c.index)) : new Set());
  }

  async function submit() {
    if (!title.trim()) { setError("Please enter a title."); return; }
    setLoading(true);
    setError("");

    const opts = {
      minHskLevel: minHsk,
      minTocflLevel: minTocfl,
      includeUnclassified,
      ...(chapters.length > 0 && {
        selectedChapterIndices: [...selectedChapters].sort((a, b) => a - b),
      }),
    };

    try {
      let source;
      if (type === "text") {
        if (!text.trim()) { setError("Please paste some text."); return; }
        source = await ingestText(title, text, opts);
      } else if (type === "youtube") {
        if (!url.trim()) { setError("Please enter a URL."); return; }
        source = await ingestYoutube(title, url, opts);
      } else if (type === "pdf" || type === "epub") {
        if (!file) { setError("Please select a file."); return; }
        if (chapters.length > 0 && selectedChapters.size === 0) {
          setError("Please select at least one chapter."); return;
        }
        source = await ingestFile(type, title, file, opts);
      } else { return; }
      router.push(`/library/${source.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500";

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 dark:text-white">Import New Source</h1>

      {/* Type selector */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => { setType(t.id); setError(""); setFile(null); setChapters([]); }}
            className={`p-4 rounded-xl border-2 text-left transition-all
              ${type === t.id
                ? "border-red-500 bg-red-50 dark:bg-red-950"
                : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-900"
              }`}
          >
            <div className="text-2xl mb-1">{t.icon}</div>
            <div className="font-semibold text-sm dark:text-white">{t.label}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.desc}</div>
          </button>
        ))}
      </div>

      {type && (
        <div className="space-y-5">
          {/* Main input fields */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-200">Title</label>
              <input className={inputCls} placeholder="e.g. 紅樓夢 Chapter 1" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            {type === "text" && (
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-200">Chinese Text</label>
                <textarea
                  className={`${inputCls} h-48 resize-y cjk`}
                  placeholder="貼上繁體中文文字..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{text.length} characters</p>
              </div>
            )}

            {type === "youtube" && (
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-200">YouTube URL</label>
                <input className={inputCls} placeholder="https://www.youtube.com/watch?v=..." value={url} onChange={(e) => setUrl(e.target.value)} />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Must have Traditional Chinese captions (zh-TW or zh-Hant).</p>
              </div>
            )}

            {(type === "pdf" || type === "epub") && (
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-200">{type.toUpperCase()} File</label>
                {file ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <span className="text-sm text-gray-700 dark:text-gray-200 flex-1 truncate">{file.name}</span>
                    <button
                      onClick={() => { setFile(null); setChapters([]); setSelectedChapters(new Set()); setError(""); }}
                      className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                      title="Remove file"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <input
                    type="file"
                    accept={type === "pdf" ? ".pdf" : ".epub"}
                    className="block text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:py-1.5 file:px-4 file:rounded file:border-0 file:bg-red-50 dark:file:bg-red-950 file:text-red-700 dark:file:text-red-400 file:text-sm file:cursor-pointer"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                )}
              </div>
            )}
          </div>

          {/* Chapter selection (EPUB / PDF only) */}
          {(type === "pdf" || type === "epub") && file && (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold dark:text-white">
                  {type === "epub" ? "Chapters" : "Sections"}
                </h2>
                {chaptersLoading ? (
                  <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                    <span className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin inline-block" />
                    Scanning…
                  </span>
                ) : chapters.length > 0 ? (
                  <div className="flex gap-2 text-xs">
                    <button onClick={() => toggleAll(true)} className="text-red-600 dark:text-red-400 hover:underline">All</button>
                    <span className="text-gray-300 dark:text-gray-700">·</span>
                    <button onClick={() => toggleAll(false)} className="text-gray-500 dark:text-gray-400 hover:underline">None</button>
                    <span className="text-gray-400 dark:text-gray-500 ml-1">{selectedChapters.size}/{chapters.length} selected</span>
                  </div>
                ) : null}
              </div>

              {/* While scanning: offer to skip waiting and import everything */}
              {chaptersLoading && (
                <div className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Wait to pick specific chapters, or import all now.
                  </p>
                  <button
                    onClick={() => { setChapters([]); setSelectedChapters(new Set()); submit(); }}
                    className="ml-3 flex-shrink-0 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Import All Now
                  </button>
                </div>
              )}

              {!chaptersLoading && chapters.length === 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500">No chapters detected — the whole file will be processed.</p>
              )}

              {chapters.length > 0 && (
                <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                  {chapters.map((ch) => (
                    <label
                      key={ch.index}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                        selectedChapters.has(ch.index)
                          ? "bg-red-50 dark:bg-red-950/50"
                          : "hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedChapters.has(ch.index)}
                        onChange={() => toggleChapter(ch.index)}
                        className="accent-red-600 w-4 h-4 flex-shrink-0"
                      />
                      <span className="text-sm cjk flex-1 truncate dark:text-gray-200">{ch.title}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                        {ch.char_count.toLocaleString()} chars
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Vocabulary level filters */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold dark:text-white">Vocabulary filters</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 -mt-2">
              Only create flashcards for words at or above these levels. Useful if you already know basic vocabulary.
            </p>

            <LevelSelect label="Minimum HSK level" prefix="HSK " value={minHsk} onChange={setMinHsk} />
            <LevelSelect label="Minimum TOCFL level" prefix="TOCFL " value={minTocfl} onChange={setMinTocfl} />

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeUnclassified}
                onChange={(e) => setIncludeUnclassified(e.target.checked)}
                className="accent-red-600 w-4 h-4"
              />
              <div>
                <span className="text-sm font-medium dark:text-gray-200">Include unclassified words</span>
                <p className="text-xs text-gray-400 dark:text-gray-500">Words not found in HSK or TOCFL — often proper nouns or literary vocabulary.</p>
              </div>
            </label>
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            onClick={submit}
            disabled={loading}
            className="w-full bg-red-600 text-white rounded-lg py-2.5 font-semibold text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Processing…" : chaptersLoading ? "Import All Chapters" : "Import & Generate Flashcards"}
          </button>
        </div>
      )}
    </div>
  );
}
