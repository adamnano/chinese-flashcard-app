"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ingestText, ingestYoutube, ingestFile } from "@/lib/api";

type InputType = "text" | "youtube" | "pdf" | "epub";

const TYPES: { id: InputType; label: string; desc: string; icon: string }[] = [
  { id: "text", label: "Text Paste", desc: "Paste Traditional Chinese text directly", icon: "📝" },
  { id: "youtube", label: "YouTube", desc: "Enter a YouTube URL with Chinese captions", icon: "▶️" },
  { id: "pdf", label: "PDF", desc: "Upload a PDF file", icon: "📄" },
  { id: "epub", label: "EPUB", desc: "Upload an EPUB ebook", icon: "📖" },
];

export default function ImportPage() {
  const router = useRouter();
  const [type, setType] = useState<InputType | null>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!title.trim()) { setError("Please enter a title."); return; }
    setLoading(true);
    setError("");
    try {
      let source;
      if (type === "text") {
        if (!text.trim()) { setError("Please paste some text."); return; }
        source = await ingestText(title, text);
      } else if (type === "youtube") {
        if (!url.trim()) { setError("Please enter a URL."); return; }
        source = await ingestYoutube(title, url);
      } else if (type === "pdf" || type === "epub") {
        if (!file) { setError("Please select a file."); return; }
        source = await ingestFile(type, title, file);
      } else {
        return;
      }
      router.push(`/library/${source.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Import New Source</h1>

      {/* Step 1: choose type */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => { setType(t.id); setError(""); }}
            className={`p-4 rounded-xl border-2 text-left transition-all
              ${type === t.id
                ? "border-red-500 bg-red-50"
                : "border-gray-200 hover:border-gray-300 bg-white"
              }`}
          >
            <div className="text-2xl mb-1">{t.icon}</div>
            <div className="font-semibold text-sm">{t.label}</div>
            <div className="text-xs text-gray-500 mt-0.5">{t.desc}</div>
          </button>
        ))}
      </div>

      {/* Step 2: input */}
      {type && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="e.g. 紅樓夢 Chapter 1"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {type === "text" && (
            <div>
              <label className="block text-sm font-medium mb-1">Chinese Text</label>
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm h-48 resize-y cjk"
                placeholder="貼上繁體中文文字..."
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">{text.length} characters</p>
            </div>
          )}

          {type === "youtube" && (
            <div>
              <label className="block text-sm font-medium mb-1">YouTube URL</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="https://www.youtube.com/watch?v=..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">
                The video must have Traditional Chinese captions (zh-TW or zh-Hant).
              </p>
            </div>
          )}

          {(type === "pdf" || type === "epub") && (
            <div>
              <label className="block text-sm font-medium mb-1">
                {type.toUpperCase()} File
              </label>
              <input
                type="file"
                accept={type === "pdf" ? ".pdf" : ".epub"}
                className="block text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-4 file:rounded file:border-0 file:bg-red-50 file:text-red-700 file:text-sm file:cursor-pointer"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>
          )}

          <button
            onClick={submit}
            disabled={loading}
            className="w-full bg-red-600 text-white rounded-lg py-2.5 font-semibold text-sm
              hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Processing…" : "Import & Generate Flashcards"}
          </button>
        </div>
      )}
    </div>
  );
}
