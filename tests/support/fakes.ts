import type { DebitRequest, WalletClient } from "../../src/clients/walletClient";
import type { Bet } from "../../src/domain/bet";
import type { Clock } from "../../src/domain/clock";
import { DuplicateBetError } from "../../src/domain/errors";
import type { Game } from "../../src/domain/game";
import type { Odd } from "../../src/domain/odd";
import type { Round } from "../../src/domain/round";
import type { LogContext, Logger } from "../../src/logging/logger";
import type { BetRepository } from "../../src/repositories/betRepository";
import type { ReferenceDataRepository } from "../../src/repositories/referenceDataRepository";
import type { RoundRepository } from "../../src/repositories/roundRepository";

export class MutableClock {
  constructor(private current: Date) {}

  readonly read: Clock = () => this.current;

  set(instant: Date): void {
    this.current = instant;
  }

  advance(milliseconds: number): void {
    this.current = new Date(this.current.getTime() + milliseconds);
  }
}

export class InMemoryReferenceDataRepository implements ReferenceDataRepository {
  readonly games: Game[] = [];
  readonly rounds: Round[] = [];
  readonly odds: Odd[] = [];
  readonly lookups = { games: 0, rounds: 0, odds: 0 };

  findGame(gameId: string): Promise<Game | undefined> {
    this.lookups.games += 1;
    return Promise.resolve(this.games.find((game) => game.gameId === gameId));
  }

  findRound(gameId: string, roundId: string): Promise<Round | undefined> {
    this.lookups.rounds += 1;
    return Promise.resolve(
      this.rounds.find((round) => round.gameId === gameId && round.roundId === roundId),
    );
  }

  findOdd(oddId: string): Promise<Odd | undefined> {
    this.lookups.odds += 1;
    return Promise.resolve(this.odds.find((odd) => odd.oddId === oddId));
  }
}

export class FakeWalletClient implements WalletClient {
  readonly debits: DebitRequest[] = [];
  failure: Error | undefined;

  debit(request: DebitRequest): Promise<void> {
    if (this.failure !== undefined) {
      return Promise.reject(this.failure);
    }
    this.debits.push(request);
    return Promise.resolve();
  }
}

export class InMemoryBetRepository implements BetRepository {
  readonly bets: Bet[] = [];

  create(bet: Bet): Promise<void> {
    const exists = this.bets.some(
      (stored) => stored.userId === bet.userId && stored.betId === bet.betId,
    );
    if (exists) {
      return Promise.reject(new DuplicateBetError(bet.betId));
    }
    this.bets.push(bet);
    return Promise.resolve();
  }
}

export class InMemoryRoundRepository implements RoundRepository {
  readonly rounds: Round[] = [];
  readonly counters = new Map<string, number>();

  nextRoundId(gameId: string): Promise<string> {
    const next = (this.counters.get(gameId) ?? 0) + 1;
    this.counters.set(gameId, next);
    return Promise.resolve(String(next));
  }

  create(round: Round): Promise<void> {
    this.rounds.push(round);
    return Promise.resolve();
  }
}

export interface LogEntry {
  readonly level: "INFO" | "WARN" | "ERROR";
  readonly message: string;
  readonly context: LogContext;
}

export class RecordingLogger implements Logger {
  readonly entries: LogEntry[] = [];

  info(message: string, context: LogContext = {}): void {
    this.entries.push({ level: "INFO", message, context });
  }

  warn(message: string, context: LogContext = {}): void {
    this.entries.push({ level: "WARN", message, context });
  }

  error(message: string, context: LogContext = {}): void {
    this.entries.push({ level: "ERROR", message, context });
  }
}
