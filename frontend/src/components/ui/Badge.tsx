const HSK_COLORS: Record<number, string> = {
  1: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  2: "bg-green-200 text-green-900 dark:bg-green-800 dark:text-green-200",
  3: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  4: "bg-blue-200 text-blue-900 dark:bg-blue-800 dark:text-blue-200",
  5: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  6: "bg-purple-200 text-purple-900 dark:bg-purple-800 dark:text-purple-200",
  7: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

const TOCFL_COLORS: Record<number, string> = {
  1: "bg-lime-100 text-lime-800 dark:bg-lime-900 dark:text-lime-300",
  2: "bg-lime-200 text-lime-900 dark:bg-lime-800 dark:text-lime-200",
  3: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300",
  4: "bg-sky-200 text-sky-900 dark:bg-sky-800 dark:text-sky-200",
  5: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-300",
  6: "bg-violet-200 text-violet-900 dark:bg-violet-800 dark:text-violet-200",
  7: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
};

export function HskBadge({ level }: { level: number | null }) {
  if (!level) return null;
  return (
    <span className={`inline-block px-1.5 py-0.5 text-xs rounded font-medium ${HSK_COLORS[level] ?? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"}`}>
      HSK{level}
    </span>
  );
}

export function TocflBadge({ level }: { level: number | null }) {
  if (!level) return null;
  return (
    <span className={`inline-block px-1.5 py-0.5 text-xs rounded font-medium ${TOCFL_COLORS[level] ?? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"}`}>
      TOCFL{level}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    done: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    processing: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
    error: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    pending: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };
  return (
    <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${colors[status] ?? "bg-gray-100 dark:bg-gray-800"}`}>
      {status}
    </span>
  );
}
