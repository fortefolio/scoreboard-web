import { Suspense } from "react";
import MatchOverlayClient from "./MatchOverlayClient";

export default function MatchOverlayPage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-transparent pointer-events-none" />}>
      <MatchOverlayClient />
    </Suspense>
  );
}
