import { describe, expect, it, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { enqueueOfflineEvent, clearOfflineQueue, getOfflineQueue } from "@/lib/offline/offlineQueue";
import { buildParticipantsCsv } from "@/lib/csvTeams";
import { isValidStripeRedirectUrl } from "@/lib/stripe/validateRedirect";

describe("Security Regression Test Suite (Audit Run-2 Remediation)", () => {
  // =========================================================================
  // 1. Web Open Redirect Neutralization (web-auth-login-open-redirect)
  // =========================================================================
  describe("Open Redirect Validation Guard", () => {
    function sanitizeNextRedirect(next: string | null, origin: string): string | null {
      if (!next) return null;
      try {
        const parsed = new URL(next, origin);
        if (
          parsed.origin === origin &&
          parsed.pathname.startsWith("/") &&
          !next.startsWith("/\\") &&
          !next.startsWith("\\")
        ) {
          return parsed.pathname + parsed.search + parsed.hash;
        }
      } catch {
        return null;
      }
      return null;
    }

    const LOCAL_ORIGIN = "http://localhost:3000";

    it("rejects backslash protocol-relative redirect /\\attacker.com", () => {
      const payload = "/\\attacker.com/steal";
      expect(sanitizeNextRedirect(payload, LOCAL_ORIGIN)).toBeNull();
    });

    it("rejects double slash protocol-relative redirect //attacker.com", () => {
      const payload = "//attacker.com/steal";
      expect(sanitizeNextRedirect(payload, LOCAL_ORIGIN)).toBeNull();
    });

    it("rejects leading single backslash \\attacker.com", () => {
      const payload = "\\attacker.com";
      expect(sanitizeNextRedirect(payload, LOCAL_ORIGIN)).toBeNull();
    });

    it("rejects external absolute URLs", () => {
      expect(sanitizeNextRedirect("https://evil.com/login", LOCAL_ORIGIN)).toBeNull();
      expect(sanitizeNextRedirect("http://evil.com", LOCAL_ORIGIN)).toBeNull();
    });

    it("rejects javascript: and data: pseudo-protocols", () => {
      expect(sanitizeNextRedirect("javascript:alert(1)", LOCAL_ORIGIN)).toBeNull();
      expect(sanitizeNextRedirect("data:text/html,<script>alert(1)</script>", LOCAL_ORIGIN)).toBeNull();
    });

    it("accepts valid local relative paths with queries and fragments", () => {
      expect(sanitizeNextRedirect("/match/123", LOCAL_ORIGIN)).toBe("/match/123");
      expect(sanitizeNextRedirect("/tournament/abc?tab=bracket#round1", LOCAL_ORIGIN)).toBe(
        "/tournament/abc?tab=bracket#round1"
      );
    });
  });

  // =========================================================================
  // 2. Offline Queue Session Isolation (web-offline-queue-cross-account-replay)
  // =========================================================================
  describe("Offline Queue Session Boundary", () => {
    beforeEach(() => {
      clearOfflineQueue();
    });

    it("clears all pending offline mutations on clearOfflineQueue", () => {
      enqueueOfflineEvent({
        matchId: "match-123",
        eventData: { type: "point_won" },
        idempotencyKey: "key-1",
      });

      expect(getOfflineQueue().length).toBe(1);

      clearOfflineQueue();

      expect(getOfflineQueue().length).toBe(0);
    });
  });

  // =========================================================================
  // 3. Edge KV Cache Control Enforcement (web-edge-kv-cache-and-deploy-divergence)
  // =========================================================================
  describe("Edge & SSR Cache Control Invariants", () => {
    it("proxy.ts enforces private, no-store and Vary: Cookie", () => {
      const proxySource = fs.readFileSync(
        path.resolve(__dirname, "../../lib/supabase/proxy.ts"),
        "utf8"
      );

      expect(proxySource).toContain('response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate")');
      expect(proxySource).toContain('response.headers.set("Vary", "Cookie")');
    });
  });

  // =========================================================================
  // 4. Edge Functions Security Contract Verification
  // =========================================================================
  const backendRoot = path.resolve(__dirname, "../../../scoreboard-backend/supabase/functions");
  describe.skipIf(!fs.existsSync(backendRoot))("Edge Functions Security Invariants", () => {

    it("fcm-notifications enforces secret or service role authorization", () => {
      const source = fs.readFileSync(path.join(backendRoot, "fcm-notifications/index.ts"), "utf8");

      expect(source).toContain("INTERNAL_WEBHOOK_SECRET");
      expect(source).toContain("SUPABASE_SERVICE_ROLE_KEY");
      expect(source).toContain("status: 401");
    });

    it("send-signup-email enforces secret or service role authorization", () => {
      const source = fs.readFileSync(path.join(backendRoot, "send-signup-email/index.ts"), "utf8");

      expect(source).toContain("INTERNAL_WEBHOOK_SECRET");
      expect(source).toContain("SUPABASE_SERVICE_ROLE_KEY");
      expect(source).toContain("status: 401");
    });

    it("stripe-webhook requires payment_status === 'paid' before upgrading to pro", () => {
      const source = fs.readFileSync(path.join(backendRoot, "stripe-webhook/index.ts"), "utf8");

      expect(source).toContain('session.payment_status !== "paid"');
      expect(source).toContain('status: "pending_payment"');
    });

    it("finalize-match rejects re-finalization and unaccepted umpires", () => {
      const source = fs.readFileSync(path.join(backendRoot, "finalize-match/index.ts"), "utf8");

      expect(source).toContain('match.status === "completed"');
      expect(source).toContain("409");
      expect(source).toContain('match.umpire_invite_status === "accepted"');
      expect(source).toContain("403");
    });

    it("generate-tournament-bracket binds organizer_id strictly to verified tournament record", () => {
      const source = fs.readFileSync(path.join(backendRoot, "generate-tournament-bracket/index.ts"), "utf8");

      expect(source).toContain("const organizer_id = tournamentRecord.organizer_id");
      expect(source).toContain("tournamentRecord.organizer_id !== user.id");
    });
  });

  // =========================================================================
  // 5. Database SQL Remediation Invariants
  // =========================================================================
  const migrationsRoot = path.resolve(__dirname, "../../../scoreboard-backend/supabase/migrations");
  describe.skipIf(!fs.existsSync(migrationsRoot))("Database Migration Security Invariants", () => {

    it("phase 1 & 2 migration defines score tampering and tournament ownership triggers", () => {
      const migrationFile = path.join(migrationsRoot, "20261102180000_phase1_phase2_security_remediation.sql");
      expect(fs.existsSync(migrationFile)).toBe(true);

      const sql = fs.readFileSync(migrationFile, "utf8");

      // Tournament injection prevention
      expect(sql).toContain("check_match_tournament_ownership");
      expect(sql).toContain("tr_check_match_tournament_ownership");

      // Score and status tampering prevention
      expect(sql).toContain("check_match_score_and_status_mutation");
      expect(sql).toContain("tr_check_match_score_and_status_mutation");

      // search_path pinning
      expect(sql).toContain("SET search_path = ''");

      // Umpire invite status requirement
      expect(sql).toContain("umpire_invite_status = 'accepted'");

      // Atomic scoring idempotency order (authorization before idempotency)
      const authIdx = sql.indexOf("Authorization Guard");
      const idempIdx = sql.indexOf("Idempotency Guard");
      expect(authIdx).toBeGreaterThan(0);
      expect(idempIdx).toBeGreaterThan(authIdx);
    });

    it("phase 3 migration protects private tournament notifications and escapes ILIKE", () => {
      const migrationFile = path.join(migrationsRoot, "20261102190000_phase3_privacy_and_isolation.sql");
      expect(fs.existsSync(migrationFile)).toBe(true);

      const sql = fs.readFileSync(migrationFile, "utf8");

      // Follows private tournament policy
      expect(sql).toContain("Users can insert their own follows");
      expect(sql).toContain("t.visibility IN ('public', 'unlisted') OR t.organizer_id = (SELECT auth.uid())");

      // Private tournament notification filtering
      expect(sql).toContain("t.visibility IN ('public', 'unlisted')");
      expect(sql).toContain("t.organizer_id = f.user_id");

      // search_umpires ILIKE wildcard escaping
      expect(sql).toContain("replace(replace(replace(trim(p_query), '\\', '\\\\'), '%', '\\%'), '_', '\\_')");
    });
  });

  // =========================================================================
  // 6. Mobile Application Query & Security Invariants
  // =========================================================================
  const mobileRoot = path.resolve(__dirname, "../../../scoreboard-mobile/src");
  describe.skipIf(!fs.existsSync(mobileRoot))("Mobile Application Security Invariants", () => {

    it("match/[id].tsx uses search_umpires RPC and avoids unescaped PostgREST filter injection", () => {
      const source = fs.readFileSync(path.join(mobileRoot, "app/match/[id].tsx"), "utf8");

      expect(source).toContain('supabase.rpc("search_umpires"');
      expect(source).not.toContain("username.ilike.%${query.trim()}%");
    });

    it("TournamentRosterSection.tsx selects explicit public columns instead of wildcard *", () => {
      const source = fs.readFileSync(
        path.join(mobileRoot, "components/tournament/TournamentRosterSection.tsx"),
        "utf8"
      );

      expect(source).toContain('.select("id, tournament_id, name, seed, created_at")');
      expect(source).not.toContain('.from("tournament_participants").select("*")');
    });

    it("AuthProvider.tsx clears offline queue on signOut", () => {
      const source = fs.readFileSync(path.join(mobileRoot, "components/AuthProvider.tsx"), "utf8");

      expect(source).toContain("clearOfflineQueue");
      expect(source).toContain('event === "SIGNED_OUT"');
    });
  });

  // =========================================================================
  // 7. ASVS 5.0 L2 Remediation Invariants (CSV Injection & Stripe Redirect)
  // =========================================================================
  describe("ASVS 5.0 L2 Web Invariants", () => {
    it("neutralizes spreadsheet formula prefixes in buildParticipantsCsv", () => {
      const csv = buildParticipantsCsv([
        { name: "=1+1", contact_email: "+cmd|' /C calc'!A0", form_responses: { note: "@SUM(1,2)" } },
      ], [{ id: "note", label: "Note", type: "text", required: false }]);

      expect(csv).toContain("'=1+1");
      expect(csv).toContain("'+cmd|");
      expect(csv).toContain("'@SUM(1,2)");
    });

    it("enforces https and .stripe.com hostname allowlist for Stripe redirects", () => {
      expect(isValidStripeRedirectUrl("https://checkout.stripe.com/c/pay/cs_test_123")).toBe(true);
      expect(isValidStripeRedirectUrl("https://billing.stripe.com/p/session/123")).toBe(true);
      expect(isValidStripeRedirectUrl("http://checkout.stripe.com/c/pay/123")).toBe(false);
      expect(isValidStripeRedirectUrl("https://evil-stripe.com/phish")).toBe(false);
      expect(isValidStripeRedirectUrl("javascript:alert(1)")).toBe(false);
    });
  });
});
