import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { CreateRoundCommand } from "../domain/round";
import { Violations, parseJsonBody, readIdentifier } from "./requestParsing";

export function parseCreateRoundRequest(event: APIGatewayProxyEventV2): CreateRoundCommand {
  const body = parseJsonBody(event);
  const violations = new Violations();

  const command: CreateRoundCommand = {
    gameId: readIdentifier(body.gameId, "Field gameId", violations),
  };

  violations.throwIfAny();
  return command;
}
