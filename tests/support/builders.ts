import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { Bet, PlaceBetCommand } from "../../src/domain/bet";
import type { Game } from "../../src/domain/game";
import type { Odd } from "../../src/domain/odd";
import type { Round } from "../../src/domain/round";

export const ROUND_START = new Date("2026-10-04T22:00:00.000Z");
export const WITHIN_BETTING_WINDOW = new Date("2026-10-04T22:00:10.000Z");

export function aGame(overrides: Partial<Game> = {}): Game {
  return { gameId: "1", name: "Roulette", ...overrides };
}

export function anOdd(overrides: Partial<Odd> = {}): Odd {
  return { oddId: "roulette-red", gameId: "1", value: "Red", ...overrides };
}

export function aRound(overrides: Partial<Round> = {}): Round {
  return {
    roundId: "1002",
    gameId: "1",
    startDate: ROUND_START,
    bettingDurationSeconds: 30,
    endDate: new Date("2026-10-04T22:01:00.000Z"),
    status: "open",
    ...overrides,
  };
}

export function aPlaceBetCommand(overrides: Partial<PlaceBetCommand> = {}): PlaceBetCommand {
  return {
    userId: "user-1",
    betId: "bet-1",
    gameId: "1",
    roundId: "1002",
    oddId: "roulette-red",
    betAmount: 10,
    ...overrides,
  };
}

export function aBet(overrides: Partial<Bet> = {}): Bet {
  return {
    ...aPlaceBetCommand(),
    status: "ACCEPTED",
    createdAt: WITHIN_BETTING_WINDOW,
    ...overrides,
  };
}

export interface ApiEventOptions {
  readonly headers?: Record<string, string>;
  readonly body?: string;
  readonly isBase64Encoded?: boolean;
}

export function anApiEvent(options: ApiEventOptions = {}): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: "POST /bets",
    rawPath: "/bets",
    rawQueryString: "",
    headers: options.headers ?? {},
    requestContext: {
      accountId: "000000000000",
      apiId: "api",
      domainName: "localhost",
      domainPrefix: "api",
      http: {
        method: "POST",
        path: "/bets",
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "vitest",
      },
      requestId: "request-1",
      routeKey: "POST /bets",
      stage: "$default",
      time: "04/Oct/2026:22:00:10 +0000",
      timeEpoch: WITHIN_BETTING_WINDOW.getTime(),
    },
    isBase64Encoded: options.isBase64Encoded ?? false,
    ...(options.body === undefined ? {} : { body: options.body }),
  };
}

export const BET_HEADERS: Readonly<Record<string, string>> = {
  "x-user-id": "user-1",
  "idempotency-key": "bet-1",
};

export const BET_BODY = {
  gameId: "1",
  roundId: "1002",
  oddId: "roulette-red",
  betAmount: 10,
};

export function aPlaceBetEvent(options: ApiEventOptions = {}): APIGatewayProxyEventV2 {
  return anApiEvent({
    headers: { ...BET_HEADERS },
    body: JSON.stringify(BET_BODY),
    ...options,
  });
}

export function responseBody(response: APIGatewayProxyStructuredResultV2): unknown {
  return JSON.parse(response.body ?? "null");
}
