import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

/**
 * Reprodukuje race iz produkcije:
 *   "cannot add `postgres_changes` callbacks for realtime:admin-appointments
 *    after `subscribe()`."
 *
 * Uzrok: `ensureSubscribed` provjerava `if (channel) return` PRIJE dva
 * await-a, a `channel` dodjeljuje tek POSLIJE njih. `onAuthStateChange`
 * (INITIAL_SESSION/SIGNED_IN fire-uje odmah po registraciji) pokrene drugi
 * poziv dok je prvi još u await-u — oba prođu guard. Pošto
 * `RealtimeClient.channel(topic)` vraća POSTOJEĆI kanal za isti topic
 * (dedup u realtime-js), drugi poziv dobije već subscribe-ovan kanal i
 * `.on('postgres_changes', ...)` baci grešku.
 *
 * Fake klijent ispod emulira tačno te semantike realtime-js 2.103:
 *  - channel() dedup po topic-u
 *  - subscribe() sinhrono prelazi u "joining"
 *  - .on() na joining/joined kanalu = violation (real lib baca Error)
 */

type AuthCallback = (event: string, session: unknown) => void;

class FakeChannel {
  topic: string;
  state: "closed" | "joining" | "joined" = "closed";
  postgresCallbacks = 0;
  private violations: string[];

  constructor(topic: string, violations: string[]) {
    this.topic = `realtime:${topic}`;
    this.violations = violations;
  }

  on(type: string, _filter: unknown, _cb: unknown) {
    if (this.state === "joining" || this.state === "joined") {
      // Real lib: throw new Error(`cannot add \`${type}\` callbacks ...`)
      // Bilježimo umjesto throw-a da izbjegnemo unhandled rejection šum,
      // ali violation je ekvivalent crash-a u produkciji.
      this.violations.push(
        `cannot add \`${type}\` callbacks for ${this.topic} after \`subscribe()\`.`,
      );
      return this;
    }
    this.postgresCallbacks++;
    return this;
  }

  subscribe(cb?: (status: string, err?: Error) => void) {
    this.state = "joining";
    queueMicrotask(() => {
      this.state = "joined";
      cb?.("SUBSCRIBED");
    });
    return this;
  }

  unsubscribe() {
    this.state = "closed";
    return Promise.resolve("ok");
  }
}

function createFakeSb() {
  const violations: string[] = [];
  const channels: FakeChannel[] = [];
  let authCallback: AuthCallback | null = null;
  const session = { access_token: "fake-jwt" };

  const sb = {
    auth: {
      getSession: () => Promise.resolve({ data: { session } }),
      onAuthStateChange: (cb: AuthCallback) => {
        authCallback = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    },
    realtime: {
      setAuth: () => Promise.resolve(),
    },
    channel(topic: string) {
      const realtimeTopic = `realtime:${topic}`;
      const exists = channels.find((c) => c.topic === realtimeTopic);
      if (exists) return exists; // dedup — isto kao RealtimeClient.channel()
      const chan = new FakeChannel(topic, violations);
      channels.push(chan);
      return chan;
    },
    getChannels: () => [...channels],
    removeChannel: async (ch: FakeChannel) => {
      await ch.unsubscribe();
      const i = channels.indexOf(ch);
      if (i >= 0) channels.splice(i, 1);
      return "ok";
    },
  };

  return {
    sb,
    violations,
    channels,
    fireAuthEvent: (event: string) => authCallback?.(event, session),
  };
}

let fake: ReturnType<typeof createFakeSb>;

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => fake.sb,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { AppointmentsRealtime } from "@/components/admin/AppointmentsRealtime";

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("AppointmentsRealtime", () => {
  beforeEach(() => {
    fake = createFakeSb();
  });

  it("subscribe-uje tačno jednom i bez violation-a u normalnom mount-u", async () => {
    render(<AppointmentsRealtime />);
    await flush();

    expect(fake.violations).toEqual([]);
    expect(fake.channels).toHaveLength(1);
    expect(fake.channels[0].postgresCallbacks).toBe(1);
  });

  it("ne dodaje postgres_changes callback dva puta kad auth event stigne tokom prvog subscribe-a (race)", async () => {
    render(<AppointmentsRealtime />);
    // INITIAL_SESSION/SIGNED_IN stiže dok je prvi ensureSubscribed još u
    // await-u na getSession() — prije nego što je `channel` dodijeljen.
    fake.fireAuthEvent("INITIAL_SESSION");
    fake.fireAuthEvent("SIGNED_IN");
    await flush();

    expect(fake.violations).toEqual([]);
    expect(fake.channels).toHaveLength(1);
    expect(fake.channels[0].postgresCallbacks).toBe(1);
  });

  it("ne ostavlja duple kanale nakon StrictMode remount-a (stari kanal istog topic-a)", async () => {
    const first = render(<AppointmentsRealtime />);
    await flush();
    first.unmount();
    // Cleanup je fire-and-forget (void removeChannel) — remount može
    // zateći stari kanal u listi. Dedup bi tada vratio subscribe-ovan kanal.
    render(<AppointmentsRealtime />);
    await flush();

    expect(fake.violations).toEqual([]);
    await waitFor(() => {
      expect(fake.channels).toHaveLength(1);
      expect(fake.channels[0].postgresCallbacks).toBe(1);
    });
  });
});
