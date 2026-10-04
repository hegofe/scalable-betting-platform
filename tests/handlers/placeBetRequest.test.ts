import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { describe, expect, it } from "vitest";
import { RequestValidationError } from "../../src/handlers/errors";
import { parsePlaceBetRequest } from "../../src/handlers/placeBetRequest";
import { BET_BODY, BET_HEADERS, aPlaceBetEvent, anApiEvent } from "../support/builders";

function violations(event: APIGatewayProxyEventV2): readonly string[] {
  try {
    parsePlaceBetRequest(event);
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return error.details;
    }
    throw error;
  }
  return [];
}

function eventWithBody(body: Record<string, unknown>): APIGatewayProxyEventV2 {
  return aPlaceBetEvent({ body: JSON.stringify(body) });
}

describe("parsePlaceBetRequest", () => {
  it("builds the command from the headers and the body", () => {
    expect(parsePlaceBetRequest(aPlaceBetEvent())).toEqual({
      userId: "user-1",
      betId: "bet-1",
      gameId: "1",
      roundId: "1002",
      oddId: "roulette-red",
      betAmount: 10,
    });
  });

  it("reads the headers regardless of their casing", () => {
    const event = aPlaceBetEvent({
      headers: { "X-User-Id": "user-7", "Idempotency-Key": "bet-7" },
    });

    expect(parsePlaceBetRequest(event)).toMatchObject({ userId: "user-7", betId: "bet-7" });
  });

  it("decodes a base64 encoded body", () => {
    const event = aPlaceBetEvent({
      body: Buffer.from(JSON.stringify(BET_BODY)).toString("base64"),
      isBase64Encoded: true,
    });

    expect(parsePlaceBetRequest(event)).toMatchObject({ roundId: "1002", betAmount: 10 });
  });

  it("trims surrounding whitespace from identifiers", () => {
    const event = eventWithBody({ ...BET_BODY, gameId: " 1 " });

    expect(parsePlaceBetRequest(event).gameId).toBe("1");
  });

  it("reports every problem of the request at once", () => {
    const event = anApiEvent({ body: JSON.stringify({ gameId: "", roundId: 5, betAmount: -1 }) });

    expect(violations(event)).toEqual([
      "Header x-user-id is required and must be a non-empty string",
      "Header idempotency-key is required and must be a non-empty string",
      "Field gameId is required and must be a non-empty string",
      "Field roundId is required and must be a non-empty string",
      "Field oddId is required and must be a non-empty string",
      "Field betAmount is required and must be a positive number",
    ]);
  });

  it.each([
    ["a missing body", anApiEvent({ headers: { ...BET_HEADERS } }), "Request body is required"],
    ["a blank body", aPlaceBetEvent({ body: "  " }), "Request body is required"],
    ["malformed JSON", aPlaceBetEvent({ body: "{nope" }), "Request body must be valid JSON"],
    ["a JSON array", aPlaceBetEvent({ body: "[1]" }), "Request body must be a JSON object"],
    ["a JSON null", aPlaceBetEvent({ body: "null" }), "Request body must be a JSON object"],
  ])("rejects %s", (_description, event, expected) => {
    expect(violations(event)).toEqual([expected]);
  });

  it.each([
    ["zero", 0],
    ["a negative number", -5],
    ["a numeric string", "10"],
    ["null", null],
  ])("rejects a bet amount that is %s", (_description, betAmount) => {
    expect(violations(eventWithBody({ ...BET_BODY, betAmount }))).toEqual([
      "Field betAmount is required and must be a positive number",
    ]);
  });

  it("accepts a bet amount with decimals", () => {
    expect(parsePlaceBetRequest(eventWithBody({ ...BET_BODY, betAmount: 2.5 })).betAmount).toBe(
      2.5,
    );
  });

  it("rejects an idempotency key with characters outside the allowed set", () => {
    const event = aPlaceBetEvent({
      headers: { "x-user-id": "user-1", "idempotency-key": "a b#c" },
    });

    expect(violations(event)).toEqual([
      "Header idempotency-key may only contain letters, digits and the characters _ . : -",
    ]);
  });

  it("accepts a UUID as idempotency key", () => {
    const key = "4f6c1c0e-9d55-4c8e-9a37-0e3c6a2b7d11";
    const event = aPlaceBetEvent({ headers: { "x-user-id": "user-1", "idempotency-key": key } });

    expect(parsePlaceBetRequest(event).betId).toBe(key);
  });

  it("rejects identifiers longer than 128 characters", () => {
    const event = eventWithBody({ ...BET_BODY, oddId: "x".repeat(129) });

    expect(violations(event)).toEqual(["Field oddId must be at most 128 characters long"]);
  });
});
