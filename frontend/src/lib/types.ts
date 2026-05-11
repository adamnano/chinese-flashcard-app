export type SourceType = "pdf" | "epub" | "youtube" | "text";
export type SourceStatus = "pending" | "processing" | "done" | "error";

export interface Source {
  id: number;
  title: string;
  source_type: SourceType;
  origin: string | null;
  created_at: string;
  word_count: number;
  status: SourceStatus;
  error_msg: string | null;
}

export interface Chapter {
  id: number;
  source_id: number;
  title: string;
  sequence: number;
  word_count: number;
}

export interface SourceDetail extends Source {
  chapters: Chapter[];
}

export interface Flashcard {
  id: number;
  word_id: number;
  source_id: number | null;
  traditional: string;
  simplified: string | null;
  pinyin: string | null;
  contextual_meaning: string;
  base_meaning: string | null;
  example_sentence: string | null;
  hsk_level: number | null;
  tocfl_level: number | null;
  tocfl_category: string | null;
  created_at: string;
  repetitions: number;
  easiness: number;
  interval: number;
  next_review: string;
  is_suspended: boolean;
}

export interface WordOccurrence {
  word_id: number;
  traditional: string;
  simplified: string | null;
  pinyin: string | null;
  hsk_level: number | null;
  tocfl_level: number | null;
  tocfl_category: string | null;
  count: number;
  context_snippet: string | null;
}

export interface ReviewFilter {
  source_ids?: number[];
  hsk_levels?: number[];
  tocfl_levels?: number[];
  limit?: number;
}

export interface SessionOut {
  session_id: number;
  total_due: number;
  card: Flashcard | null;
}

export interface SessionSummary {
  session_id: number;
  cards_reviewed: number;
  cards_correct: number;
  accuracy_pct: number;
  ended_at: string;
}

export interface AnswerOut {
  next_card: Flashcard | null;
  cards_remaining: number;
  session_summary: SessionSummary | null;
}

export interface DueCount {
  due_today: number;
  due_this_week: number;
}

export interface LevelCount {
  level: number | null;
  count: number;
}

export interface DailyReview {
  day: string;
  count: number;
}

export interface Stats {
  total_cards: number;
  due_today: number;
  mastered_cards: number;
  streak_days: number;
  hsk_distribution: LevelCount[];
  tocfl_distribution: LevelCount[];
  daily_reviews: DailyReview[];
}

export interface SourceStats {
  source_id: number;
  title: string;
  total_cards: number;
  mastered_cards: number;
  due_today: number;
}

export interface IngestStatus {
  source_id: number;
  status: SourceStatus;
  word_count: number;
  error_msg: string | null;
}
