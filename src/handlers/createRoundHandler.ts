import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { describeError, type Logger } from "../logging/logger";
import type { RoundService } from "../services/roundService";
import { parseCreateRoundRequest } from "./createRoundRequest";
import { errorCode, errorResponse, isClientError, roundResponse } from "./httpResponses";

export type RoundCreator = Pick<RoundService, "createRound">;

export type CreateRoundHandler = (
  event: APIGatewayProxyEventV2,
) => Promise<APIGatewayProxyStructuredResultV2>;

export function createCreateRoundHandler(
  roundCreator: RoundCreator,
  logger: Logger,
): CreateRoundHandler {
  return async (event) => {
    const requestId = event.requestContext.requestId;
    try {
      const command = parseCreateRoundRequest(event);
      const round = await roundCreator.createRound(command);
      logger.info("Round created", {
        requestId,
        roundId: round.roundId,
        gameId: round.gameId,
      });
      return roundResponse(round);
    } catch (error) {
      if (isClientError(error)) {
        logger.warn("Round rejected", {
          requestId,
          code: errorCode(error),
          reason: error.message,
        });
      } else {
        logger.error("Round creation failed", { requestId, ...describeError(error) });
      }
      return errorResponse(error);
    }
  };
}
