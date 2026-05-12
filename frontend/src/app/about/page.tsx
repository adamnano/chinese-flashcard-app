import { Playfair_Display } from "next/font/google";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
});

// ─── Pipeline steps ───────────────────────────────────────────────────────────
const PIPELINE = [
  { n: "01", icon: "📥", label: "Input",     sub: "PDF · EPUB · YouTube · Text" },
  { n: "02", icon: "📄", label: "Extract",   sub: "Chapters · filter noise" },
  { n: "03", icon: "🔄", label: "Normalise", sub: "Simplified → Traditional" },
  { n: "04", icon: "✂️", label: "Tokenise",  sub: "jieba + userdict" },
  { n: "05", icon: "🔗", label: "Re-merge",  sub: "Recover compounds" },
  { n: "06", icon: "🏷️", label: "Classify",  sub: "HSK + TOCFL levels" },
  { n: "07", icon: "🤖", label: "AI Meaning",sub: "GPT-4.1-mini batch" },
  { n: "08", icon: "📇", label: "Flashcard", sub: "SM-2 scheduling" },
];

// ─── Tokenisation walkthrough ─────────────────────────────────────────────────
type TType = "raw" | "ok" | "bad" | "stop" | "merged" | "uncertain";
interface Token { text: string; type: TType }

const TOKEN_STEPS: { label: string; note: string; tokens: Token[] }[] = [
  {
    label: "Input sentence",
    note: "Raw Traditional Chinese text",
    tokens: [{ text: "臺灣的高山烏龍茶享譽全球", type: "raw" }],
  },
  {
    label: "After jieba.cut()",
    note: "jieba doesn't recognise 臺灣 — attaches 的 to the preceding char",
    tokens: [
      { text: "臺", type: "uncertain" },
      { text: "灣的", type: "bad" },
      { text: "高山", type: "ok" },
      { text: "烏龍茶", type: "ok" },
      { text: "享譽", type: "ok" },
      { text: "全球", type: "ok" },
    ],
  },
  {
    label: "_split_trailing_particles()",
    note: "Detach structural particles (的·地·得) fused to a preceding character",
    tokens: [
      { text: "臺", type: "uncertain" },
      { text: "灣", type: "uncertain" },
      { text: "的", type: "stop" },
      { text: "高山", type: "ok" },
      { text: "烏龍茶", type: "ok" },
      { text: "享譽", type: "ok" },
      { text: "全球", type: "ok" },
    ],
  },
  {
    label: "_remerge_single_char_runs()",
    note: "臺+灣 → 臺灣 (4→3→2 gram window, longest match wins)",
    tokens: [
      { text: "臺灣", type: "merged" },
      { text: "的", type: "stop" },
      { text: "高山", type: "ok" },
      { text: "烏龍茶", type: "ok" },
      { text: "享譽", type: "ok" },
      { text: "全球", type: "ok" },
    ],
  },
  {
    label: "Filter + final tokens",
    note: "Stopwords removed — 5 clean vocabulary items passed to the LLM",
    tokens: [
      { text: "臺灣", type: "merged" },
      { text: "高山", type: "ok" },
      { text: "烏龍茶", type: "ok" },
      { text: "享譽", type: "ok" },
      { text: "全球", type: "ok" },
    ],
  },
];

const TOKEN_STYLES: Record<TType, string> = {
  raw:       "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700",
  ok:        "bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800",
  bad:       "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800 line-through",
  stop:      "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 border border-dashed border-gray-300 dark:border-gray-700 line-through",
  merged:    "bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border-2 border-emerald-400 dark:border-emerald-600 font-bold",
  uncertain: "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700",
};

// ─── SM-2 intervals ───────────────────────────────────────────────────────────
const SM2_REVIEWS = [
  { n: 1, days: 1,   label: "Day 1" },
  { n: 2, days: 6,   label: "Day 6" },
  { n: 3, days: 16,  label: "Day 16" },
  { n: 4, days: 40,  label: "Day 40" },
  { n: 5, days: 100, label: "Day 100" },
];

// ─── HSK / TOCFL data ─────────────────────────────────────────────────────────
const HSK = [
  { level: 1, words: 500,   label: "HSK 1", color: "bg-green-400" },
  { level: 2, words: 800,   label: "HSK 2", color: "bg-green-500" },
  { level: 3, words: 1100,  label: "HSK 3", color: "bg-blue-400" },
  { level: 4, words: 1500,  label: "HSK 4", color: "bg-blue-500" },
  { level: 5, words: 2500,  label: "HSK 5", color: "bg-purple-400" },
  { level: 6, words: 5000,  label: "HSK 6", color: "bg-purple-600" },
  { level: 7, words: 11000, label: "HSK 7–9", color: "bg-red-500" },
];

