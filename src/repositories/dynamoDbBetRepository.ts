import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { PutCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { Bet } from "../domain/bet";
import { DuplicateBetError } from "../domain/errors";
import type { BetRepository } from "./betRepository";
import { toBetItem } from "./itemMappers";
import { roundShardFor } from "./roundShard";

export class DynamoDbBetRepository implements BetRepository {
  constructor(
    private readonly documentClient: DynamoDBDocumentClient,
    private readonly tableName: string,
    private readonly roundShardCount: number,
  ) {}

  async create(bet: Bet): Promise<void> {
    const roundShard = roundShardFor(bet, bet.betId, this.roundShardCount);
    try {
      await this.documentClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: toBetItem(bet, roundShard),
          ConditionExpression: "attribute_not_exists(betId)",
        }),
      );
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        throw new DuplicateBetError(bet.betId);
      }
      throw error;
    }
  }
}
