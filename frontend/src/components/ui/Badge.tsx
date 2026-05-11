const HSK_COLORS: Record<number, string> = {
  1: "bg-green-100 text-green-800",
  2: "bg-green-200 text-green-900",
  3: "bg-blue-100 text-blue-800",
  4: "bg-blue-200 text-blue-900",
  5: "bg-purple-100 text-purple-800",
  6: "bg-purple-200 text-purple-900",
  7: "bg-red-100 text-red-800",
};

const TOCFL_COLORS: Record<number, string> = {
  1: "bg-lime-100 text-lime-800",
  2: "bg-lime-200 text-lime-900",
  3: "bg-sky-100 text-sky-800",
  4: "bg-sky-200 text-sky-900",
  5: "bg-violet-100 text-violet-800",
  6: "bg-violet-200 text-violet-900",
  7: "bg-orange-100 text-orange-800",
};

export function HskBadge({ level }: { level: number | null }) {
  if (!level) return null;
  return (
    <span className={`inline-block px-1.5 py-0.5 text-xs rounded font-medium ${HSK_COLORS[level] ?? "bg-gray-100 text-gray-600"}`}>
      HSK{level}
    </span>
  );
}

export function TocflBadge({ level }: { level: number | null }) {
  if (!level) return null;
  return (
    <span className={`inline-block px-1.5 py-0.5 text-xs rounded font-medium ${TOCFL_COLORS[level] ?? "bg-gray-100 text-gray-600"}`}>
      TOCFL{level}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    done: "bg-green-100 text-green-700",
    processing: "bg-yellow-100 text-yellow-700",
    error: "bg-red-100 text-red-700",
    pending: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${colors[status] ?? "bg-gray-100"}`}>
      {status}
    </span>
  );
}
