import { Suspense } from "react";
import MatchOverlayClient from "./MatchOverlayClient";

export const metadata = {
  title: "Live Stream Overlay | ScoreBoard",
  description: "Live broadcast scoreboard overlay for OBS Studio and vMix",
};

export default function MatchOverlayPage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-transparent pointer-events-none" />}>
      <MatchOverlayClient />
    </Suspense>
  );
}
