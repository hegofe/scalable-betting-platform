export const BET_STATUSES = ["ACCEPTED"] as const;

export type BetStatus = (typeof BET_STATUSES)[number];

export interface Bet {
  readonly userId: string;
  readonly betId: string;
  readonly gameId: string;
  readonly roundId: string;
  readonly oddId: string;
  readonly betAmount: number;
  readonly status: BetStatus;
  readonly createdAt: Date;
}

export interface PlaceBetCommand {
  readonly userId: string;
  readonly betId: string;
  readonly gameId: string;
  readonly roundId: string;
  readonly oddId: string;
  readonly betAmount: number;
}
