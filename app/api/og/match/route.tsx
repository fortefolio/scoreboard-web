import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "@/lib/supabase/env";
import { countSetsWon, extractSetsData } from "@/lib/scoring/sets";
import { normalizeSportType } from "@/lib/sports";
import { formatTeamOrPlayerName } from "@/lib/utils/formatName";

async function fetchAssetBuffer(path: string, baseUrl: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(new URL(path, baseUrl));
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

async function fetchGoogleFont(family: string, weight: number): Promise<ArrayBuffer | null> {
  try {
    const cssRes = await fetch(
      `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`,
      { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" } }
    );
    if (!cssRes.ok) return null;
    const css = await cssRes.text();
    const match = css.match(/src:\s*url\(([^)]+)\)\s*format\(['"]?(?:truetype|opentype|woff2)['"]?\)/i);
    if (!match?.[1]) return null;
    const fontRes = await fetch(match[1]);
    if (!fontRes.ok) return null;
    return await fontRes.arrayBuffer();
  } catch {
    return null;
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

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

  const normalizedSport = normalizeSportType(sport);
  const [interRegularBuf, interBoldBuf, digitalMonoBuf, digitalLogoBuf, bgBuf] = await Promise.all([
    fetchGoogleFont("Inter", 400),
    fetchGoogleFont("Inter", 700),
    fetchAssetBuffer("/fonts/digital-7-mono.ttf", request.url),
    fetchAssetBuffer("/fonts/digital-7.ttf", request.url),
    fetchAssetBuffer(`/backgrounds/${normalizedSport}-landscape.webp`, request.url),
  ]);

  const bgDataUrl = bgBuf ? `data:image/webp;base64,${arrayBufferToBase64(bgBuf)}` : null;

  const fonts: { name: string; data: ArrayBuffer; style: "normal"; weight: 400 | 700 }[] = [];
  if (interRegularBuf) {
    fonts.push({ name: "Inter", data: interRegularBuf, style: "normal", weight: 400 });
  }
  if (interBoldBuf) {
    fonts.push({ name: "Inter", data: interBoldBuf, style: "normal", weight: 700 });
  }
  if (digitalMonoBuf) {
    fonts.push({ name: "Digital7Mono", data: digitalMonoBuf, style: "normal", weight: 400 });
  }
  if (digitalLogoBuf) {
    fonts.push({ name: "Digital7", data: digitalLogoBuf, style: "normal", weight: 400 });
  }

  const uiFont = interRegularBuf ? "Inter, sans-serif" : "sans-serif";

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#0b0d14",
          color: "#eef0f5",
          padding: "56px",
          fontFamily: uiFont,
          overflow: "hidden",
        }}
      >
        {/* Sport-specific atmospheric background + dark scrim */}
        {bgDataUrl ? (
          <img
            src={bgDataUrl}
            alt=""
            width={1200}
            height={630}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "1200px",
              height: "630px",
              objectFit: "cover",
            }}
          />
        ) : null}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "1200px",
            height: "630px",
            backgroundColor: "rgba(11, 13, 20, 0.55)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "1200px",
            height: "630px",
            backgroundImage:
              "linear-gradient(to bottom, rgba(11, 13, 20, 0.72), rgba(11, 13, 20, 0.25), rgba(11, 13, 20, 0.88))",
          }}
        />

        {/* Top bar */}
        <div
          style={{
            position: "relative",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                fontFamily: digitalLogoBuf ? "Digital7" : uiFont,
                fontSize: "40px",
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
              backgroundColor: "rgba(22, 26, 36, 0.85)",
              border: "1px solid rgba(255, 255, 255, 0.14)",
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
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "rgba(17, 20, 28, 0.84)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: "28px",
            padding: "52px 56px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: "340px",
            }}
          >
            <div style={{ fontSize: "18px", color: "#a3a9b8", marginBottom: "10px" }}>
              PLAYER / TEAM 1
            </div>
            <div
              style={{
                fontSize: "42px",
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
              flexShrink: 0,
              whiteSpace: "nowrap",
              backgroundColor: "rgba(7, 8, 13, 0.9)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "20px",
              padding: "22px 44px",
              fontFamily: digitalMonoBuf ? "Digital7Mono" : uiFont,
              fontSize: "84px",
              letterSpacing: "2px",
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
              width: "340px",
            }}
          >
            <div style={{ fontSize: "18px", color: "#a3a9b8", marginBottom: "10px" }}>
              PLAYER / TEAM 2
            </div>
            <div
              style={{
                fontSize: "42px",
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
            position: "relative",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "20px",
            color: "#a3a9b8",
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
      ...(fonts.length > 0 ? { fonts } : {}),
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=60",
      },
    }
  );
}
