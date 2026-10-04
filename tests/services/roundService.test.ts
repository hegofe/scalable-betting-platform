import { describe, expect, it } from "vitest";
import { GameNotFoundError } from "../../src/domain/errors";
import { RoundService } from "../../src/services/roundService";
import { ROUND_START, aGame } from "../support/builders";
import {
  InMemoryReferenceDataRepository,
  InMemoryRoundRepository,
  MutableClock,
} from "../support/fakes";

interface Scenario {
  readonly service: RoundService;
  readonly rounds: InMemoryRoundRepository;
  readonly clock: MutableClock;
}

function scenario(): Scenario {
  const referenceData = new InMemoryReferenceDataRepository();
  referenceData.games.push(aGame(), aGame({ gameId: "2", name: "Baccarat" }));
  const rounds = new InMemoryRoundRepository();
  rounds.counters.set("1", 1002);
  rounds.counters.set("2", 2001);
  const clock = new MutableClock(ROUND_START);
  return { service: new RoundService(referenceData, rounds, clock.read), rounds, clock };
}

describe("RoundService.createRound", () => {
  it("creates an open round that starts when the request is received", async () => {
    const { service, rounds } = scenario();

    const round = await service.createRound({ gameId: "1" });

    expect(round).toEqual({
      roundId: "1003",
      gameId: "1",
      startDate: ROUND_START,
      bettingDurationSeconds: 30,
      endDate: new Date("2026-10-04T22:01:00.000Z"),
      status: "open",
    });
    expect(rounds.rounds).toEqual([round]);
  });

  it("numbers the rounds of each game independently", async () => {
    const { service } = scenario();

    const created = [
      await service.createRound({ gameId: "1" }),
      await service.createRound({ gameId: "2" }),
      await service.createRound({ gameId: "1" }),
    ];

    expect(created.map((round) => round.roundId)).toEqual(["1003", "2002", "1004"]);
  });

  it("rejects an unknown game without consuming a round id", async () => {
    const { service, rounds } = scenario();

    await expect(service.createRound({ gameId: "9" })).rejects.toBeInstanceOf(GameNotFoundError);
    expect(rounds.rounds).toEqual([]);
    expect(rounds.counters.has("9")).toBe(false);
  });
});
