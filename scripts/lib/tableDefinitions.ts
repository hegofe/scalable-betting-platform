import type { CreateTableCommandInput } from "@aws-sdk/client-dynamodb";
import type { TableNames } from "../../src/config/env";

export const ROUND_ODDS_INDEX = "RoundOdds";

function masterTable(tableName: string, keyName: string): CreateTableCommandInput {
  return {
    TableName: tableName,
    BillingMode: "PAY_PER_REQUEST",
    AttributeDefinitions: [{ AttributeName: keyName, AttributeType: "S" }],
    KeySchema: [{ AttributeName: keyName, KeyType: "HASH" }],
  };
}

function roundsTable(tableName: string): CreateTableCommandInput {
  return {
    TableName: tableName,
    BillingMode: "PAY_PER_REQUEST",
    AttributeDefinitions: [
      { AttributeName: "gameId", AttributeType: "S" },
      { AttributeName: "roundId", AttributeType: "S" },
    ],
    KeySchema: [
      { AttributeName: "gameId", KeyType: "HASH" },
      { AttributeName: "roundId", KeyType: "RANGE" },
    ],
  };
}

function betsTable(tableName: string): CreateTableCommandInput {
  return {
    TableName: tableName,
    BillingMode: "PAY_PER_REQUEST",
    AttributeDefinitions: [
      { AttributeName: "userId", AttributeType: "S" },
      { AttributeName: "betId", AttributeType: "S" },
      { AttributeName: "roundShard", AttributeType: "S" },
      { AttributeName: "oddId", AttributeType: "S" },
    ],
    KeySchema: [
      { AttributeName: "userId", KeyType: "HASH" },
      { AttributeName: "betId", KeyType: "RANGE" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: ROUND_ODDS_INDEX,
        KeySchema: [
          { AttributeName: "roundShard", KeyType: "HASH" },
          { AttributeName: "oddId", KeyType: "RANGE" },
        ],
        Projection: { ProjectionType: "ALL" },
      },
    ],
  };
}

export function tableDefinitions(tables: TableNames): CreateTableCommandInput[] {
  return [
    masterTable(tables.games, "gameId"),
    roundsTable(tables.rounds),
    masterTable(tables.odds, "oddId"),
    masterTable(tables.counters, "counterName"),
    betsTable(tables.bets),
  ];
}
