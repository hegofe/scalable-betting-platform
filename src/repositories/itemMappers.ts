import type { Bet } from "../domain/bet";
import type { Game } from "../domain/game";
import type { Odd } from "../domain/odd";
import { ROUND_STATUSES, type Round } from "../domain/round";
import { ItemReader, type Item } from "./itemReader";

export function toGame(item: Item): Game {
  const reader = new ItemReader("Game", item);
  return {
    gameId: reader.string("gameId"),
    name: reader.string("name"),
  };
}

export function toOdd(item: Item): Odd {
  const reader = new ItemReader("Odd", item);
  return {
    oddId: reader.string("oddId"),
    gameId: reader.string("gameId"),
    value: reader.string("value"),
  };
}

export function toRound(item: Item): Round {
  const reader = new ItemReader("Round", item);
  return {
    roundId: reader.string("roundId"),
    gameId: reader.string("gameId"),
    startDate: reader.date("startDate"),
    bettingDurationSeconds: reader.number("bettingDurationSeconds"),
    endDate: reader.date("endDate"),
    status: reader.oneOf("status", ROUND_STATUSES),
  };
}

export function toRoundItem(round: Round): Item {
  return {
    roundId: round.roundId,
    gameId: round.gameId,
    startDate: round.startDate.toISOString(),
    bettingDurationSeconds: round.bettingDurationSeconds,
    endDate: round.endDate.toISOString(),
    status: round.status,
  };
}

export function toBetItem(bet: Bet, roundShard: string): Item {
  return {
    userId: bet.userId,
    betId: bet.betId,
    gameId: bet.gameId,
    roundId: bet.roundId,
    oddId: bet.oddId,
    betAmount: bet.betAmount,
    status: bet.status,
    createdAt: bet.createdAt.toISOString(),
    roundShard,
  };
}
