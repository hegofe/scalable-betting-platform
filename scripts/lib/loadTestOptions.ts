import { parseArgs } from "node:util";

export interface LoadTestOptions {
  readonly url: string | undefined;
  readonly rate: number;
  readonly durationSeconds: number;
  readonly warmupSeconds: number;
  readonly connections: number;
  readonly users: number;
  readonly gameId: string;
  readonly roundId: string;
  readonly oddIds: readonly string[];
  readonly betAmount: number;
}

const DEFAULTS = {
  rate: "80",
  duration: "30",
  warmup: "5",
  connections: "20",
  users: "1000",
  game: "1",
  round: "1002",
  odds: "roulette-red,roulette-black,roulette-even,roulette-odd,roulette-number-7",
  amount: "10",
};

function positiveInteger(name: string, value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Option --${name} must be a positive integer`);
  }
  return parsed;
}

function nonNegativeInteger(name: string, value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Option --${name} must be zero or a positive integer`);
  }
  return parsed;
}

function positiveNumber(name: string, value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Option --${name} must be a positive number`);
  }
  return parsed;
}

function oddIdList(value: string): string[] {
  const oddIds = value
    .split(",")
    .map((oddId) => oddId.trim())
    .filter((oddId) => oddId !== "");
  if (oddIds.length === 0) {
    throw new Error("Option --odds must list at least one odd id");
  }
  return oddIds;
}

export function parseLoadTestOptions(args: readonly string[]): LoadTestOptions {
  const { values } = parseArgs({
    args: [...args],
    options: {
      url: { type: "string" },
      rate: { type: "string", default: DEFAULTS.rate },
      duration: { type: "string", default: DEFAULTS.duration },
      warmup: { type: "string", default: DEFAULTS.warmup },
      connections: { type: "string", default: DEFAULTS.connections },
      users: { type: "string", default: DEFAULTS.users },
      game: { type: "string", default: DEFAULTS.game },
      round: { type: "string", default: DEFAULTS.round },
      odds: { type: "string", default: DEFAULTS.odds },
      amount: { type: "string", default: DEFAULTS.amount },
    },
  });

  return {
    url: values.url,
    rate: positiveInteger("rate", values.rate),
    durationSeconds: positiveInteger("duration", values.duration),
    warmupSeconds: nonNegativeInteger("warmup", values.warmup),
    connections: positiveInteger("connections", values.connections),
    users: positiveInteger("users", values.users),
    gameId: values.game,
    roundId: values.round,
    oddIds: oddIdList(values.odds),
    betAmount: positiveNumber("amount", values.amount),
  };
}
