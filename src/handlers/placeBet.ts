import { loadConfig } from "../config/env";
import { JsonLogger } from "../logging/logger";
import { createBetService } from "../services/betServiceFactory";
import { createPlaceBetHandler } from "./placeBetHandler";

export const handler = createPlaceBetHandler(createBetService(loadConfig()), new JsonLogger());
