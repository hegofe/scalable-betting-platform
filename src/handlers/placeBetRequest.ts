import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { PlaceBetCommand } from "../domain/bet";
import { Violations, findHeader, parseJsonBody, readIdentifier } from "./requestParsing";

const USER_ID_HEADER = "x-user-id";
const IDEMPOTENCY_KEY_HEADER = "idempotency-key";
const IDEMPOTENCY_KEY_PATTERN = /^[\w.:-]+$/;

function readIdempotencyKey(event: APIGatewayProxyEventV2, violations: Violations): string {
  const label = `Header ${IDEMPOTENCY_KEY_HEADER}`;
  const key = readIdentifier(findHeader(event, IDEMPOTENCY_KEY_HEADER), label, violations);
  if (key !== "" && !IDEMPOTENCY_KEY_PATTERN.test(key)) {
    violations.add(`${label} may only contain letters, digits and the characters _ . : -`);
  }
  return key;
}

function readBetAmount(value: unknown, violations: Violations): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    violations.add("Field betAmount is required and must be a positive number");
    return 0;
  }
  return value;
}

export function parsePlaceBetRequest(event: APIGatewayProxyEventV2): PlaceBetCommand {
  const body = parseJsonBody(event);
  const violations = new Violations();

  const command: PlaceBetCommand = {
    userId: readIdentifier(
      findHeader(event, USER_ID_HEADER),
      `Header ${USER_ID_HEADER}`,
      violations,
    ),
    betId: readIdempotencyKey(event, violations),
    gameId: readIdentifier(body.gameId, "Field gameId", violations),
    roundId: readIdentifier(body.roundId, "Field roundId", violations),
    oddId: readIdentifier(body.oddId, "Field oddId", violations),
    betAmount: readBetAmount(body.betAmount, violations),
  };

  violations.throwIfAny();
  return command;
}
