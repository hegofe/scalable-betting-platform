import { GetCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { TableNames } from "../config/env";
import type { Game } from "../domain/game";
import type { Odd } from "../domain/odd";
import type { Round } from "../domain/round";
import { toGame, toOdd, toRound } from "./itemMappers";
import type { Item } from "./itemReader";
import type { ReferenceDataRepository } from "./referenceDataRepository";

type ReferenceTables = Pick<TableNames, "games" | "rounds" | "odds">;

export class DynamoDbReferenceDataRepository implements ReferenceDataRepository {
  constructor(
    private readonly documentClient: DynamoDBDocumentClient,
    private readonly tables: ReferenceTables,
  ) {}

  async findGame(gameId: string): Promise<Game | undefined> {
    const item = await this.getItem(this.tables.games, { gameId });
    return item === undefined ? undefined : toGame(item);
  }

  async findRound(gameId: string, roundId: string): Promise<Round | undefined> {
    const item = await this.getItem(this.tables.rounds, { gameId, roundId });
    return item === undefined ? undefined : toRound(item);
  }

  async findOdd(oddId: string): Promise<Odd | undefined> {
    const item = await this.getItem(this.tables.odds, { oddId });
    return item === undefined ? undefined : toOdd(item);
  }

  private async getItem(tableName: string, key: Record<string, string>): Promise<Item | undefined> {
    const response = await this.documentClient.send(
      new GetCommand({ TableName: tableName, Key: key }),
    );
    return response.Item;
  }
}
