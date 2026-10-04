import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { PutCommand, UpdateCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { TableNames } from "../config/env";
import type { Round } from "../domain/round";
import { DataIntegrityError } from "./errors";
import { toRoundItem } from "./itemMappers";
import type { RoundRepository } from "./roundRepository";

type RoundTables = Pick<TableNames, "rounds" | "counters">;

const ROUND_ID_COUNTER_PREFIX = "roundId";
const COUNTER_ATTRIBUTE_NAMES = { "#current": "currentValue" };

function counterKey(gameId: string): { counterName: string } {
  return { counterName: `${ROUND_ID_COUNTER_PREFIX}#${gameId}` };
}

export class DynamoDbRoundRepository implements RoundRepository {
  constructor(
    private readonly documentClient: DynamoDBDocumentClient,
    private readonly tables: RoundTables,
  ) {}

  async nextRoundId(gameId: string): Promise<string> {
    const response = await this.documentClient.send(
      new UpdateCommand({
        TableName: this.tables.counters,
        Key: counterKey(gameId),
        UpdateExpression: "ADD #current :increment",
        ExpressionAttributeNames: COUNTER_ATTRIBUTE_NAMES,
        ExpressionAttributeValues: { ":increment": 1 },
        ReturnValues: "UPDATED_NEW",
      }),
    );
    const next: unknown = response.Attributes?.currentValue;
    if (typeof next !== "number" || !Number.isSafeInteger(next)) {
      throw new DataIntegrityError(
        `Round id counter for game ${gameId} did not return a valid integer`,
      );
    }
    return String(next);
  }

  async create(round: Round): Promise<void> {
    try {
      await this.documentClient.send(
        new PutCommand({
          TableName: this.tables.rounds,
          Item: toRoundItem(round),
          ConditionExpression: "attribute_not_exists(roundId)",
        }),
      );
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        throw new DataIntegrityError(
          `Round ${round.roundId} already exists for game ${round.gameId}`,
        );
      }
      throw error;
    }
  }

  async raiseRoundIdCounter(gameId: string, minimum: number): Promise<void> {
    try {
      await this.documentClient.send(
        new UpdateCommand({
          TableName: this.tables.counters,
          Key: counterKey(gameId),
          UpdateExpression: "SET #current = :minimum",
          ConditionExpression: "attribute_not_exists(#current) OR #current < :minimum",
          ExpressionAttributeNames: COUNTER_ATTRIBUTE_NAMES,
          ExpressionAttributeValues: { ":minimum": minimum },
        }),
      );
    } catch (error) {
      if (!(error instanceof ConditionalCheckFailedException)) {
        throw error;
      }
    }
  }
}
