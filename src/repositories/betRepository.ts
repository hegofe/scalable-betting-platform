import type { Bet } from "../domain/bet";

export interface BetRepository {
  create(bet: Bet): Promise<void>;
}
