import { createDocumentClient, createDynamoDbClient } from "../clients/dynamoDbClient";
import type { AppConfig } from "../config/env";
import { systemClock } from "../domain/clock";
import { CachedReferenceDataRepository } from "../repositories/cachedReferenceDataRepository";
import { DynamoDbReferenceDataRepository } from "../repositories/dynamoDbReferenceDataRepository";
import { DynamoDbRoundRepository } from "../repositories/dynamoDbRoundRepository";
import { RoundService } from "./roundService";

export function createRoundService(config: AppConfig): RoundService {
  const documentClient = createDocumentClient(createDynamoDbClient(config));
  const referenceData = new CachedReferenceDataRepository(
    new DynamoDbReferenceDataRepository(documentClient, config.tables),
    systemClock,
    config.referenceCache,
  );
  const rounds = new DynamoDbRoundRepository(documentClient, config.tables);
  return new RoundService(referenceData, rounds, systemClock);
}
