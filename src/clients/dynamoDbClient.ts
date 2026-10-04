import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { AppConfig } from "../config/env";

export function createDynamoDbClient(config: AppConfig): DynamoDBClient {
  return new DynamoDBClient({
    region: config.awsRegion,
    ...(config.awsEndpoint === undefined ? {} : { endpoint: config.awsEndpoint }),
  });
}

export function createDocumentClient(client: DynamoDBClient): DynamoDBDocumentClient {
  return DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });
}
