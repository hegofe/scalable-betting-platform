import { randomUUID } from "node:crypto";
import { ApiGatewayV2Client } from "@aws-sdk/client-apigatewayv2";
import { ScanCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import autocannon from "autocannon";
import { createDocumentClient, createDynamoDbClient } from "../src/clients/dynamoDbClient";
import { loadConfig, type AppConfig } from "../src/config/env";
import { API_NAME, PLACE_BET_ENDPOINT, invokeUrl } from "./lib/deploymentSettings";
import { findHttpApi } from "./lib/httpApiDeployment";
import { parseLoadTestOptions, type LoadTestOptions } from "./lib/loadTestOptions";

interface PhaseSettings {
  readonly name: string;
  readonly rate: number;
  readonly connections: number;
  readonly durationSeconds: number;
}

interface PhaseOutcome {
  readonly accepted: number;
  readonly responses: number;
}

const REQUEST_TIMEOUT_SECONDS = 15;
const HTTP_CREATED = "201";
const WARMUP_RATE_DIVISOR = 4;
const WARMUP_CONNECTIONS_DIVISOR = 4;

async function resolveUrl(config: AppConfig, options: LoadTestOptions): Promise<string> {
  if (options.url !== undefined) {
    return options.url;
  }
  const client = new ApiGatewayV2Client({
    region: config.awsRegion,
    ...(config.awsEndpoint === undefined ? {} : { endpoint: config.awsEndpoint }),
  });
  const api = await findHttpApi(client, API_NAME);
  if (api === undefined) {
    throw new Error(`API ${API_NAME} is not deployed; run "npm run deploy" first`);
  }
  return invokeUrl(config, api, PLACE_BET_ENDPOINT);
}

function pick<T>(items: readonly T[]): T {
  const item = items[Math.floor(Math.random() * items.length)];
  if (item === undefined) {
    throw new Error("Cannot pick from an empty list");
  }
  return item;
}

function statusCounts(result: autocannon.Result): Map<string, number> {
  const counts = new Map<string, number>();
  for (const [status, stats] of Object.entries(result.statusCodeStats ?? {})) {
    counts.set(status, stats.count ?? 0);
  }
  return counts;
}

function describeStatuses(counts: Map<string, number>): string {
  if (counts.size === 0) {
    return "none";
  }
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([status, count]) => `${status}: ${count}`)
    .join(", ");
}

async function runPhase(
  url: string,
  userPrefix: string,
  options: LoadTestOptions,
  phase: PhaseSettings,
): Promise<PhaseOutcome> {
  console.log(
    `\n${phase.name}: ${phase.rate} requests/s for ${phase.durationSeconds}s over ${phase.connections} connections`,
  );
  const result = await autocannon({
    url,
    method: "POST",
    connections: phase.connections,
    overallRate: phase.rate,
    amount: phase.rate * phase.durationSeconds,
    timeout: REQUEST_TIMEOUT_SECONDS,
    requests: [
      {
        method: "POST",
        setupRequest: (request) => ({
          ...request,
          headers: {
            "content-type": "application/json",
            "x-user-id": `${userPrefix}${Math.floor(Math.random() * options.users)}`,
            "idempotency-key": randomUUID(),
          },
          body: JSON.stringify({
            gameId: options.gameId,
            roundId: options.roundId,
            oddId: pick(options.oddIds),
            betAmount: options.betAmount,
          }),
        }),
      },
    ],
  });

  const counts = statusCounts(result);
  const responses = [...counts.values()].reduce((total, count) => total + count, 0);
  console.log(`  responses:        ${describeStatuses(counts)}`);
  console.log(`  errors/timeouts:  ${result.errors}/${result.timeouts}`);
  console.log(`  throughput:       ${result.requests.average} requests/s on average`);
  console.log(
    `  latency (ms):     p50 ${result.latency.p50}, p97.5 ${result.latency.p97_5}, p99 ${result.latency.p99}, max ${result.latency.max}`,
  );
  return { accepted: counts.get(HTTP_CREATED) ?? 0, responses };
}

async function countStoredBets(
  documentClient: DynamoDBDocumentClient,
  tableName: string,
  userPrefix: string,
): Promise<number> {
  let total = 0;
  let startKey: Record<string, unknown> | undefined;
  do {
    const page = await documentClient.send(
      new ScanCommand({
        TableName: tableName,
        Select: "COUNT",
        FilterExpression: "begins_with(userId, :prefix)",
        ExpressionAttributeValues: { ":prefix": userPrefix },
        ExclusiveStartKey: startKey,
      }),
    );
    total += page.Count ?? 0;
    startKey = page.LastEvaluatedKey;
  } while (startKey !== undefined);
  return total;
}

function phases(options: LoadTestOptions): PhaseSettings[] {
  const main: PhaseSettings = {
    name: "Load",
    rate: options.rate,
    connections: options.connections,
    durationSeconds: options.durationSeconds,
  };
  if (options.warmupSeconds === 0) {
    return [main];
  }
  const warmup: PhaseSettings = {
    name: "Warm-up",
    rate: Math.max(1, Math.floor(options.rate / WARMUP_RATE_DIVISOR)),
    connections: Math.max(1, Math.floor(options.connections / WARMUP_CONNECTIONS_DIVISOR)),
    durationSeconds: options.warmupSeconds,
  };
  return [warmup, main];
}

async function main(): Promise<void> {
  const options = parseLoadTestOptions(process.argv.slice(2));
  const config = loadConfig();
  const url = await resolveUrl(config, options);
  const userPrefix = `load-${Date.now().toString(36)}-`;
  console.log(`Target: ${url}`);
  console.log(`Round ${options.roundId} of game ${options.gameId}, ${options.users} users`);

  let accepted = 0;
  let responses = 0;
  for (const phase of phases(options)) {
    const outcome = await runPhase(url, userPrefix, options, phase);
    accepted += outcome.accepted;
    responses += outcome.responses;
  }

  const stored = await countStoredBets(
    createDocumentClient(createDynamoDbClient(config)),
    config.tables.bets,
    userPrefix,
  );
  const consistent = stored === accepted;
  console.log(`\nResponses received: ${responses}`);
  console.log(`Bets accepted (201): ${accepted}`);
  console.log(`Bets stored:         ${stored}`);
  console.log(
    consistent
      ? "Result: every accepted bet was stored exactly once"
      : "Result: MISMATCH between accepted and stored bets",
  );
  if (!consistent || accepted === 0) {
    process.exitCode = 1;
  }
}

await main();
