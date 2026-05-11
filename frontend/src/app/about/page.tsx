export default function AboutPage() {
  return (
    <div className="max-w-3xl prose prose-gray">
      <h1 className="text-2xl font-bold mb-2">About</h1>
      <p className="text-gray-500 mb-8">
        How this app processes text, generates flashcards, and schedules reviews.
      </p>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Supported Input Formats</h2>
        <ul className="space-y-2 text-sm text-gray-700">
          <li><strong>PDF</strong> — Text is extracted page-by-page using PyMuPDF. Chapter headings are detected automatically. Long documents are split into 20-page chunks if no headings are found.</li>
          <li><strong>EPUB</strong> — Each spine item (chapter file) is parsed as HTML using ebooklib + BeautifulSoup. Titles come from chapter heading tags.</li>
          <li><strong>YouTube</strong> — Captions are fetched via youtube-transcript-api, preferring zh-TW → zh-Hant → zh. Transcript entries are grouped into 5-minute chapters by timestamp.</li>
          <li><strong>Plain Text</strong> — Pasted text is split on double newlines and grouped into sections of 50 paragraphs.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">NLP Pipeline</h2>
        <ol className="space-y-3 text-sm text-gray-700 list-decimal list-inside">
          <li>
            <strong>Normalization</strong> — Text is converted to Traditional Chinese using OpenCC (s2t mode). This is idempotent: already-Traditional text passes through unchanged.
          </li>
          <li>
            <strong>Tokenization</strong> — jieba segments the text in precision mode (<code>cut_all=False</code>). Both HSK 3.0 and TOCFL headwords are pre-loaded into jieba&apos;s user dictionary at startup so it recognises Traditional Chinese compounds before segmentation begins.
          </li>
          <li>
            <strong>Compound re-merge</strong> — After jieba&apos;s initial cut, consecutive single-character CJK tokens are scanned with a sliding window (4→3→2 characters). If joining them produces a word in the HSK/TOCFL vocabulary set, they are merged back into the compound. Example: jieba may emit 臺 + 灣 separately; this pass reassembles them into 臺灣.
          </li>
          <li>
            <strong>Filtering &amp; uncertain tokens</strong> — Stopwords, grammatical particles (的、了、嗎…), and punctuation are removed. Single-character tokens are split into two groups:
            <ul className="mt-1 ml-5 space-y-1 list-disc">
              <li><strong>Confirmed</strong> — the character appears as a standalone entry in HSK or TOCFL (e.g. 茶, 山). Included as a flashcard candidate.</li>
              <li><strong>Uncertain</strong> — the character is not a standalone vocabulary entry (e.g. 臺, 灣 in isolation). Passed to the LLM with a flag rather than dropped immediately.</li>
            </ul>
          </li>
          <li>
            <strong>Classification</strong> — Each token is looked up in in-memory HSK 3.0 and TOCFL dictionaries (loaded at server startup). Words are assigned a level (HSK 1–7 or TOCFL 1–7) and a topical category if available.
          </li>
        </ol>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">HSK 3.0 and TOCFL Levels</h2>
        <div className="grid grid-cols-2 gap-4 text-sm text-gray-700">
          <div>
            <h3 className="font-medium mb-1">HSK 3.0 (2021 standard)</h3>
            <ul className="space-y-1 text-xs">
              {[
                ["HSK 1", "~500 words, beginner"],
                ["HSK 2", "~800 words"],
                ["HSK 3", "~1,100 words"],
                ["HSK 4", "~1,500 words"],
                ["HSK 5", "~2,500 words"],
                ["HSK 6", "~5,000 words"],
                ["HSK 7-9", "~11,000 words, advanced"],
              ].map(([l, d]) => (
                <li key={l}><strong>{l}</strong>: {d}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-medium mb-1">TOCFL (Taiwan standard)</h3>
            <ul className="space-y-1 text-xs">
              {[
                ["Level 1–2", "Novice, ~500 words"],
                ["Level 3", "Band A, ~1,500 words"],
                ["Level 4", "Band B, ~2,400 words"],
                ["Level 5", "Band C, ~4,700 words"],
                ["Level 6", "Advanced, ~7,500 words"],
                ["Level 7", "Expert"],
              ].map(([l, d]) => (
                <li key={l}><strong>{l}</strong>: {d}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Context-Aware Translation &amp; Flashcard Gating (GPT-4.1-mini)</h2>
        <p className="text-sm text-gray-700 mb-2">
          Chinese words frequently carry multiple meanings depending on context. A generic dictionary gloss (e.g., &quot;推手 = pushing hands&quot;) may not reflect how a word is used in a specific book or video.
        </p>
        <p className="text-sm text-gray-700 mb-2">
          After tokenization, words are grouped into batches of 30 and sent to GPT-4.1-mini with their context snippets. The model returns three things per word:
        </p>
        <ul className="text-sm text-gray-700 space-y-1 mb-3 ml-4 list-disc">
          <li><strong>Contextual meaning</strong> — 1–2 sentences specific to how the word is used in this text, not a generic definition.</li>
          <li><strong>Example sentence</strong> — a natural Traditional Chinese sentence using the word in a similar way.</li>
          <li>
            <strong>create_flashcard</strong> — a boolean decision on whether the word deserves its own study card.
            For <em>confirmed</em> vocabulary (words in HSK/TOCFL), the default is yes unless GPT finds a reason to veto (noise, untranslatable proper noun, etc.).
            For <em>uncertain</em> single characters, the default is no — GPT must explicitly confirm standalone meaning.
            Example: 臺 flagged as uncertain might be confirmed if the context clearly shows it means &quot;platform&quot; or &quot;stage&quot;; it stays dropped if it&apos;s just a stray character or part of a compound the re-merge pass missed.
          </li>
        </ul>
        <p className="text-sm text-gray-700">
          Batches run concurrently (up to 3 at once) to reduce processing time. If GPT fails for a word, confirmed vocabulary falls back to the HSK/TOCFL gloss and is included; uncertain single chars are silently dropped.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Spaced Repetition (SM-2 Algorithm)</h2>
        <p className="text-sm text-gray-700 mb-2">
          Reviews are scheduled using the SM-2 algorithm. After each card you rate your recall from 0 (complete blackout) to 5 (perfect). The algorithm adjusts the next review date:
        </p>
        <ul className="text-sm text-gray-700 space-y-1 mb-3">
          <li><strong>Quality 0–2</strong>: Incorrect. Card resets to interval of 1 day.</li>
          <li><strong>Quality 3</strong>: Correct but hard. Interval increases slowly.</li>
          <li><strong>Quality 4–5</strong>: Correct. Interval increases by the ease factor (EF).</li>
        </ul>
        <p className="text-sm text-gray-700 font-mono bg-gray-50 rounded p-3 text-xs">
          EF&apos; = EF + 0.1 − (5 − quality) × (0.08 + (5 − quality) × 0.02)<br />
          EF ≥ 1.3 (minimum)<br />
          interval(n=0) = 1 day<br />
          interval(n=1) = 6 days<br />
          interval(n≥2) = round(interval × EF)
        </p>
        <p className="text-sm text-gray-700 mt-2">
          A card is considered &quot;mastered&quot; when its interval reaches 21 days or more.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Data Storage</h2>
        <p className="text-sm text-gray-700">
          All data is stored locally in a PostgreSQL database. Nothing is sent externally except OpenAI API calls for meaning disambiguation — those include the Chinese word and its context snippet only. No personal data is collected or transmitted.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Technology Stack</h2>
        <div className="grid grid-cols-2 gap-3 text-xs text-gray-600">
          {[
            ["Frontend", "Next.js 14, TypeScript, Tailwind CSS"],
            ["Backend", "Python FastAPI, SQLAlchemy"],
            ["Database", "PostgreSQL"],
            ["Tokenization", "jieba (Chinese segmentation)"],
            ["Normalization", "OpenCC (s2t Traditional Chinese)"],
            ["Vocabulary Data", "HSK 3.0 (krmanik), TOCFL (PSeitz)"],
            ["LLM", "OpenAI GPT-4.1-mini"],
            ["SRS Algorithm", "SM-2 (SuperMemo 2)"],
          ].map(([label, value]) => (
            <div key={label} className="bg-gray-50 rounded-lg p-2">
              <div className="font-semibold text-gray-700">{label}</div>
              <div>{value}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
