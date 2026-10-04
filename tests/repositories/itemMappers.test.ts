import { describe, expect, it } from "vitest";
import { DataIntegrityError } from "../../src/repositories/errors";
import { toBetItem, toGame, toOdd, toRound, toRoundItem } from "../../src/repositories/itemMappers";
import { aBet, aGame, aRound, anOdd } from "../support/builders";

const ROUND_ITEM = {
  roundId: "1002",
  gameId: "1",
  startDate: "2026-10-04T22:00:00.000Z",
  bettingDurationSeconds: 30,
  endDate: "2026-10-04T22:01:00.000Z",
  status: "open",
};

describe("toRound", () => {
  it("converts a stored item into a round with real dates", () => {
    expect(toRound(ROUND_ITEM)).toEqual(aRound());
  });

  it.each([
    ["a missing identifier", { roundId: undefined }],
    ["an empty identifier", { roundId: "" }],
    ["a date that cannot be parsed", { startDate: "yesterday" }],
    ["a duration that is not a number", { bettingDurationSeconds: "30" }],
    ["an unknown status", { status: "paused" }],
  ])("rejects an item with %s", (_description, overrides) => {
    expect(() => toRound({ ...ROUND_ITEM, ...overrides })).toThrow(DataIntegrityError);
  });
});

describe("toRoundItem", () => {
  it("stores dates as ISO 8601 text with millisecond precision", () => {
    expect(toRoundItem(aRound())).toEqual(ROUND_ITEM);
  });

  it("produces an item that converts back to the same round", () => {
    expect(toRound(toRoundItem(aRound()))).toEqual(aRound());
  });
});

describe("toGame and toOdd", () => {
  it("convert stored items into domain objects", () => {
    expect(toGame({ gameId: "1", name: "Roulette" })).toEqual(aGame());
    expect(toOdd({ oddId: "roulette-red", gameId: "1", value: "Red" })).toEqual(anOdd());
  });

  it("reject items with missing fields", () => {
    expect(() => toGame({ gameId: "1" })).toThrow(DataIntegrityError);
    expect(() => toOdd({ oddId: "roulette-red", gameId: "1" })).toThrow(DataIntegrityError);
  });
});

describe("toBetItem", () => {
  it("stores the bet together with its round shard", () => {
    expect(toBetItem(aBet(), "1#1002#5")).toEqual({
      userId: "user-1",
      betId: "bet-1",
      gameId: "1",
      roundId: "1002",
      oddId: "roulette-red",
      betAmount: 10,
      status: "ACCEPTED",
      createdAt: "2026-10-04T22:00:10.000Z",
      roundShard: "1#1002#5",
    });
  });
});
