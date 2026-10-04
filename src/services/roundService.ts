import type { Clock } from "../domain/clock";
import { GameNotFoundError } from "../domain/errors";
import { openRound, type CreateRoundCommand, type Round } from "../domain/round";
import type { ReferenceDataRepository } from "../repositories/referenceDataRepository";
import type { RoundRepository } from "../repositories/roundRepository";

export class RoundService {
  constructor(
    private readonly referenceData: ReferenceDataRepository,
    private readonly rounds: RoundRepository,
    private readonly clock: Clock,
  ) {}

  async createRound(command: CreateRoundCommand): Promise<Round> {
    const startDate = this.clock();

    const game = await this.referenceData.findGame(command.gameId);
    if (game === undefined) {
      throw new GameNotFoundError(command.gameId);
    }

    const roundId = await this.rounds.nextRoundId(game.gameId);
    const round = openRound(roundId, game.gameId, startDate);
    await this.rounds.create(round);
    return round;
  }
}
