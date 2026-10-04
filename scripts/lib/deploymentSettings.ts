import type { AppConfig } from "../../src/config/env";
import { DEFAULT_STAGE, type DeployedHttpApi } from "./httpApiDeployment";

export interface EndpointDeployment {
  readonly functionName: string;
  readonly bundlePath: string;
  readonly method: string;
  readonly path: string;
}

export const API_NAME = "betting-api";
export const BUNDLE_ENTRY_NAME = "index.mjs";

export const PLACE_BET_ENDPOINT: EndpointDeployment = {
  functionName: "place-bet",
  bundlePath: "dist/placeBet/index.mjs",
  method: "POST",
  path: "/bets",
};

export const CREATE_ROUND_ENDPOINT: EndpointDeployment = {
  functionName: "create-round",
  bundlePath: "dist/createRound/index.mjs",
  method: "POST",
  path: "/rounds",
};

export const ENDPOINTS: readonly EndpointDeployment[] = [PLACE_BET_ENDPOINT, CREATE_ROUND_ENDPOINT];

export function routeKey(endpoint: EndpointDeployment): string {
  return `${endpoint.method} ${endpoint.path}`;
}

export function lambdaEnvironment(config: AppConfig): Record<string, string> {
  return {
    GAMES_TABLE: config.tables.games,
    ROUNDS_TABLE: config.tables.rounds,
    ODDS_TABLE: config.tables.odds,
    BETS_TABLE: config.tables.bets,
    COUNTERS_TABLE: config.tables.counters,
    ROUND_SHARD_COUNT: String(config.roundShardCount),
    REFERENCE_CACHE_TTL_SECONDS: String(config.referenceCache.ttlSeconds),
    REFERENCE_CACHE_MAX_ENTRIES: String(config.referenceCache.maxEntries),
    SIMULATED_WALLET_MAX_DEBIT: String(config.simulatedWallet.maxDebit),
    ...(config.awsEndpoint === undefined ? {} : { AWS_ENDPOINT_URL: config.awsEndpoint }),
  };
}

export function invokeUrl(
  config: AppConfig,
  api: DeployedHttpApi,
  endpoint: EndpointDeployment,
): string {
  if (config.awsEndpoint === undefined) {
    return `${api.apiEndpoint}${endpoint.path}`;
  }
  return `${config.awsEndpoint}/_aws/execute-api/${api.apiId}/${DEFAULT_STAGE}${endpoint.path}`;
}

export function routeSourceArn(
  functionArn: string,
  apiId: string,
  endpoint: EndpointDeployment,
): string {
  const [, partition, , region, accountId] = functionArn.split(":");
  if (partition === undefined || region === undefined || accountId === undefined) {
    throw new Error(`Unexpected function ARN ${functionArn}`);
  }
  return `arn:${partition}:execute-api:${region}:${accountId}:${apiId}/*/${endpoint.method}${endpoint.path}`;
}
