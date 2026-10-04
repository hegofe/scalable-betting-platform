import { describe, expect, it } from "vitest";
import { ConfigurationError, loadConfig } from "../../src/config/env";

const REQUIRED = {
  AWS_REGION: "eu-west-1",
  GAMES_TABLE: "Games",
  ROUNDS_TABLE: "Rounds",
  ODDS_TABLE: "Odds",
  BETS_TABLE: "Bets",
  COUNTERS_TABLE: "Counters",
};

describe("loadConfig", () => {
  it("applies defaults when only the required variables are set", () => {
    expect(loadConfig(REQUIRED)).toEqual({
      awsRegion: "eu-west-1",
      awsEndpoint: undefined,
      tables: {
        games: "Games",
        rounds: "Rounds",
        odds: "Odds",
        bets: "Bets",
        counters: "Counters",
      },
      roundShardCount: 10,
      referenceCache: { ttlSeconds: 300, maxEntries: 10_000 },
      simulatedWallet: { maxDebit: 1000 },
    });
  });

  it("reads the optional variables when they are set", () => {
    const config = loadConfig({
      ...REQUIRED,
      AWS_ENDPOINT_URL: "http://localhost:4566",
      ROUND_SHARD_COUNT: "25",
      REFERENCE_CACHE_TTL_SECONDS: "60",
      REFERENCE_CACHE_MAX_ENTRIES: "500",
      SIMULATED_WALLET_MAX_DEBIT: "200",
    });

    expect(config).toMatchObject({
      awsEndpoint: "http://localhost:4566",
      roundShardCount: 25,
      referenceCache: { ttlSeconds: 60, maxEntries: 500 },
      simulatedWallet: { maxDebit: 200 },
    });
  });

  it("treats a blank optional variable as not set", () => {
    expect(loadConfig({ ...REQUIRED, AWS_ENDPOINT_URL: "  " }).awsEndpoint).toBeUndefined();
  });

  it.each(Object.keys(REQUIRED))("fails when %s is missing", (name) => {
    const environment = { ...REQUIRED, [name]: undefined };

    expect(() => loadConfig(environment)).toThrow(
      new ConfigurationError(`Missing required environment variable ${name}`),
    );
  });

  it.each(["0", "-3", "2.5", "ten"])("fails when the shard count is %s", (value) => {
    expect(() => loadConfig({ ...REQUIRED, ROUND_SHARD_COUNT: value })).toThrow(
      new ConfigurationError("Environment variable ROUND_SHARD_COUNT must be a positive integer"),
    );
  });
});
