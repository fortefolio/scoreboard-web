import { vi } from "vitest";
import type { Session, User } from "@supabase/supabase-js";

type Listener = (event: string, session: Session | null) => void;

export function createSupabaseMock(initial: { user?: User | null } = {}) {
  const listeners: Listener[] = [];
  let currentSession: Session | null = initial.user
    ? ({ user: initial.user, access_token: "test", refresh_token: "test" } as unknown as Session)
    : null;

  const emit = (event: string, session: Session | null) => {
    currentSession = session;
    listeners.forEach((l) => l(event, session));
  };

  const queryBuilder = () => {
    const builder: any = {
      select: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      neq: vi.fn(() => builder),
      or: vi.fn(() => builder),
      is: vi.fn(() => builder),
      in: vi.fn(() => builder),
      ilike: vi.fn(() => builder),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      then: (resolve: (value: { data: any[]; error: null }) => void) =>
        resolve({ data: [], error: null }),
    };
    return builder;
  };

  const channel = {
    on: vi.fn(() => channel),
    subscribe: vi.fn(() => channel),
  };

  return {
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: currentSession?.user ?? null }, error: null })),
      getSession: vi.fn(() => Promise.resolve({ data: { session: currentSession }, error: null })),
      signInWithPassword: vi.fn((credentials: { email: string; password: string }) => {
        const user = { id: "test-user", email: credentials.email } as unknown as User;
        emit("SIGNED_IN", { user, access_token: "t", refresh_token: "r" } as unknown as Session);
        return Promise.resolve({ data: { user, session: currentSession }, error: null });
      }),
      signUp: vi.fn(() => Promise.resolve({ data: { user: null, session: null }, error: null })),
      signOut: vi.fn(() => {
        emit("SIGNED_OUT", null);
        return Promise.resolve({ error: null });
      }),
      onAuthStateChange: vi.fn((cb: Listener) => {
        listeners.push(cb);
        return {
          data: {
            subscription: {
              unsubscribe: vi.fn(() => {
                const idx = listeners.indexOf(cb);
                if (idx >= 0) listeners.splice(idx, 1);
              }),
            },
          },
        };
      }),
    },
    from: vi.fn(queryBuilder),
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(),
    __emit: emit,
  };
}

export type SupabaseMock = ReturnType<typeof createSupabaseMock>;
