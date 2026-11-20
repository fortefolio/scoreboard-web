import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, it, expect, vi, beforeAll } from "vitest";
import { SUPPORTED_SPORT_VALUES, type SportValue } from "@/lib/sports";

const backendDispatchPath = path.resolve(
  __dirname,
  "../../../scoreboard-backend/supabase/functions/fcm-notifications/dispatch.ts"
);
const hasBackend = fs.existsSync(backendDispatchPath);

interface DispatchModule {
  isApnsDeviceToken: (token: string) => boolean;
  classifyToken: (token: string) => "apns" | "fcm";
  shouldDispatchWebhook: (payload: {
    type: "INSERT" | "UPDATE" | "DELETE" | "SELECT";
    table: string;
    record: Record<string, any> | null;
    old_record?: Record<string, any> | null;
  }) => boolean;
  dispatchPushNotifications: (
    tokens: string[],
    notification: Record<string, any>,
    deps: {
      fetchFn?: typeof fetch;
      getFcmAccessToken?: () => Promise<string>;
      fcmProjectId?: string;
      apnsConfig?: {
        keyId: string;
        teamId: string;
        privateKeyPem: string;
        bundleId: string;
      } | null;
      badgeCount?: number;
      nowSeconds?: () => number;
    }
  ) => Promise<{
    fcmSent: number;
    apnsSent: number;
    apnsSandboxFallback: number;
    invalidTokens: string[];
    errors: string[];
  }>;
}

let mod: DispatchModule;
let testApnsPem = "";