const TOCFL = [
  { level: "1–2", words: 500,  label: "Novice",    color: "bg-lime-400" },
  { level: "3",   words: 1500, label: "Band A",    color: "bg-sky-400" },
  { level: "4",   words: 2400, label: "Band B",    color: "bg-sky-600" },
  { level: "5",   words: 4700, label: "Band C",    color: "bg-violet-500" },
  { level: "6",   words: 7500, label: "Advanced",  color: "bg-violet-700" },
  { level: "7",   words: 14000,label: "Expert",    color: "bg-orange-500" },
];

// ─── Tech stack ───────────────────────────────────────────────────────────────
const STACK = [
  { label: "Frontend",    value: "Next.js 14 · TypeScript · Tailwind CSS" },
  { label: "Backend",     value: "Python FastAPI · SQLAlchemy 2" },
  { label: "Database",    value: "PostgreSQL 16 (Docker)" },
  { label: "Tokeniser",   value: "jieba (Chinese word segmentation)" },
  { label: "Normaliser",  value: "OpenCC s2t (Simplified → Traditional)" },
  { label: "Vocab data",  value: "HSK 3.0 (krmanik) · TOCFL (PSeitz)" },
  { label: "LLM",         value: "OpenAI GPT-4.1-mini (batched, 3 concurrent)" },
  { label: "SRS",         value: "SM-2 algorithm (SuperMemo 2)" },
];

