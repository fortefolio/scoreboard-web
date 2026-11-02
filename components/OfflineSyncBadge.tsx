"use client";

import { useEffect, useState } from "react";
import { subscribeQueueChanges, flushOfflineQueue } from "@/lib/offline/offlineQueue";
import { supabase } from "@/lib/supabase";

export default function OfflineSyncBadge({ matchId }: { matchId?: string }) {
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const unsub = subscribeQueueChanges((count) => {
      setPendingCount(count);
    });
    return unsub;
  }, []);

  if (pendingCount === 0) return null;

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      await flushOfflineQueue(supabase, matchId);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <button
      onClick={handleManualSync}
      className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 hover:bg-amber-500/25 transition-colors cursor-pointer"
      title="Clique para forçar sincronização"
    >
      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
      {syncing
        ? "A sincronizar..."
        : `${pendingCount} ${pendingCount === 1 ? "ponto pendente (offline)" : "pontos pendentes (offline)"}`}
    </button>
  );
}
