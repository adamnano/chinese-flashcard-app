import { Suspense } from "react";
import FlashcardsContent from "./FlashcardsContent";

export const dynamic = "force-dynamic";

export default function FlashcardsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">Loading…</div>}>
      <FlashcardsContent />
    </Suspense>
  );
}
