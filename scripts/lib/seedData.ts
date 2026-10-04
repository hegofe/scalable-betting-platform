import type { Game } from "../../src/domain/game";
import type { Odd } from "../../src/domain/odd";
import { openRound, type Round } from "../../src/domain/round";

export interface SeedData {
  readonly games: readonly Game[];
  readonly odds: readonly Odd[];
  readonly rounds: readonly Round[];
}

const ROULETTE_HIGHEST_NUMBER = 36;
const MILLISECONDS_PER_SECOND = 1000;
const LONG_RUNNING_ROUND_SECONDS = 30 * 24 * 60 * 60;

const ROULETTE: Game = { gameId: "1", name: "Roulette" };
const BACCARAT: Game = { gameId: "2", name: "Baccarat" };

function rouletteOdds(): Odd[] {
  const numbers = Array.from({ length: ROULETTE_HIGHEST_NUMBER + 1 }, (_, number) => ({
    oddId: `roulette-number-${number}`,
    gameId: ROULETTE.gameId,
    value: `Number ${number}`,
  }));
  const outsideBets: [string, string][] = [
    ["red", "Red"],
    ["black", "Black"],
    ["even", "Even"],
    ["odd", "Odd"],
    ["low", "Low (1-18)"],
    ["high", "High (19-36)"],
    ["dozen-1", "First dozen (1-12)"],
    ["dozen-2", "Second dozen (13-24)"],
    ["dozen-3", "Third dozen (25-36)"],
  ];
  return [
    ...numbers,
    ...outsideBets.map(([slug, value]) => ({
      oddId: `roulette-${slug}`,
      gameId: ROULETTE.gameId,
      value,
    })),
  ];
}

function baccaratOdds(): Odd[] {
  const bets: [string, string][] = [
    ["player", "Player"],
    ["banker", "Banker"],
    ["tie", "Tie"],
  ];
  return bets.map(([slug, value]) => ({
    oddId: `baccarat-${slug}`,
    gameId: BACCARAT.gameId,
    value,
  }));
}

function longRunningTestRound(now: Date): Round {
  return {
    roundId: "1002",
    gameId: ROULETTE.gameId,
    startDate: now,
    bettingDurationSeconds: LONG_RUNNING_ROUND_SECONDS,
    endDate: new Date(now.getTime() + LONG_RUNNING_ROUND_SECONDS * MILLISECONDS_PER_SECOND),
    status: "open",
  };
}

function rounds(now: Date): Round[] {
  return [
    openRound("1001", ROULETTE.gameId, now),
    longRunningTestRound(now),
    openRound("2001", BACCARAT.gameId, now),
  ];
}

export function buildSeedData(now: Date): SeedData {
  return {
    games: [ROULETTE, BACCARAT],
    odds: [...rouletteOdds(), ...baccaratOdds()],
    rounds: rounds(now),
  };
}
