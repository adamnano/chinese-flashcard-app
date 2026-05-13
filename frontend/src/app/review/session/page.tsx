import { Suspense } from "react";
import SessionContent from "./SessionContent";

export const dynamic = "force-dynamic";

export default function ReviewSessionPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">Loading…</div>}>
      <SessionContent />
    </Suspense>
  );
}
