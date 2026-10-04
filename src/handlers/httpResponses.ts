import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { Bet } from "../domain/bet";
import { DomainError, type DomainErrorCode } from "../domain/errors";
import type { Round } from "../domain/round";
import { RequestValidationError } from "./errors";

const HTTP_CREATED = 201;
const HTTP_BAD_REQUEST = 400;
const HTTP_PAYMENT_REQUIRED = 402;
const HTTP_CONFLICT = 409;
const HTTP_UNPROCESSABLE_ENTITY = 422;
const HTTP_INTERNAL_SERVER_ERROR = 500;

const DOMAIN_ERROR_STATUS: Readonly<Record<DomainErrorCode, number>> = {
  GAME_NOT_FOUND: HTTP_UNPROCESSABLE_ENTITY,
  ROUND_NOT_FOUND: HTTP_UNPROCESSABLE_ENTITY,
  ODD_NOT_FOUND: HTTP_UNPROCESSABLE_ENTITY,
  ODD_GAME_MISMATCH: HTTP_UNPROCESSABLE_ENTITY,
  BETTING_WINDOW_CLOSED: HTTP_UNPROCESSABLE_ENTITY,
  INSUFFICIENT_FUNDS: HTTP_PAYMENT_REQUIRED,
  DUPLICATE_BET: HTTP_CONFLICT,
};

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function betResponse(bet: Bet): APIGatewayProxyStructuredResultV2 {
  return jsonResponse(HTTP_CREATED, {
    betId: bet.betId,
    userId: bet.userId,
    gameId: bet.gameId,
    roundId: bet.roundId,
    oddId: bet.oddId,
    betAmount: bet.betAmount,
    status: bet.status,
    createdAt: bet.createdAt.toISOString(),
  });
}

export function roundResponse(round: Round): APIGatewayProxyStructuredResultV2 {
  return jsonResponse(HTTP_CREATED, {
    roundId: round.roundId,
    gameId: round.gameId,
    startDate: round.startDate.toISOString(),
    bettingDurationSeconds: round.bettingDurationSeconds,
    endDate: round.endDate.toISOString(),
    status: round.status,
  });
}

export function isClientError(error: unknown): error is RequestValidationError | DomainError {
  return error instanceof RequestValidationError || error instanceof DomainError;
}

export function errorResponse(error: unknown): APIGatewayProxyStructuredResultV2 {
  if (error instanceof RequestValidationError) {
    return jsonResponse(HTTP_BAD_REQUEST, {
      error: { code: "INVALID_REQUEST", message: error.message, details: error.details },
    });
  }
  if (error instanceof DomainError) {
    return jsonResponse(DOMAIN_ERROR_STATUS[error.code], {
      error: { code: error.code, message: error.message },
    });
  }
  return jsonResponse(HTTP_INTERNAL_SERVER_ERROR, {
    error: { code: "INTERNAL_ERROR", message: "Internal server error" },
  });
}

export function errorCode(error: RequestValidationError | DomainError): string {
  return error instanceof DomainError ? error.code : "INVALID_REQUEST";
}
