import type { ReferenceCacheConfig } from "../config/env";
import type { Clock } from "../domain/clock";
import type { Game } from "../domain/game";
import type { Odd } from "../domain/odd";
import type { Round } from "../domain/round";
import { ExpiringCache } from "./expiringCache";
import type { ReferenceDataRepository } from "./referenceDataRepository";

const MILLISECONDS_PER_SECOND = 1000;

export class CachedReferenceDataRepository implements ReferenceDataRepository {
  private readonly games: ExpiringCache<Game>;
  private readonly rounds: ExpiringCache<Round>;
  private readonly odds: ExpiringCache<Odd>;

  constructor(
    private readonly source: ReferenceDataRepository,
    private readonly clock: Clock,
    private readonly options: ReferenceCacheConfig,
  ) {
    this.games = new ExpiringCache(clock, options.maxEntries);
    this.rounds = new ExpiringCache(clock, options.maxEntries);
    this.odds = new ExpiringCache(clock, options.maxEntries);
  }

  async findGame(gameId: string): Promise<Game | undefined> {
    const cached = this.games.get(gameId);
    if (cached !== undefined) {
      return cached;
    }
    const game = await this.source.findGame(gameId);
    if (game !== undefined) {
      this.games.set(gameId, game, this.ttlExpiry());
    }
    return game;
  }

  async findRound(gameId: string, roundId: string): Promise<Round | undefined> {
    const cacheKey = `${gameId}#${roundId}`;
    const cached = this.rounds.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }
    const round = await this.source.findRound(gameId, roundId);
    if (round !== undefined) {
      this.rounds.set(cacheKey, round, this.roundExpiry(round));
    }
    return round;
  }

  async findOdd(oddId: string): Promise<Odd | undefined> {
    const cached = this.odds.get(oddId);
    if (cached !== undefined) {
      return cached;
    }
    const odd = await this.source.findOdd(oddId);
    if (odd !== undefined) {
      this.odds.set(oddId, odd, this.ttlExpiry());
    }
    return odd;
  }

  private ttlExpiry(): Date {
    return new Date(this.clock().getTime() + this.options.ttlSeconds * MILLISECONDS_PER_SECOND);
  }

  private roundExpiry(round: Round): Date {
    const ttlExpiry = this.ttlExpiry();
    return round.endDate.getTime() > ttlExpiry.getTime() ? round.endDate : ttlExpiry;
  }
}
