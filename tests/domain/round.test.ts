import { describe, expect, it } from "vitest";
import { bettingWindowEnd, isBettingWindowOpen, openRound } from "../../src/domain/round";
import { ROUND_START, aRound } from "../support/builders";

describe("isBettingWindowOpen", () => {
  const round = aRound({ startDate: ROUND_START, bettingDurationSeconds: 30 });

  it.each([
    ["one millisecond before the round starts", "2026-10-04T21:59:59.999Z", false],
    ["exactly when the round starts", "2026-10-04T22:00:00.000Z", true],
    ["in the middle of the window", "2026-10-04T22:00:15.000Z", true],
    ["in the last millisecond of the window", "2026-10-04T22:00:29.999Z", true],
    ["exactly when the window ends", "2026-10-04T22:00:30.000Z", false],
    ["while the round is still running", "2026-10-04T22:00:45.000Z", false],
    ["after the round has ended", "2026-10-04T22:05:00.000Z", false],
  ])("is evaluated %s", (_description, instant, expected) => {
    expect(isBettingWindowOpen(round, new Date(instant))).toBe(expected);
  });
});

describe("bettingWindowEnd", () => {
  it("adds the betting duration to the start date", () => {
    const round = aRound({ startDate: ROUND_START, bettingDurationSeconds: 45 });

    expect(bettingWindowEnd(round)).toEqual(new Date("2026-10-04T22:00:45.000Z"));
  });
});

describe("openRound", () => {
  it("creates an open round with a 30 second betting window that ends after one minute", () => {
    expect(openRound("1003", "1", ROUND_START)).toEqual({
      roundId: "1003",
      gameId: "1",
      startDate: ROUND_START,
      bettingDurationSeconds: 30,
      endDate: new Date("2026-10-04T22:01:00.000Z"),
      status: "open",
    });
  });
});
