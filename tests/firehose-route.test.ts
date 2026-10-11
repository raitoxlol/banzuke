import test from "node:test";
import assert from "node:assert/strict";

test("GET shares in-flight polling, preserves 304 data, respects reset and prunes during deferral", async () => {
  const originalFetch = globalThis.fetch, originalNow = Date.now, originalToken = process.env.GITHUB_TOKEN;
  delete process.env.GITHUB_TOKEN;
  let now = Date.UTC(2026, 9, 11), calls = 0;
  Date.now = () => now;
  const event = { id: "route-1", type: "PushEvent", actor: { login: "alice" }, repo: { name: "alice/project" }, payload: { size: 1 }, created_at: new Date(now - 36 * 3_600_000).toISOString() };
  let complete: (r: Response) => void = () => { throw new Error("Fetch hasn't started"); };
  let implementation = async (_url: string | URL | Request, _init?: RequestInit): Promise<Response> => new Promise((resolve) => { complete = resolve; });
  globalThis.fetch = async (url, init) => { calls++; return implementation(url, init); };
  try {
    const { GET } = await import("../app/api/firehose/route");
    const first = GET(), second = GET();
    assert.equal(calls, 1);
    complete(Response.json([event], { headers: { etag: '"sample-1"', "x-poll-interval": "60" } }));
    const [one, two] = await Promise.all([first, second]);
    const data = await one.json(); assert.equal(data.status, "live"); assert.equal(data.plays.length, 1);
    assert.deepEqual(await two.json(), data); assert.equal(calls, 1);
    now += 61_000;
    implementation = async (_url, init) => {
      assert.equal(new Headers(init?.headers).get("if-none-match"), '"sample-1"');
      return new Response(null, { status: 304, headers: { "x-poll-interval": "120" } });
    };
    const unchanged = await (await GET()).json();
    assert.equal(unchanged.plays[0].at, data.plays[0].at); assert.equal(unchanged.nextPollMs, 120_000);
    now += 121_000;
    const reset = now + 2 * 3_600_000;
    implementation = async () => new Response(null, { status: 429, headers: { "x-ratelimit-reset": String(reset / 1000) } });
    const limited = await (await GET()).json(); assert.equal(limited.status, "rate_limited"); assert.equal(limited.nextPollMs, 2 * 3_600_000);
    const callsAtLimit = calls;
    now += 3_600_000;
    const deferred = await (await GET()).json(); assert.equal(calls, callsAtLimit); assert.deepEqual(deferred.plays, []); assert.equal(deferred.status, "rate_limited");
    now = reset + 1;
    implementation = async () => Response.json({ invalid: "not an events array" });
    const invalid = await (await GET()).json(); assert.equal(invalid.status, "error"); assert.deepEqual(invalid.plays, []);
    now += 61_000;
    implementation = async () => { throw new Error("Network failure"); };
    const failed = await (await GET()).json(); assert.equal(failed.status, "error"); assert.deepEqual(failed.plays, []);
    now += 61_000;
    implementation = async () => Response.json([]);
    const empty = await (await GET()).json(); assert.equal(empty.status, "live"); assert.deepEqual(empty.plays, []);
  } finally {
    globalThis.fetch = originalFetch; Date.now = originalNow;
    if (originalToken === undefined) delete process.env.GITHUB_TOKEN; else process.env.GITHUB_TOKEN = originalToken;
  }
});
