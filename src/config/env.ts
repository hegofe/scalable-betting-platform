export interface TableNames {
  readonly games: string;
  readonly rounds: string;
  readonly odds: string;
  readonly bets: string;
  readonly counters: string;
}

export interface AppConfig {
  readonly awsRegion: string;
  readonly awsEndpoint: string | undefined;
  readonly tables: TableNames;
  readonly roundShardCount: number;
  readonly referenceCache: ReferenceCacheConfig;
  readonly simulatedWallet: SimulatedWalletConfig;
}

export interface SimulatedWalletConfig {
  readonly maxDebit: number;
}

export interface ReferenceCacheConfig {
  readonly ttlSeconds: number;
  readonly maxEntries: number;
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

type Environment = Readonly<Record<string, string | undefined>>;

const DEFAULT_ROUND_SHARD_COUNT = 10;
const DEFAULT_REFERENCE_CACHE_TTL_SECONDS = 300;
const DEFAULT_REFERENCE_CACHE_MAX_ENTRIES = 10_000;
const DEFAULT_SIMULATED_WALLET_MAX_DEBIT = 1000;

function requireVariable(env: Environment, name: string): string {
  const value = env[name]?.trim();
  if (value === undefined || value === "") {
    throw new ConfigurationError(`Missing required environment variable ${name}`);
  }
  return value;
}

function optionalVariable(env: Environment, name: string): string | undefined {
  const value = env[name]?.trim();
  return value === undefined || value === "" ? undefined : value;
}

function positiveInteger(env: Environment, name: string, fallback: number): number {
  const raw = optionalVariable(env, name);
  if (raw === undefined) {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new ConfigurationError(`Environment variable ${name} must be a positive integer`);
  }
  return value;
}

export function loadConfig(env: Environment = process.env): AppConfig {
  return {
    awsRegion: requireVariable(env, "AWS_REGION"),
    awsEndpoint: optionalVariable(env, "AWS_ENDPOINT_URL"),
    tables: {
      games: requireVariable(env, "GAMES_TABLE"),
      rounds: requireVariable(env, "ROUNDS_TABLE"),
      odds: requireVariable(env, "ODDS_TABLE"),
      bets: requireVariable(env, "BETS_TABLE"),
      counters: requireVariable(env, "COUNTERS_TABLE"),
    },
    roundShardCount: positiveInteger(env, "ROUND_SHARD_COUNT", DEFAULT_ROUND_SHARD_COUNT),
    referenceCache: {
      ttlSeconds: positiveInteger(
        env,
        "REFERENCE_CACHE_TTL_SECONDS",
        DEFAULT_REFERENCE_CACHE_TTL_SECONDS,
      ),
      maxEntries: positiveInteger(
        env,
        "REFERENCE_CACHE_MAX_ENTRIES",
        DEFAULT_REFERENCE_CACHE_MAX_ENTRIES,
      ),
    },
    simulatedWallet: {
      maxDebit: positiveInteger(
        env,
        "SIMULATED_WALLET_MAX_DEBIT",
        DEFAULT_SIMULATED_WALLET_MAX_DEBIT,
      ),
    },
  };
}
