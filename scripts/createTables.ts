import {
  CreateTableCommand,
  ResourceInUseException,
  waitUntilTableExists,
  type CreateTableCommandInput,
  type DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import { createDynamoDbClient } from "../src/clients/dynamoDbClient";
import { loadConfig } from "../src/config/env";
import { tableDefinitions } from "./lib/tableDefinitions";

const TABLE_ACTIVE_TIMEOUT_SECONDS = 60;

async function createTable(
  client: DynamoDBClient,
  definition: CreateTableCommandInput,
): Promise<void> {
  const tableName = definition.TableName;
  try {
    await client.send(new CreateTableCommand(definition));
    console.log(`Created table ${tableName}`);
  } catch (error) {
    if (!(error instanceof ResourceInUseException)) {
      throw error;
    }
    console.log(`Table ${tableName} already exists`);
  }
  await waitUntilTableExists(
    { client, maxWaitTime: TABLE_ACTIVE_TIMEOUT_SECONDS },
    { TableName: tableName },
  );
}

async function main(): Promise<void> {
  const config = loadConfig();
  const client = createDynamoDbClient(config);
  for (const definition of tableDefinitions(config.tables)) {
    await createTable(client, definition);
  }
}

await main();
