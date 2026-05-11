import type {
  Source, SourceDetail, Chapter, Flashcard, WordOccurrence,
  ReviewFilter, SessionOut, AnswerOut, DueCount, Stats, SourceStats, IngestStatus,
} from "./types";

const BASE = "http://localhost:8000/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// --- Sources ---
export const getSources = () => request<Source[]>("/sources");
export const getSource = (id: number) => request<SourceDetail>(`/sources/${id}`);
export const deleteSource = (id: number) =>
  fetch(`${BASE}/sources/${id}`, { method: "DELETE" });
export const getChapters = (sourceId: number) =>
  request<Chapter[]>(`/sources/${sourceId}/chapters`);
export const getChapterWords = (sourceId: number, chapterId: number, limit = 100, offset = 0) =>
  request<WordOccurrence[]>(
    `/sources/${sourceId}/chapters/${chapterId}/words?limit=${limit}&offset=${offset}`
  );

// --- Ingest ---
export const ingestText = (title: string, text: string) =>
  request<Source>("/ingest/text", {
    method: "POST",
    body: JSON.stringify({ title, text }),
  });

export const ingestYoutube = (title: string, url: string) =>
  request<Source>("/ingest/youtube", {
    method: "POST",
    body: JSON.stringify({ title, url }),
  });

export const ingestFile = async (
  type: "pdf" | "epub",
  title: string,
  file: File
): Promise<Source> => {
  const form = new FormData();
  form.append("title", title);
  form.append("file", file);
  const res = await fetch(`${BASE}/ingest/${type}`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json();
};

export const getIngestStatus = (sourceId: number) =>
  request<IngestStatus>(`/ingest/${sourceId}/status`);

// --- Flashcards ---
export const getFlashcards = (params: {
  source_id?: number;
  hsk_level?: number;
  tocfl_level?: number;
  tocfl_category?: string;
  suspended?: boolean;
  limit?: number;
  offset?: number;
}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) q.set(k, String(v));
  });
  return request<Flashcard[]>(`/flashcards?${q}`);
};

export const getFlashcard = (id: number) => request<Flashcard>(`/flashcards/${id}`);

export const updateFlashcard = (id: number, body: { is_suspended?: boolean; contextual_meaning?: string }) =>
  request<Flashcard>(`/flashcards/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

// --- Review ---
export const getDueCount = (params?: { source_id?: number; hsk_level?: number }) => {
  const q = new URLSearchParams();
  if (params?.source_id) q.set("source_id", String(params.source_id));
  if (params?.hsk_level) q.set("hsk_level", String(params.hsk_level));
  return request<DueCount>(`/review/due-count?${q}`);
};

export const startReviewSession = (filter: ReviewFilter) =>
  request<SessionOut>("/review/session", {
    method: "POST",
    body: JSON.stringify({ filter }),
  });

export const submitReviewAnswer = (sessionId: number, flashcardId: number, quality: number) =>
  request<AnswerOut>("/review/answer", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, flashcard_id: flashcardId, quality }),
  });

// --- Stats ---
export const getStats = () => request<Stats>("/stats");
export const getSourceStats = () => request<SourceStats[]>("/stats/sources");
