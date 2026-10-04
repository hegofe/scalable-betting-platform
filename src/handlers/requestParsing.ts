import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { RequestValidationError } from "./errors";

export type JsonObject = Record<string, unknown>;

const MAX_IDENTIFIER_LENGTH = 128;

export class Violations {
  private readonly messages: string[] = [];

  add(message: string): void {
    this.messages.push(message);
  }

  throwIfAny(): void {
    if (this.messages.length > 0) {
      throw new RequestValidationError(this.messages);
    }
  }
}

export function findHeader(event: APIGatewayProxyEventV2, name: string): string | undefined {
  const entry = Object.entries(event.headers).find(([key]) => key.toLowerCase() === name);
  return entry?.[1];
}

export function readIdentifier(value: unknown, label: string, violations: Violations): string {
  if (typeof value !== "string" || value.trim() === "") {
    violations.add(`${label} is required and must be a non-empty string`);
    return "";
  }
  const identifier = value.trim();
  if (identifier.length > MAX_IDENTIFIER_LENGTH) {
    violations.add(`${label} must be at most ${MAX_IDENTIFIER_LENGTH} characters long`);
  }
  return identifier;
}

function decodeBody(event: APIGatewayProxyEventV2): string | undefined {
  if (event.body === undefined) {
    return undefined;
  }
  return event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
}

export function parseJsonBody(event: APIGatewayProxyEventV2): JsonObject {
  const body = decodeBody(event);
  if (body === undefined || body.trim() === "") {
    throw new RequestValidationError(["Request body is required"]);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new RequestValidationError(["Request body must be valid JSON"]);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new RequestValidationError(["Request body must be a JSON object"]);
  }
  return parsed as JsonObject;
}
