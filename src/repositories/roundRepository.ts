import type { Round } from "../domain/round";

export interface RoundRepository {
  nextRoundId(gameId: string): Promise<string>;
  create(round: Round): Promise<void>;
}
