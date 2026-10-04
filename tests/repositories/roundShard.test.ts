import { describe, expect, it } from "vitest";
import { roundShardFor, roundShardKey, shardIndex } from "../../src/repositories/roundShard";

const SHARD_COUNT = 10;
const ROUND = { gameId: "1", roundId: "1002" };

describe("roundShardKey", () => {
  it("joins the game, the round and the shard number", () => {
    expect(roundShardKey(ROUND, 5)).toBe("1#1002#5");
  });
});

describe("shardIndex", () => {
  it("always assigns the same bet to the same shard", () => {
    const betId = "4f6c1c0e-9d55-4c8e-9a37-0e3c6a2b7d11";

    expect(shardIndex(betId, SHARD_COUNT)).toBe(shardIndex(betId, SHARD_COUNT));
  });

  it("stays within the configured number of shards", () => {
    const indexes = Array.from({ length: 1000 }, (_, bet) => shardIndex(`bet-${bet}`, SHARD_COUNT));

    expect(Math.min(...indexes)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...indexes)).toBeLessThan(SHARD_COUNT);
  });

  it("spreads bets evenly across the shards", () => {
    const total = 20_000;
    const counts = new Array<number>(SHARD_COUNT).fill(0);
    for (let bet = 0; bet < total; bet += 1) {
      const index = shardIndex(crypto.randomUUID(), SHARD_COUNT);
      counts[index] = (counts[index] ?? 0) + 1;
    }

    const expectedPerShard = total / SHARD_COUNT;
    for (const count of counts) {
      expect(count).toBeGreaterThan(expectedPerShard * 0.85);
      expect(count).toBeLessThan(expectedPerShard * 1.15);
    }
  });
});

describe("roundShardFor", () => {
  it("builds the shard key of a bet from its round and bet id", () => {
    const betId = "bet-1";

    expect(roundShardFor(ROUND, betId, SHARD_COUNT)).toBe(
      `1#1002#${shardIndex(betId, SHARD_COUNT)}`,
    );
  });

  it("separates rounds with the same id that belong to different games", () => {
    const betId = "bet-1";

    expect(roundShardFor({ gameId: "1", roundId: "7" }, betId, SHARD_COUNT)).not.toBe(
      roundShardFor({ gameId: "2", roundId: "7" }, betId, SHARD_COUNT),
    );
  });
});
