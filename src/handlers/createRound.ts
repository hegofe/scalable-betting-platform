import { loadConfig } from "../config/env";
import { JsonLogger } from "../logging/logger";
import { createRoundService } from "../services/roundServiceFactory";
import { createCreateRoundHandler } from "./createRoundHandler";

export const handler = createCreateRoundHandler(createRoundService(loadConfig()), new JsonLogger());
