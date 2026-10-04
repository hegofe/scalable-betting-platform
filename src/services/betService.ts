import type { WalletClient } from "../clients/walletClient";
import type { Bet, PlaceBetCommand } from "../domain/bet";
import type { Clock } from "../domain/clock";
import {
  BettingWindowClosedError,
  GameNotFoundError,
  OddGameMismatchError,
  OddNotFoundError,
  RoundNotFoundError,
} from "../domain/errors";
import { isBettingWindowOpen } from "../domain/round";
import type { BetRepository } from "../repositories/betRepository";
import type { ReferenceDataRepository } from "../repositories/referenceDataRepository";

export class BetService {
  constructor(
    private readonly referenceData: ReferenceDataRepository,
    private readonly wallet: WalletClient,
    private readonly bets: BetRepository,
    private readonly clock: Clock,
  ) {}

  async placeBet(command: PlaceBetCommand): Promise<Bet> {
    const validatedAt = await this.validate(command);

    await this.wallet.debit({
      userId: command.userId,
      amount: command.betAmount,
      idempotencyKey: command.betId,
    });

    const bet: Bet = {
      userId: command.userId,
      betId: command.betId,
      gameId: command.gameId,
      roundId: command.roundId,
      oddId: command.oddId,
      betAmount: command.betAmount,
      status: "ACCEPTED",
      createdAt: validatedAt,
    };
    await this.bets.create(bet);
    return bet;
  }

  private async validate(command: PlaceBetCommand): Promise<Date> {
    const [game, round, odd] = await Promise.all([
      this.referenceData.findGame(command.gameId),
      this.referenceData.findRound(command.gameId, command.roundId),
      this.referenceData.findOdd(command.oddId),
    ]);

    if (game === undefined) {
      throw new GameNotFoundError(command.gameId);
    }
    if (round === undefined) {
      throw new RoundNotFoundError(command.roundId, game.gameId);
    }
    if (odd === undefined) {
      throw new OddNotFoundError(command.oddId);
    }
    if (odd.gameId !== game.gameId) {
      throw new OddGameMismatchError(odd.oddId, game.gameId);
    }

    const validatedAt = this.clock();
    if (!isBettingWindowOpen(round, validatedAt)) {
      throw new BettingWindowClosedError(round.roundId);
    }
    return validatedAt;
  }
}
