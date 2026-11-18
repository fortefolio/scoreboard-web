"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import MatchCard from "@/components/MatchCard";
import MatchListItem from "@/components/MatchListItem";
import GroupedMatchList from "@/components/GroupedMatchList";
import DataTable from "@/components/DataTable";
import Pagination from "@/components/Pagination";
import { getMatchColumns } from "@/components/entityTableColumns";
import { MyWorkspaceTabs } from "@/components/MyWorkspaceTabs";
import { WorkspaceControlsBar, filterAndSortMatches } from "@/components/WorkspaceControlsBar";
import MatchAtmosphereBackground from "@/components/match/MatchAtmosphereBackground";
import { useTranslation } from "@/lib/i18n";

const MATCHES_PER_PAGE = 12;

function UmpireMatchesContent() {
  const router = useRouter();
  const { user, supabase } = useAuth();
  const { t, locale } = useTranslation();
  const isPt = locale === "pt";

  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "cards">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [sportFilter, setSportFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateSort, setDateSort] = useState<"desc" | "asc">("desc");
  const [currentPage, setCurrentPage] = useState<number>(1);

  const filteredMatches = useMemo(
    () =>
      filterAndSortMatches(matches, {
        sportFilter,
        statusFilter,
        searchQuery,
        dateSort,
      }),
    [matches, sportFilter, statusFilter, searchQuery, dateSort]
  );

  const totalPages = Math.max(1, Math.ceil(filteredMatches.length / MATCHES_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedMatches = useMemo(() => {
    const start = (safePage - 1) * MATCHES_PER_PAGE;
    return filteredMatches.slice(start, start + MATCHES_PER_PAGE);
  }, [filteredMatches, safePage]);

  const clearFilters = () => {
    setSearchQuery("");
    setSportFilter("all");
    setStatusFilter("all");
    setDateSort("desc");
    setCurrentPage(1);
  };

  const fetchUmpireMatches = useCallback(
    async (userId: string) => {
      setLoading(true);
      const { data } = await supabase
        .from("matches")
        .select("*, tournaments(name), organizer:users!organizer_id(username)")
        .eq("umpire_id", userId)
        .or(`organizer_id.is.null,organizer_id.neq.${userId}`)
        .order("created_at", { ascending: false });

      if (data) setMatches(data);
      setLoading(false);
    },
    [supabase]
  );

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    fetchUmpireMatches(user.id);
  }, [user, fetchUmpireMatches]);

  useEffect(() => {
    if (!user) return;

    let channel: any = null;
    try {
      channel = supabase
        .channel(`umpire-matches-${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "matches" },
          () => {
            fetchUmpireMatches(user.id);
          }
        );

      channel.subscribe((status: string, err?: Error) => {
        if (status === "CHANNEL_ERROR" || err) {
          console.warn("[UmpireMatches] Realtime error:", err || status);
        }
      });
    } catch (err) {
      console.warn("[UmpireMatches] Realtime unavailable:", err);
    }

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {}
      }
    };
  }, [user, supabase, fetchUmpireMatches]);

  return (
    <div className="relative min-h-screen bg-transparent text-on-background">
      {/* ATMOSPHERE BACKGROUND */}
      <MatchAtmosphereBackground
        sportType={sportFilter !== "all" ? sportFilter : "random"}
        mode="spectator"
      />

      <div className="relative z-10 px-4 py-3 sm:p-6 max-w-7xl mx-auto">
        <MyWorkspaceTabs active="umpiring" />

        <WorkspaceControlsBar
          searchQuery={searchQuery}
          onSearchChange={(val) => {
            setSearchQuery(val);
            setCurrentPage(1);
          }}
          searchPlaceholder={
            isPt
              ? "Pesquisar jogos, torneios ou @utilizadores..."
              : "Search matches, tournaments, or @users..."
          }
          sportFilter={sportFilter}
          onSportChange={(val) => {
            setSportFilter(val);
            setCurrentPage(1);
          }}
          statusFilter={statusFilter}
          onStatusChange={(val) => {
            setStatusFilter(val);
            setCurrentPage(1);
          }}
          dateSort={dateSort}
          onDateSortChange={(val) => {
            setDateSort(val);
            setCurrentPage(1);
          }}
          onClearFilters={clearFilters}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {loading ? (
          <div className="py-20 text-center">
            <div className="inline-block w-8 h-8 border-2 border-text-primary border-t-transparent rounded-full animate-spin" />
            <p className="mt-3 text-text-muted text-xs">
              {isPt ? "A carregar jogos..." : "Loading matches..."}
            </p>
          </div>
        ) : filteredMatches.length === 0 ? (
          <div className="border border-dashed border-outline-variant rounded-2xl p-12 sm:p-16 flex flex-col items-center justify-center text-center bg-surface-container">
            <span className="material-symbols-outlined text-4xl mb-3 text-text-muted opacity-40">
              sports
            </span>
            <p className="font-semibold text-sm text-text-primary mb-1">
              {isPt ? "Sem jogos atribuídos" : "No assigned matches"}
            </p>
            <p className="text-xs text-text-muted max-w-sm">
              {isPt
                ? "Os jogos em que fores convidado como árbitro vão aparecer aqui."
                : "Matches where another organizer assigns you as umpire will appear here."}
            </p>
          </div>
        ) : (
          <>
            {viewMode === "cards" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {paginatedMatches.map((match) => (
                  <div key={match.id} className="relative group/card flex justify-center">
                    <MatchCard match={match} />
                  </div>
                ))}
              </div>
            ) : (
              <GroupedMatchList
                matches={paginatedMatches}
                extraColumns={[
                  {
                    key: "action",
                    header: t("common.action"),
                    align: "center",
                    headerClassName: "w-20",
                    cellClassName: "w-20",
                    stopRowClick: true,
                    render: (m) => (
                      <div className="flex items-center justify-center">
                        <button
                          onClick={() => router.push(`/match/${m.id}/scoreboard`)}
                          className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-container-highest transition-colors cursor-pointer"
                          title={isPt ? "Pontuar Jogo" : "Score Match"}
                        >
                          <span className="material-symbols-outlined text-[16px]">scoreboard</span>
                        </button>
                      </div>
                    ),
                  },
                ]}
              />
            )}

            <Pagination
              currentPage={safePage}
              totalPages={totalPages}
              onPageChange={(page) => {
                setCurrentPage(page);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default function UmpireMatchesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen pt-20" />}>
      <UmpireMatchesContent />
    </Suspense>
  );
}
