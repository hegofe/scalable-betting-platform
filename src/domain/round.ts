export const ROUND_STATUSES = ["created", "open", "running", "closed"] as const;

export type RoundStatus = (typeof ROUND_STATUSES)[number];

export interface Round {
  readonly roundId: string;
  readonly gameId: string;
  readonly startDate: Date;
  readonly bettingDurationSeconds: number;
  readonly endDate: Date;
  readonly status: RoundStatus;
}

export interface CreateRoundCommand {
  readonly gameId: string;
}

const MILLISECONDS_PER_SECOND = 1000;
const NEW_ROUND_BETTING_DURATION_SECONDS = 30;
const NEW_ROUND_DURATION_SECONDS = 60;

export function openRound(roundId: string, gameId: string, startDate: Date): Round {
  return {
    roundId,
    gameId,
    startDate,
    bettingDurationSeconds: NEW_ROUND_BETTING_DURATION_SECONDS,
    endDate: new Date(startDate.getTime() + NEW_ROUND_DURATION_SECONDS * MILLISECONDS_PER_SECOND),
    status: "open",
  };
}

export function bettingWindowEnd(round: Round): Date {
  return new Date(
    round.startDate.getTime() + round.bettingDurationSeconds * MILLISECONDS_PER_SECOND,
  );
}

export function isBettingWindowOpen(round: Round, now: Date): boolean {
  const instant = now.getTime();
  return instant >= round.startDate.getTime() && instant < bettingWindowEnd(round).getTime();
}