// ─────────────────────────────────────────────────────────────────────────────
export default function AboutPage() {
  const maxSM2 = SM2_REVIEWS[SM2_REVIEWS.length - 1].days;
  const maxHsk = HSK[HSK.length - 1].words;
  const maxTocfl = TOCFL[TOCFL.length - 1].words;

  return (
    <div className={`${playfair.variable} max-w-4xl mx-auto pb-20`}>

      {/* ── Hero ── */}
      <div className="mb-16 border-b border-gray-200 dark:border-gray-800 pb-10">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-red-500 dark:text-red-400 mb-4">
          How it works
        </p>
        <h1 className="font-[family-name:var(--font-playfair)] text-5xl font-bold leading-tight text-gray-900 dark:text-gray-50 mb-5">
          From a sentence to<br />
          <span className="italic text-red-600 dark:text-red-400">a flashcard in seconds.</span>
        </h1>
        <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl leading-relaxed">
          This app turns Traditional Chinese text — from a PDF, an ebook, a YouTube video,
          or plain paste — into spaced-repetition flashcards with context-aware meanings.
          Below is every step of the journey.
        </p>
      </div>

      {/* ── Pipeline overview ── */}
      <section className="mb-20">
        <SectionLabel n="00" />
        <h2 className="font-[family-name:var(--font-playfair)] text-3xl font-bold mb-2 dark:text-white">
          The full pipeline
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm">Seven stages, end to end.</p>

        {/*
          7-column grid: box | arrow | box | arrow | box | arrow | box
          Row 1: 01 → 02 → 03 → 04
          Turn:  (6 empty cols)        ↓
          Row 2: (2 empty) 07 ← 06 ← 05   ← 05 sits under 04
        */}
        <div
          className="grid items-center"
          style={{ gridTemplateColumns: "1fr auto 1fr auto 1fr auto 1fr" }}
        >
          {/* ── Row 1 ── */}
          <PipelineBox step={PIPELINE[0]} />
          <PipelineArrow dir="right" />
          <PipelineBox step={PIPELINE[1]} />
          <PipelineArrow dir="right" />
          <PipelineBox step={PIPELINE[2]} />
          <PipelineArrow dir="right" />
          <PipelineBox step={PIPELINE[3]} />

          {/* ── Turn: 6 empties + ↓ in col 7 ── */}
          <div className="col-span-6" />
          <div className="flex justify-center py-1"><PipelineArrow dir="down" /></div>

          {/* ── Row 2: 08 ← 07 ← 06 ← 05  (05 sits under 04) ── */}
          <PipelineBox step={PIPELINE[7]} />
          <PipelineArrow dir="left" />
          <PipelineBox step={PIPELINE[6]} />
          <PipelineArrow dir="left" />
          <PipelineBox step={PIPELINE[5]} />
          <PipelineArrow dir="left" />
          <PipelineBox step={PIPELINE[4]} />
        </div>
      </section>

      {/* ── Input formats ── */}
      <section className="mb-20">
        <SectionLabel n="01" />
        <h2 className="font-[family-name:var(--font-playfair)] text-3xl font-bold mb-2 dark:text-white">Input</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm">
          Any of these four formats flow into the same pipeline.
        </p>
        <div className="grid grid-cols-2 gap-4">
          {[
            { icon: "📄", name: "PDF", desc: "PyMuPDF extracts text page-by-page. Chapter headings are detected via font-size heuristics; long documents without headings are chunked at 20 pages." },
            { icon: "📖", name: "EPUB", desc: "ebooklib reads the spine in reading order. Chapter titles come from the book's table of contents (TOC/NCX). Front matter, copyright pages, navigation files, and chapters with fewer than 50 Chinese characters are automatically skipped. Very short chapters are merged into the next one." },
            { icon: "▶️", name: "YouTube", desc: "youtube-transcript-api fetches captions, preferring zh-TW → zh-Hant → zh. Entries are grouped into 5-minute chapters by timestamp." },
            { icon: "📝", name: "Plain text", desc: "Pasted text is split on double newlines and grouped into 50-paragraph sections. No parsing overhead — instant start." },
          ].map((f) => (
            <div key={f.name} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
              <div className="text-3xl mb-3">{f.icon}</div>
              <div className="font-semibold text-gray-900 dark:text-white mb-1">{f.name}</div>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Tokenisation ── */}
      <section className="mb-20">
        <SectionLabel n="02–04" />
        <h2 className="font-[family-name:var(--font-playfair)] text-3xl font-bold mb-2 dark:text-white">
          Tokenisation
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-3 text-sm max-w-2xl leading-relaxed">
          Chinese has no spaces between words, so finding where one word ends and the next
          begins is non-trivial. The pipeline uses three passes to handle Traditional Chinese
          correctly — watch how <span className="cjk font-medium text-gray-700 dark:text-gray-300">臺灣的高山烏龍茶享譽全球</span> flows
          through each stage.
        </p>

        <div className="space-y-4">
          {TOKEN_STEPS.map((step, si) => (
            <div
              key={si}
              className={`rounded-2xl border p-5 ${
                si === TOKEN_STEPS.length - 1
                  ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30"
                  : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
              }`}
            >
              <div className="flex items-baseline gap-3 mb-3">
                <span className="text-xs font-mono font-semibold text-gray-400 dark:text-gray-500 shrink-0">
                  step {si + 1}
                </span>
                <span className="font-semibold text-sm text-gray-800 dark:text-gray-200 font-mono">
                  {step.label}
                </span>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">{step.note}</p>
              <div className="flex flex-wrap gap-2">
                {step.tokens.map((tok, ti) => (
                  <span
                    key={ti}
                    className={`cjk text-base px-3 py-1 rounded-lg ${TOKEN_STYLES[tok.type]}`}
                  >
                    {tok.text}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-3 text-xs">
          {(Object.entries(TOKEN_STYLES) as [TType, string][])
            .filter(([k]) => k !== "raw")
            .map(([k, cls]) => (
              <span key={k} className={`cjk px-2 py-0.5 rounded ${cls}`}>
                {k === "ok" && "multi-char word"}
                {k === "bad" && "bad token"}
                {k === "stop" && "stopword"}
                {k === "merged" && "merged compound"}
                {k === "uncertain" && "uncertain single char"}
              </span>
            ))}
        </div>

        {/* Uncertain char explanation */}
        <div className="mt-6 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl p-5">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-300 mb-1">What about uncertain single characters?</p>
          <p className="text-sm text-amber-800 dark:text-amber-400 leading-relaxed">
            A character like <span className="cjk font-bold">臺</span> is usually a bound morpheme — it only appears
            as part of compounds like <span className="cjk">臺灣</span> or <span className="cjk">舞臺</span>.
            But in rare contexts it carries standalone meaning (e.g. <span className="italic">&ldquo;this platform is high&rdquo;</span>).
            Rather than dropping or keeping it blindly, the app passes it to the LLM with an
            <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">uncertain=true</code> flag.
            Only if GPT confirms standalone meaning is a flashcard created.
          </p>
        </div>
      </section>

      {/* ── Difficulty levels ── */}
      <section className="mb-20">
        <SectionLabel n="05" />
        <h2 className="font-[family-name:var(--font-playfair)] text-3xl font-bold mb-2 dark:text-white">
          Difficulty levels
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm max-w-2xl leading-relaxed">
          Every word is looked up in two vocabulary frameworks. HSK 3.0 (2021) is the
          mainland standard; TOCFL is Taiwan&apos;s official benchmark. Together they cover
          ~25,000 headwords loaded into memory at startup.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* HSK */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">HSK 3.0 (2021 standard)</h3>
            <div className="space-y-2">
              {HSK.map((h) => (
                <div key={h.level} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400 w-14 shrink-0">{h.label}</span>
                  <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-3 rounded-full ${h.color}`}
                      style={{ width: `${(h.words / maxHsk) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500 w-16 text-right shrink-0">
                    ~{h.words.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* TOCFL */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">TOCFL (Taiwan standard)</h3>
            <div className="space-y-2">
              {TOCFL.map((t) => (
                <div key={t.level} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400 w-14 shrink-0">
                    L{t.level} <span className="text-gray-300 dark:text-gray-600">·</span> {t.label}
                  </span>
                  <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-3 rounded-full ${t.color}`}
                      style={{ width: `${(t.words / maxTocfl) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500 w-16 text-right shrink-0">
                    ~{t.words.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── AI Meaning ── */}
      <section className="mb-20">
        <SectionLabel n="06" />
        <h2 className="font-[family-name:var(--font-playfair)] text-3xl font-bold mb-2 dark:text-white">
          AI-powered meanings
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm max-w-2xl leading-relaxed">
          A generic dictionary gloss often misses the point. <span className="cjk">推手</span> literally means
          &ldquo;pushing hands&rdquo; — but in a text about Tai Chi it means something precise and
          contextual. GPT-4.1-mini is sent every word alongside a ~80-character context
          snippet, and returns three things:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            {
              icon: "💬",
              title: "Direct translation",
              desc: "1–5 words. The core meaning as used in this specific text. Shown immediately when you flip a card.",
              example: '"patience"',
            },
            {
              icon: "🔍",
              title: "Context note",
              desc: "One sentence explaining the word's role in this text. Hidden behind a button — revealed on demand.",
              example: '"Used to describe the patience tea farmers need at high altitude."',
            },
            {
              icon: "✍️",
              title: "Example sentence",
              desc: "A freshly-generated Traditional Chinese sentence showing the word in a similar situation.",
              example: "農夫用耐心照顧山上的茶樹。",
            },
          ].map((item) => (
            <div key={item.title} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
              <div className="text-2xl mb-2">{item.icon}</div>
              <div className="font-semibold text-sm text-gray-900 dark:text-white mb-1">{item.title}</div>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-3">{item.desc}</p>
              <p className="text-xs bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2 text-gray-600 dark:text-gray-300 cjk italic">{item.example}</p>
            </div>
          ))}
        </div>

        {/* Flashcard gating callout */}
        <div className="bg-gray-900 dark:bg-gray-950 text-gray-100 rounded-2xl p-6 border border-gray-700">
          <p className="text-xs font-semibold tracking-widest uppercase text-gray-400 mb-2">Flashcard gating</p>
          <p className="text-sm leading-relaxed text-gray-300">
            GPT also returns a <code className="bg-gray-800 px-1.5 py-0.5 rounded text-red-300">create_flashcard: bool</code> for
            every word. For <span className="text-white font-medium">confirmed</span> vocabulary (in HSK/TOCFL), the
            default is <span className="text-green-400">true</span> unless GPT finds a reason to veto — e.g. an
            untranslatable proper noun. For <span className="text-white font-medium">uncertain</span> single characters,
            the default is <span className="text-red-400">false</span> — GPT must explicitly confirm standalone meaning.
            If the API call fails, confirmed words fall back to the dictionary gloss; uncertain chars are silently dropped.
          </p>
        </div>
      </section>

      {/* ── SM-2 ── */}
      <section className="mb-20">
        <SectionLabel n="07" />
        <h2 className="font-[family-name:var(--font-playfair)] text-3xl font-bold mb-2 dark:text-white">
          Spaced repetition
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm max-w-2xl leading-relaxed">
          Reviews are scheduled with the SM-2 algorithm — the same method behind Anki and
          SuperMemo. Rate your recall 0–5 after each card; the algorithm decides when you
          should see it next. Perfect recall stretches the interval; forgetting resets it.
        </p>

        {/* Interval chart */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 mb-6">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-5">
            Interval growth (quality = 5, EF = 2.5)
          </p>
          <div className="flex items-end gap-4 h-32">
            {SM2_REVIEWS.map((r) => (
              <div key={r.n} className="flex flex-col items-center gap-1 flex-1">
                <span className="text-xs font-bold text-red-600 dark:text-red-400">{r.days}d</span>
                <div
                  className="w-full bg-red-400 dark:bg-red-600 rounded-t-md"
                  style={{ height: `${(r.days / maxSM2) * 100}%`, minHeight: 4 }}
                />
                <span className="text-[10px] text-gray-400 dark:text-gray-500">#{r.n}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
            By review #5 a well-known word comes back after ~3 months. A card is considered
            <span className="text-green-600 dark:text-green-400 font-medium"> mastered</span> once its interval reaches 21 days.
          </p>
        </div>

        {/* Rating guide */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Again", color: "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 border-red-300 dark:border-red-800", note: "Reset · quality 1" },
            { label: "Hard",  color: "bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-300 border-orange-200 dark:border-orange-800", note: "Slow · quality 3" },
            { label: "Good",  color: "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800", note: "Normal · quality 4" },
            { label: "Easy",  color: "bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-400 border-green-300 dark:border-green-800", note: "Fast · quality 5" },
          ].map(({ label, color, note }) => (
            <div key={label} className={`rounded-xl border p-3 text-center ${color}`}>
              <div className="text-sm font-semibold leading-tight mb-1">{label}</div>
              <div className="text-[10px] opacity-60">{note}</div>
            </div>
          ))}
        </div>

        {/* Formula */}
        <div className="mt-6 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 font-mono text-xs text-gray-600 dark:text-gray-400 space-y-1">
          <div className="text-[10px] font-sans font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">SM-2 formula</div>
          <div>EF&apos; = EF + 0.1 − (5 − q) × (0.08 + (5 − q) × 0.02)</div>
          <div>EF<sub>min</sub> = 1.3</div>
          <div>interval(n=0) = 1 day · interval(n=1) = 6 days</div>
          <div>interval(n≥2) = round(prev_interval × EF)</div>
        </div>
      </section>

      {/* ── Privacy ── */}
      <section className="mb-20">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 flex gap-5 items-start">
          <span className="text-3xl">🔒</span>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Your data stays local</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              Everything is stored in a local PostgreSQL database. The only external calls are
              to OpenAI for meaning disambiguation — those include the Chinese word and its
              ~80-character context snippet only. No account, no analytics, no tracking.
            </p>
          </div>
        </div>
      </section>

      {/* ── Tech stack ── */}
      <section>
        <SectionLabel n="—" />
        <h2 className="font-[family-name:var(--font-playfair)] text-3xl font-bold mb-6 dark:text-white">
          Built with
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {STACK.map(({ label, value }) => (
            <div key={label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
              <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">{label}</div>
              <div className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{value}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SectionLabel({ n }: { n: string }) {
  return (
    <div className="flex items-center gap-3 mb-2">
      <span className="font-mono text-xs font-bold text-red-400 dark:text-red-500 tracking-widest">{n}</span>
      <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
    </div>
  );
}

function PipelineBox({ step }: { step: typeof PIPELINE[0] }) {
  return (
    <div className="flex flex-col items-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-4 w-full shadow-sm">
      <span className="text-xs font-mono text-gray-300 dark:text-gray-600 mb-1">{step.n}</span>
      <span className="text-2xl mb-2">{step.icon}</span>
      <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 text-center leading-snug">{step.label}</span>
      <span className="text-[10px] text-gray-400 dark:text-gray-500 text-center mt-1 leading-snug">{step.sub}</span>
    </div>
  );
}

function PipelineArrow({ dir }: { dir: "right" | "left" | "down" }) {
  if (dir === "down") {
    return (
      <div className="flex justify-center items-center h-8 text-gray-300 dark:text-gray-600">
        <svg width="16" height="24" viewBox="0 0 16 24" fill="none">
          <path d="M8 0v18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M2 13l6 8 6-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    );
  }
  return (
    <div className="flex items-center px-1 text-gray-300 dark:text-gray-600">
      <svg width="24" height="16" viewBox="0 0 24 16" fill="none">
        {dir === "right" ? (
          <>
            <path d="M0 8h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M13 2l8 6-8 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </>
        ) : (
          <>
            <path d="M24 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M11 2L3 8l8 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </>
        )}
      </svg>
    </div>
  );
}
