import { describe, expect, it } from "vitest";
import { CachedReferenceDataRepository } from "../../src/repositories/cachedReferenceDataRepository";
import { ROUND_START, aGame, aRound, anOdd } from "../support/builders";
import { InMemoryReferenceDataRepository, MutableClock } from "../support/fakes";

const TTL_SECONDS = 300;
const TTL_MILLISECONDS = TTL_SECONDS * 1000;

interface Scenario {
  readonly cached: CachedReferenceDataRepository;
  readonly source: InMemoryReferenceDataRepository;
  readonly clock: MutableClock;
}

function scenario(): Scenario {
  const source = new InMemoryReferenceDataRepository();
  source.games.push(aGame());
  source.odds.push(anOdd());
  const clock = new MutableClock(ROUND_START);
  const cached = new CachedReferenceDataRepository(source, clock.read, {
    ttlSeconds: TTL_SECONDS,
    maxEntries: 100,
  });
  return { cached, source, clock };
}

describe("CachedReferenceDataRepository", () => {
  it("reads games and odds from the source only once while they are cached", async () => {
    const { cached, source } = scenario();

    const games = [await cached.findGame("1"), await cached.findGame("1")];
    const odds = [await cached.findOdd("roulette-red"), await cached.findOdd("roulette-red")];

    expect(games).toEqual([aGame(), aGame()]);
    expect(odds).toEqual([anOdd(), anOdd()]);
    expect(source.lookups).toEqual({ games: 1, rounds: 0, odds: 1 });
  });

  it("reads games and odds again once the time to live has elapsed", async () => {
    const { cached, source, clock } = scenario();
    await cached.findGame("1");
    await cached.findOdd("roulette-red");

    clock.advance(TTL_MILLISECONDS);
    await cached.findGame("1");
    await cached.findOdd("roulette-red");

    expect(source.lookups).toEqual({ games: 2, rounds: 0, odds: 2 });
  });

  it("keeps a round cached until its end date even beyond the time to live", async () => {
    const { cached, source, clock } = scenario();
    const endDate = new Date(ROUND_START.getTime() + 10 * TTL_MILLISECONDS);
    source.rounds.push(aRound({ endDate }));
    await cached.findRound("1", "1002");

    clock.set(new Date(endDate.getTime() - 1));
    await cached.findRound("1", "1002");
    expect(source.lookups.rounds).toBe(1);

    clock.set(endDate);
    await cached.findRound("1", "1002");
    expect(source.lookups.rounds).toBe(2);
  });

  it("caches a round that has already ended only for the time to live", async () => {
    const { cached, source, clock } = scenario();
    source.rounds.push(aRound({ endDate: new Date(ROUND_START.getTime() - 1) }));
    await cached.findRound("1", "1002");

    clock.advance(TTL_MILLISECONDS - 1);
    await cached.findRound("1", "1002");
    expect(source.lookups.rounds).toBe(1);

    clock.advance(1);
    await cached.findRound("1", "1002");
    expect(source.lookups.rounds).toBe(2);
  });

  it("does not cache missing entries so newly created data is visible immediately", async () => {
    const { cached, source } = scenario();

    expect(await cached.findRound("1", "1003")).toBeUndefined();
    source.rounds.push(aRound({ roundId: "1003" }));

    expect(await cached.findRound("1", "1003")).toEqual(aRound({ roundId: "1003" }));
  });

  it("keeps rounds with the same id from different games apart", async () => {
    const { cached, source } = scenario();
    source.rounds.push(
      aRound({ gameId: "1", roundId: "1" }),
      aRound({ gameId: "2", roundId: "1" }),
    );

    const first = await cached.findRound("1", "1");
    const second = await cached.findRound("2", "1");

    expect(first?.gameId).toBe("1");
    expect(second?.gameId).toBe("2");
  });
});
