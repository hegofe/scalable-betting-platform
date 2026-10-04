import type { Game } from "../domain/game";
import type { Odd } from "../domain/odd";
import type { Round } from "../domain/round";

export interface ReferenceDataRepository {
  findGame(gameId: string): Promise<Game | undefined>;
  findRound(gameId: string, roundId: string): Promise<Round | undefined>;
  findOdd(oddId: string): Promise<Odd | undefined>;
}
