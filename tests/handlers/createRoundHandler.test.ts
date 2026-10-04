import { describe, expect, it } from "vitest";
import { GameNotFoundError } from "../../src/domain/errors";
import type { Round } from "../../src/domain/round";
import {
  createCreateRoundHandler,
  type CreateRoundHandler,
  type RoundCreator,
} from "../../src/handlers/createRoundHandler";
import { aRound, anApiEvent, responseBody } from "../support/builders";
import { RecordingLogger } from "../support/fakes";

interface Scenario {
  readonly handler: CreateRoundHandler;
  readonly logger: RecordingLogger;
  readonly received: unknown[];
}

function scenario(outcome: Round | Error): Scenario {
  const received: unknown[] = [];
  const roundCreator: RoundCreator = {
    createRound: (command) => {
      received.push(command);
      return outcome instanceof Error ? Promise.reject(outcome) : Promise.resolve(outcome);
    },
  };
  const logger = new RecordingLogger();
  return { handler: createCreateRoundHandler(roundCreator, logger), logger, received };
}

function eventWithBody(body: unknown): ReturnType<typeof anApiEvent> {
  return anApiEvent({ body: JSON.stringify(body) });
}

describe("create round handler", () => {
  it("responds 201 with the created round", async () => {
    const { handler, logger, received } = scenario(aRound({ roundId: "1003" }));

    const response = await handler(eventWithBody({ gameId: "1" }));

    expect(received).toEqual([{ gameId: "1" }]);
    expect(response.statusCode).toBe(201);
    expect(responseBody(response)).toEqual({
      roundId: "1003",
      gameId: "1",
      startDate: "2026-10-04T22:00:00.000Z",
      bettingDurationSeconds: 30,
      endDate: "2026-10-04T22:01:00.000Z",
      status: "open",
    });
    expect(logger.entries).toEqual([
      {
        level: "INFO",
        message: "Round created",
        context: { requestId: "request-1", roundId: "1003", gameId: "1" },
      },
    ]);
  });

  it.each([
    ["the game id is missing", {}],
    ["the game id is a number", { gameId: 1 }],
    ["the game id is empty", { gameId: "" }],
  ])("responds 400 when %s", async (_description, body) => {
    const { handler, received } = scenario(aRound());

    const response = await handler(eventWithBody(body));

    expect(response.statusCode).toBe(400);
    expect(responseBody(response)).toEqual({
      error: {
        code: "INVALID_REQUEST",
        message: "The request is not valid",
        details: ["Field gameId is required and must be a non-empty string"],
      },
    });
    expect(received).toEqual([]);
  });

  it("responds 422 when the game does not exist", async () => {
    const { handler } = scenario(new GameNotFoundError("9"));

    const response = await handler(eventWithBody({ gameId: "9" }));

    expect(response.statusCode).toBe(422);
    expect(responseBody(response)).toEqual({
      error: { code: "GAME_NOT_FOUND", message: "Game 9 does not exist" },
    });
  });

  it("responds 500 without leaking details when an unexpected error occurs", async () => {
    const { handler, logger } = scenario(new Error("counter table unavailable"));

    const response = await handler(eventWithBody({ gameId: "1" }));

    expect(response.statusCode).toBe(500);
    expect(responseBody(response)).toEqual({
      error: { code: "INTERNAL_ERROR", message: "Internal server error" },
    });
    expect(logger.entries.map((entry) => entry.level)).toEqual(["ERROR"]);
  });
});
