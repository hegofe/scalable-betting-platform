export type DomainErrorCode =
  | "GAME_NOT_FOUND"
  | "ROUND_NOT_FOUND"
  | "ODD_NOT_FOUND"
  | "ODD_GAME_MISMATCH"
  | "BETTING_WINDOW_CLOSED"
  | "INSUFFICIENT_FUNDS"
  | "DUPLICATE_BET";

export abstract class DomainError extends Error {
  protected constructor(
    readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class GameNotFoundError extends DomainError {
  constructor(gameId: string) {
    super("GAME_NOT_FOUND", `Game ${gameId} does not exist`);
  }
}

export class RoundNotFoundError extends DomainError {
  constructor(roundId: string, gameId: string) {
    super("ROUND_NOT_FOUND", `Round ${roundId} does not exist for game ${gameId}`);
  }
}

export class OddNotFoundError extends DomainError {
  constructor(oddId: string) {
    super("ODD_NOT_FOUND", `Odd ${oddId} does not exist`);
  }
}

export class OddGameMismatchError extends DomainError {
  constructor(oddId: string, gameId: string) {
    super("ODD_GAME_MISMATCH", `Odd ${oddId} does not belong to game ${gameId}`);
  }
}

export class BettingWindowClosedError extends DomainError {
  constructor(roundId: string) {
    super("BETTING_WINDOW_CLOSED", `Round ${roundId} is not accepting bets`);
  }
}

export class DuplicateBetError extends DomainError {
  constructor(betId: string) {
    super("DUPLICATE_BET", `Bet ${betId} has already been placed`);
  }
}

export class InsufficientFundsError extends DomainError {
  constructor(userId: string) {
    super("INSUFFICIENT_FUNDS", `User ${userId} has insufficient funds`);
  }
}
