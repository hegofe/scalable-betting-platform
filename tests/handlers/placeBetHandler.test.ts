import { describe, expect, it } from "vitest";
import type { Bet } from "../../src/domain/bet";
import {
  BettingWindowClosedError,
  DuplicateBetError,
  GameNotFoundError,
  InsufficientFundsError,
  OddGameMismatchError,
  OddNotFoundError,
  RoundNotFoundError,
} from "../../src/domain/errors";
import {
  createPlaceBetHandler,
  type BetPlacer,
  type PlaceBetHandler,
} from "../../src/handlers/placeBetHandler";
import { aBet, aPlaceBetEvent, anApiEvent, responseBody } from "../support/builders";
import { RecordingLogger } from "../support/fakes";

interface Scenario {
  readonly handler: PlaceBetHandler;
  readonly logger: RecordingLogger;
}

function scenario(outcome: Bet | Error): Scenario {
  const betPlacer: BetPlacer = {
    placeBet: () => (outcome instanceof Error ? Promise.reject(outcome) : Promise.resolve(outcome)),
  };
  const logger = new RecordingLogger();
  return { handler: createPlaceBetHandler(betPlacer, logger), logger };
}

describe("place bet handler", () => {
  it("responds 201 with the accepted bet", async () => {
    const { handler, logger } = scenario(aBet());

    const response = await handler(aPlaceBetEvent());

    expect(response.statusCode).toBe(201);
    expect(response.headers).toEqual({ "content-type": "application/json" });
    expect(responseBody(response)).toEqual({
      betId: "bet-1",
      userId: "user-1",
      gameId: "1",
      roundId: "1002",
      oddId: "roulette-red",
      betAmount: 10,
      status: "ACCEPTED",
      createdAt: "2026-10-04T22:00:10.000Z",
    });
    expect(logger.entries).toEqual([
      {
        level: "INFO",
        message: "Bet accepted",
        context: { requestId: "request-1", userId: "user-1", betId: "bet-1", roundId: "1002" },
      },
    ]);
  });

  it("passes the parsed command to the service", async () => {
    const received: unknown[] = [];
    const betPlacer: BetPlacer = {
      placeBet: (command) => {
        received.push(command);
        return Promise.resolve(aBet());
      },
    };

    await createPlaceBetHandler(betPlacer, new RecordingLogger())(aPlaceBetEvent());

    expect(received).toEqual([
      {
        userId: "user-1",
        betId: "bet-1",
        gameId: "1",
        roundId: "1002",
        oddId: "roulette-red",
        betAmount: 10,
      },
    ]);
  });

  it("responds 400 with the list of problems when the request is not valid", async () => {
    const { handler, logger } = scenario(aBet());

    const response = await handler(anApiEvent({ body: "{}" }));

    expect(response.statusCode).toBe(400);
    expect(responseBody(response)).toMatchObject({
      error: { code: "INVALID_REQUEST", message: "The request is not valid" },
    });
    expect(logger.entries.map((entry) => entry.level)).toEqual(["WARN"]);
  });

  it.each([
    [new GameNotFoundError("9"), 422, "GAME_NOT_FOUND"],
    [new RoundNotFoundError("9999", "1"), 422, "ROUND_NOT_FOUND"],
    [new OddNotFoundError("unknown"), 422, "ODD_NOT_FOUND"],
    [new OddGameMismatchError("baccarat-tie", "1"), 422, "ODD_GAME_MISMATCH"],
    [new BettingWindowClosedError("1002"), 422, "BETTING_WINDOW_CLOSED"],
    [new InsufficientFundsError("user-1"), 402, "INSUFFICIENT_FUNDS"],
    [new DuplicateBetError("bet-1"), 409, "DUPLICATE_BET"],
  ])("maps %o to status %i with code %s", async (error, status, code) => {
    const { handler, logger } = scenario(error);

    const response = await handler(aPlaceBetEvent());

    expect(response.statusCode).toBe(status);
    expect(responseBody(response)).toEqual({ error: { code, message: error.message } });
    expect(logger.entries).toEqual([
      {
        level: "WARN",
        message: "Bet rejected",
        context: { requestId: "request-1", code, reason: error.message },
      },
    ]);
  });

  it("responds 500 without leaking details when an unexpected error occurs", async () => {
    const { handler, logger } = scenario(new Error("connection refused to 10.0.0.12"));

    const response = await handler(aPlaceBetEvent());

    expect(response.statusCode).toBe(500);
    expect(responseBody(response)).toEqual({
      error: { code: "INTERNAL_ERROR", message: "Internal server error" },
    });
    expect(logger.entries).toHaveLength(1);
    expect(logger.entries[0]).toMatchObject({
      level: "ERROR",
      message: "Bet placement failed",
      context: { requestId: "request-1", errorMessage: "connection refused to 10.0.0.12" },
    });
  });
});
