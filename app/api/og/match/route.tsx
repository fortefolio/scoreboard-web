import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "@/lib/supabase/env";
import { countSetsWon, extractSetsData } from "@/lib/scoring/sets";
import { formatTeamOrPlayerName } from "@/lib/utils/formatName";

export async function GET(request: NextRequest) {
  const matchId = request.nextUrl.searchParams.get("id");

  let p1 = "Team 1";
  let p2 = "Team 2";
  let s1 = 0;
  let s2 = 0;
  let sport = "Match";
  let statusLabel = "LIVE";
  let isLive = false;
  let tournamentName = "";

  if (matchId) {
    try {
      const { url, anonKey } = supabaseEnv();
      const supabase = createClient(url, anonKey);
      const { data: match } = await supabase
        .from("matches")
        .select("participants, scores, sport_type, status, tournaments(name)")
        .eq("id", matchId)
        .single();

      if (match) {
        p1 = formatTeamOrPlayerName(match.participants?.[0]?.name) || "TBD";
        p2 = formatTeamOrPlayerName(match.participants?.[1]?.name) || "TBD";
        sport = match.sport_type || "Match";
        const parsedSets = extractSetsData(match.scores);
        if (parsedSets.length > 0) {
          s1 = countSetsWon(parsedSets, 0);
          s2 = countSetsWon(parsedSets, 1);
        } else {
          s1 = match.scores?.current?.home ?? 0;
          s2 = match.scores?.current?.away ?? 0;
        }
        isLive = match.status === "ongoing" || match.status === "live";
        statusLabel = isLive
          ? "LIVE"
          : match.status === "completed" || match.status === "finished"
          ? "FINAL"
          : "SCHEDULED";
        const t = Array.isArray(match.tournaments) ? match.tournaments[0] : match.tournaments;
        tournamentName = t?.name || "";
      }
    } catch {
      // Fall back to generic card values if lookup fails
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#0b0d14",
          color: "#eef0f5",
          padding: "56px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Top bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                fontSize: "34px",
                fontWeight: 800,
                letterSpacing: "2px",
                color: "#eef0f5",
              }}
            >
              SCORE:BOARD
            </div>
            {tournamentName ? (
              <div
                style={{
                  marginLeft: "24px",
                  fontSize: "22px",
                  color: "#a3a9b8",
                  borderLeft: "2px solid #2a3142",
                  paddingLeft: "24px",
                }}
              >
                {tournamentName}
              </div>
            ) : null}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              backgroundColor: "#161a24",
              border: "1px solid #2a3142",
              borderRadius: "999px",
              padding: "10px 22px",
              fontSize: "20px",
              fontWeight: 700,
              color: isLive ? "#4cc38a" : "#a3a9b8",
            }}
          >
            {`${sport.toUpperCase()} · ${statusLabel}`}
          </div>
        </div>

        {/* Center score card */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "#11141c",
            border: "1px solid #252b3b",
            borderRadius: "28px",
            padding: "52px 56px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: "400px",
            }}
          >
            <div style={{ fontSize: "18px", color: "#7a8296", marginBottom: "10px" }}>
              PLAYER / TEAM 1
            </div>
            <div
              style={{
                fontSize: "44px",
                fontWeight: 700,
                color: "#eef0f5",
                lineHeight: 1.15,
              }}
            >
              {p1}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#07080d",
              border: "1px solid #252b3b",
              borderRadius: "20px",
              padding: "24px 40px",
              fontSize: "76px",
              fontWeight: 800,
              color: "#eef0f5",
            }}
          >
            {`${s1} - ${s2}`}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              width: "400px",
            }}
          >
            <div style={{ fontSize: "18px", color: "#7a8296", marginBottom: "10px" }}>
              PLAYER / TEAM 2
            </div>
            <div
              style={{
                fontSize: "44px",
                fontWeight: 700,
                color: "#eef0f5",
                textAlign: "right",
                lineHeight: 1.15,
              }}
            >
              {p2}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "20px",
            color: "#7a8296",
          }}
        >
          <div>Real-time telemetry &amp; live scorekeeping</div>
          <div>score-board.net</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=60",
      },
    }
  );
}