describe.skipIf(!hasBackend)("fcm-notifications webhook & token routing", () => {
  const apnsToken = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";
  const fcmToken = "fMx9k2QpT8W:APA91bH7xYz1234567890_abcdefghijklmnopqrstuvwxyz";

  beforeAll(async () => {
    const source = fs.readFileSync(backendDispatchPath, "utf8");
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    });
    mod = (await import(
      `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
    )) as DispatchModule;

    const keyPair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"]
    );
    const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", keyPair.privateKey));
    const b64 = Buffer.from(pkcs8).toString("base64");
    const lines = b64.match(/.{1,64}/g) ?? [b64];
    testApnsPem = `-----BEGIN PRIVATE KEY-----\n${lines.join("\n")}\n-----END PRIVATE KEY-----`;
  });

  it("dispatches INSERT and score-aggregation UPDATE, but skips mark-as-read and no-op UPDATE", () => {
    expect(
      mod.shouldDispatchWebhook({
        type: "INSERT",
        table: "notifications",
        record: {
          id: "notif-1",
          user_id: "user-1",
          title: "SL Benfica vs FC Porto",
          body: "SL Benfica 1 - 0 FC Porto",
          data: { match_id: "m-1", score: "1-0" },
          read_at: null,
        },
      })
    ).toBe(true);

    // Second goal aggregates on existing row via UPDATE with read_at = null
    expect(
      mod.shouldDispatchWebhook({
        type: "UPDATE",
        table: "notifications",
        record: {
          id: "notif-1",
          user_id: "user-1",
          title: "SL Benfica vs FC Porto",
          body: "SL Benfica 2 - 0 FC Porto",
          data: { match_id: "m-1", score: "2-0" },
          read_at: null,
        },
        old_record: {
          id: "notif-1",
          user_id: "user-1",
          title: "SL Benfica vs FC Porto",
          body: "SL Benfica 1 - 0 FC Porto",
          data: { match_id: "m-1", score: "1-0" },
          read_at: null,
        },
      })
    ).toBe(true);

    // User marking notification as read must NOT re-send a push
    expect(
      mod.shouldDispatchWebhook({
        type: "UPDATE",
        table: "notifications",
        record: {
          id: "notif-1",
          title: "SL Benfica vs FC Porto",
          body: "SL Benfica 2 - 0 FC Porto",
          data: { match_id: "m-1" },
          read_at: "2026-11-19T23:50:00Z",
        },
        old_record: {
          id: "notif-1",
          title: "SL Benfica vs FC Porto",
          body: "SL Benfica 2 - 0 FC Porto",
          data: { match_id: "m-1" },
          read_at: null,
        },
      })
    ).toBe(false);

    // No-op UPDATE with identical content
    expect(
      mod.shouldDispatchWebhook({
        type: "UPDATE",
        table: "notifications",
        record: {
          id: "notif-1",
          title: "SL Benfica vs FC Porto",
          body: "SL Benfica 2 - 0 FC Porto",
          data: { match_id: "m-1" },
          read_at: null,
        },
        old_record: {
          id: "notif-1",
          title: "SL Benfica vs FC Porto",
          body: "SL Benfica 2 - 0 FC Porto",
          data: { match_id: "m-1" },
          read_at: null,
        },
      })
    ).toBe(false);

    expect(
      mod.shouldDispatchWebhook({
        type: "DELETE",
        table: "notifications",
        record: { id: "notif-1", read_at: null },
      })
    ).toBe(false);
  });

  it("classifies 64-char hex APNs tokens vs FCM registration tokens", () => {
    expect(mod.isApnsDeviceToken(apnsToken)).toBe(true);
    expect(mod.isApnsDeviceToken(apnsToken.toUpperCase())).toBe(true);
    expect(mod.classifyToken(apnsToken)).toBe("apns");

    expect(mod.isApnsDeviceToken(fcmToken)).toBe(false);
    expect(mod.classifyToken(fcmToken)).toBe("fcm");
  });

  it("routes mixed Pixel FCM + iPad APNs tokens in one dispatch", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init: init ?? {} });
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    const summary = await mod.dispatchPushNotifications(
      [fcmToken, apnsToken],
      {
        id: "notif-1",
        title: "SL Benfica vs FC Porto",
        body: "SL Benfica 2 - 0 FC Porto",
        data: { match_id: "m-1", count: 2 },
      },
      {
        fetchFn,
        fcmProjectId: "scoreboard-prod",
        getFcmAccessToken: async () => "fcm-access-token",
        apnsConfig: {
          keyId: "ABC1234567",
          teamId: "Q5YCFNPSPJ",
          privateKeyPem: testApnsPem,
          bundleId: "dev.goncaloforte.scoreboard",
        },
        badgeCount: 3,
        nowSeconds: () => 1795130000,
      }
    );

    expect(summary).toEqual({
      fcmSent: 1,
      apnsSent: 1,
      apnsSandboxFallback: 0,
      invalidTokens: [],
      errors: [],
    });

    expect(calls).toHaveLength(2);
    const fcmCall = calls.find((c) => c.url.includes("fcm.googleapis.com"));
    const apnsCall = calls.find((c) => c.url.includes("api.push.apple.com"));

    expect(fcmCall?.url).toBe(
      "https://fcm.googleapis.com/v1/projects/scoreboard-prod/messages:send"
    );
    const fcmBody = JSON.parse(String(fcmCall?.init.body));
    expect(fcmBody.message.token).toBe(fcmToken);
    expect(fcmBody.message.data).toEqual({
      match_id: "m-1",
      count: "2",
      notification_id: "notif-1",
    });

    expect(apnsCall?.url).toBe(`https://api.push.apple.com/3/device/${apnsToken}`);
    const apnsBody = JSON.parse(String(apnsCall?.init.body));
    expect(apnsBody.aps.badge).toBe(3);
    expect(apnsBody.match_id).toBe("m-1");
    const apnsHeaders = apnsCall?.init.headers as Record<string, string>;
    expect(apnsHeaders["apns-topic"]).toBe("dev.goncaloforte.scoreboard");
    expect(apnsHeaders.authorization).toMatch(
      /^bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/
    );
  });

  it("falls back to api.sandbox.push.apple.com when prod APNs returns 400 BadDeviceToken", async () => {
    const urls: string[] = [];
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      urls.push(url);
      if (url.startsWith("https://api.push.apple.com/")) {
        return new Response(JSON.stringify({ reason: "BadDeviceToken" }), { status: 400 });
      }
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    const summary = await mod.dispatchPushNotifications(
      [apnsToken],
      { id: "notif-2", title: "Goal!", body: "2 - 0", data: { match_id: "m-1" } },
      {
        fetchFn,
        apnsConfig: {
          keyId: "ABC1234567",
          teamId: "Q5YCFNPSPJ",
          privateKeyPem: testApnsPem,
          bundleId: "dev.goncaloforte.scoreboard",
        },
      }
    );

    expect(summary).toEqual({
      fcmSent: 0,
      apnsSent: 1,
      apnsSandboxFallback: 1,
      invalidTokens: [],
      errors: [],
    });
    expect(urls).toEqual([
      `https://api.push.apple.com/3/device/${apnsToken}`,
      `https://api.sandbox.push.apple.com/3/device/${apnsToken}`,
    ]);
  });

  it("does not fall back to sandbox on non-BadDeviceToken APNs errors (e.g. 410 Unregistered)", async () => {
    const urls: string[] = [];
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      urls.push(String(input));
      return new Response(JSON.stringify({ reason: "Unregistered" }), { status: 410 });
    }) as unknown as typeof fetch;

    const summary = await mod.dispatchPushNotifications(
      [apnsToken],
      { id: "notif-3", title: "Goal!", body: "2 - 0", data: { match_id: "m-1" } },
      {
        fetchFn,
        apnsConfig: {
          keyId: "ABC1234567",
          teamId: "Q5YCFNPSPJ",
          privateKeyPem: testApnsPem,
          bundleId: "dev.goncaloforte.scoreboard",
        },
      }
    );

    expect(summary.apnsSent).toBe(0);
    expect(summary.apnsSandboxFallback).toBe(0);
    expect(summary.invalidTokens).toEqual([apnsToken]);
    expect(summary.errors).toHaveLength(1);
    expect(urls).toEqual([`https://api.push.apple.com/3/device/${apnsToken}`]);
  });

  it("enforces notification UPDATE dispatch and SQL extraction coverage for every SUPPORTED_SPORTS entry", () => {
    const sportPayloads: Record<
      SportValue,
      { oldScores: Record<string, unknown>; newScores: Record<string, unknown>; body: string }
    > = {
      Basketball: {
        oldScores: { current: { home: 40, away: 38 } },
        newScores: { current: { home: 43, away: 38 } },
        body: "Team A 43 - 38 Team B",
      },
      "Beach Volleyball": {
        oldScores: { current: { home: 12, away: 10 }, set_scores: [] },
        newScores: { current: { home: 13, away: 10 }, set_scores: [] },
        body: "Team A 13 - 10 Team B",
      },
      Football: {
        oldScores: { current: { home: 1, away: 0 } },
        newScores: { current: { home: 1, away: 1 } },
        body: "Team A 1 - 1 Team B",
      },
      Padel: {
        oldScores: { padel: { sets: [{ home: 6, away: 4 }] }, current: { home: 30, away: 15 } },
        newScores: { padel: { sets: [{ home: 6, away: 4 }] }, current: { home: 40, away: 15 } },
        body: "Team A vs Team B · Sets: 6-4 (40-15)",
      },
      Tennis: {
        oldScores: { tennis: { sets: [{ home: 6, away: 3 }] }, current: { home: 15, away: 0 } },
        newScores: { tennis: { sets: [{ home: 6, away: 3 }] }, current: { home: 30, away: 0 } },
        body: "Team A vs Team B · Sets: 6-3 (30-0)",
      },
      Volleyball: {
        oldScores: { set_scores: [{ home: 25, away: 20 }], current: { home: 5, away: 4 } },
        newScores: { set_scores: [{ home: 25, away: 20 }], current: { home: 6, away: 4 } },
        body: "Team A vs Team B · Sets: 25-20 (6-4)",
      },
    };

    for (const sport of SUPPORTED_SPORT_VALUES) {
      const fixture = sportPayloads[sport];
      expect(fixture, `Missing notification score contract for sport: ${sport}`).toBeDefined();
      expect(fixture.body.length).toBeGreaterThan(0);

      expect(
        mod.shouldDispatchWebhook({
          type: "UPDATE",
          table: "notifications",
          record: {
            id: `notif-${sport}`,
            user_id: "user-1",
            title: `Score for Team A!`,
            body: fixture.body,
            data: { match_id: `m-${sport}`, sport_type: sport, scores: fixture.newScores },
            read_at: null,
          },
          old_record: {
            id: `notif-${sport}`,
            user_id: "user-1",
            title: `Score Update: Team A vs Team B`,
            body: "previous",
            data: { match_id: `m-${sport}`, sport_type: sport, scores: fixture.oldScores },
            read_at: null,
          },
        })
      ).toBe(true);
    }

    const migrationSql = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../scoreboard-backend/supabase/migrations/20261120000000_improve_match_notification_text.sql"
      ),
      "utf8"
    );
    expect(migrationSql).toContain("NEW.scores->'current'->>'home'");
    expect(migrationSql).toContain("NEW.scores->'tennis' ? 'sets'");
    expect(migrationSql).toContain("NEW.scores->'padel' ? 'sets'");
    expect(migrationSql).toContain("NEW.scores ? 'set_scores'");
    expect(migrationSql).toContain("jsonb_array_length(");
  });
});
