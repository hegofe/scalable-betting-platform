import { createDocumentClient, createDynamoDbClient } from "../clients/dynamoDbClient";
import { SimulatedWalletClient } from "../clients/simulatedWalletClient";
import type { AppConfig } from "../config/env";
import { systemClock } from "../domain/clock";
import { CachedReferenceDataRepository } from "../repositories/cachedReferenceDataRepository";
import { DynamoDbBetRepository } from "../repositories/dynamoDbBetRepository";
import { DynamoDbReferenceDataRepository } from "../repositories/dynamoDbReferenceDataRepository";
import { BetService } from "./betService";

export function createBetService(config: AppConfig): BetService {
  const documentClient = createDocumentClient(createDynamoDbClient(config));
  const referenceData = new CachedReferenceDataRepository(
    new DynamoDbReferenceDataRepository(documentClient, config.tables),
    systemClock,
    config.referenceCache,
  );
  const wallet = new SimulatedWalletClient(config.simulatedWallet.maxDebit);
  const bets = new DynamoDbBetRepository(
    documentClient,
    config.tables.bets,
    config.roundShardCount,
  );
  return new BetService(referenceData, wallet, bets, systemClock);
}
