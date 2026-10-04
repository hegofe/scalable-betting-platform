import { BatchWriteCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { createDocumentClient, createDynamoDbClient } from "../src/clients/dynamoDbClient";
import { loadConfig } from "../src/config/env";
import type { Round } from "../src/domain/round";
import { DynamoDbRoundRepository } from "../src/repositories/dynamoDbRoundRepository";
import { toRoundItem } from "../src/repositories/itemMappers";
import type { Item } from "../src/repositories/itemReader";
import { buildSeedData } from "./lib/seedData";

const BATCH_WRITE_LIMIT = 25;
const MAX_BATCH_ATTEMPTS = 5;

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function writeBatch(
  documentClient: DynamoDBDocumentClient,
  tableName: string,
  items: readonly Item[],
): Promise<void> {
  let pending = items.map((item) => ({ PutRequest: { Item: item } }));
  for (let attempt = 1; pending.length > 0; attempt += 1) {
    if (attempt > MAX_BATCH_ATTEMPTS) {
      throw new Error(`Could not write ${pending.length} items to ${tableName}`);
    }
    const response = await documentClient.send(
      new BatchWriteCommand({ RequestItems: { [tableName]: pending } }),
    );
    pending = (response.UnprocessedItems?.[tableName] ?? []).flatMap((request) =>
      request.PutRequest?.Item === undefined
        ? []
        : [{ PutRequest: { Item: request.PutRequest.Item } }],
    );
  }
}

async function writeAll(
  documentClient: DynamoDBDocumentClient,
  tableName: string,
  items: readonly Item[],
): Promise<void> {
  for (const batch of chunk(items, BATCH_WRITE_LIMIT)) {
    await writeBatch(documentClient, tableName, batch);
  }
  console.log(`Seeded ${items.length} items into ${tableName}`);
}

function highestRoundIdByGame(rounds: readonly Round[]): Map<string, number> {
  const highest = new Map<string, number>();
  for (const round of rounds) {
    const roundId = Number(round.roundId);
    highest.set(round.gameId, Math.max(highest.get(round.gameId) ?? roundId, roundId));
  }
  return highest;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const documentClient = createDocumentClient(createDynamoDbClient(config));
  const seed = buildSeedData(new Date());

  await writeAll(
    documentClient,
    config.tables.games,
    seed.games.map((game) => ({ ...game })),
  );
  await writeAll(
    documentClient,
    config.tables.odds,
    seed.odds.map((odd) => ({ ...odd })),
  );
  await writeAll(documentClient, config.tables.rounds, seed.rounds.map(toRoundItem));

  const roundRepository = new DynamoDbRoundRepository(documentClient, config.tables);
  for (const [gameId, highestRoundId] of highestRoundIdByGame(seed.rounds)) {
    await roundRepository.raiseRoundIdCounter(gameId, highestRoundId);
    console.log(`Round id counter for game ${gameId} is at least ${highestRoundId}`);
  }
}

await main();
