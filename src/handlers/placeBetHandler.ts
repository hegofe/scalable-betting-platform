import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { describeError, type Logger } from "../logging/logger";
import type { BetService } from "../services/betService";
import { betResponse, errorCode, errorResponse, isClientError } from "./httpResponses";
import { parsePlaceBetRequest } from "./placeBetRequest";

export type BetPlacer = Pick<BetService, "placeBet">;

export type PlaceBetHandler = (
  event: APIGatewayProxyEventV2,
) => Promise<APIGatewayProxyStructuredResultV2>;

export function createPlaceBetHandler(betPlacer: BetPlacer, logger: Logger): PlaceBetHandler {
  return async (event) => {
    const requestId = event.requestContext.requestId;
    try {
      const command = parsePlaceBetRequest(event);
      const bet = await betPlacer.placeBet(command);
      logger.info("Bet accepted", {
        requestId,
        userId: bet.userId,
        betId: bet.betId,
        roundId: bet.roundId,
      });
      return betResponse(bet);
    } catch (error) {
      if (isClientError(error)) {
        logger.warn("Bet rejected", {
          requestId,
          code: errorCode(error),
          reason: error.message,
        });
      } else {
        logger.error("Bet placement failed", { requestId, ...describeError(error) });
      }
      return errorResponse(error);
    }
  };
}
