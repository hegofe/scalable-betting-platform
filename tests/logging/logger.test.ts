import { describe, expect, it } from "vitest";
import { JsonLogger, describeError } from "../../src/logging/logger";

function capture(): { readonly lines: string[]; readonly logger: JsonLogger } {
  const lines: string[] = [];
  return { lines, logger: new JsonLogger((line) => lines.push(line)) };
}

function parse(line: string | undefined): unknown {
  return JSON.parse(line ?? "null");
}

describe("JsonLogger", () => {
  it("writes one JSON line per entry with its level, message and context", () => {
    const { lines, logger } = capture();

    logger.info("Bet accepted", { requestId: "request-1", betId: "bet-1" });

    expect(lines).toHaveLength(1);
    expect(parse(lines[0])).toMatchObject({
      level: "INFO",
      message: "Bet accepted",
      requestId: "request-1",
      betId: "bet-1",
    });
  });

  it("stamps every entry with an ISO 8601 timestamp", () => {
    const { lines, logger } = capture();

    logger.warn("Bet rejected");

    expect(parse(lines[0])).toMatchObject({
      level: "WARN",
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/) as unknown,
    });
  });

  it("uses a distinct level for errors", () => {
    const { lines, logger } = capture();

    logger.error("Bet placement failed");

    expect(parse(lines[0])).toMatchObject({ level: "ERROR", message: "Bet placement failed" });
  });
});

describe("describeError", () => {
  it("extracts the name, message and stack of an error", () => {
    const error = new TypeError("boom");

    expect(describeError(error)).toEqual({
      errorName: "TypeError",
      errorMessage: "boom",
      stack: error.stack,
    });
  });

  it("describes a value that is not an error by its text", () => {
    expect(describeError("plain failure")).toEqual({ errorMessage: "plain failure" });
  });
});
