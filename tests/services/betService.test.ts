import { describe, expect, it } from "vitest";
import {
  BettingWindowClosedError,
  DuplicateBetError,
  GameNotFoundError,
  InsufficientFundsError,
  OddGameMismatchError,
  OddNotFoundError,
  RoundNotFoundError,
} from "../../src/domain/errors";
import { BetService } from "../../src/services/betService";
import { WITHIN_BETTING_WINDOW, aGame, aPlaceBetCommand, aRound, anOdd } from "../support/builders";
import {
  FakeWalletClient,
  InMemoryBetRepository,
  InMemoryReferenceDataRepository,
  MutableClock,
} from "../support/fakes";

interface Scenario {
  readonly service: BetService;
  readonly referenceData: InMemoryReferenceDataRepository;
  readonly wallet: FakeWalletClient;
  readonly bets: InMemoryBetRepository;
  readonly clock: MutableClock;
}

function scenario(): Scenario {
  const referenceData = new InMemoryReferenceDataRepository();
  referenceData.games.push(aGame(), aGame({ gameId: "2", name: "Baccarat" }));
  referenceData.rounds.push(aRound(), aRound({ gameId: "2", roundId: "2001" }));
  referenceData.odds.push(anOdd(), anOdd({ oddId: "baccarat-tie", gameId: "2", value: "Tie" }));
  const wallet = new FakeWalletClient();
  const bets = new InMemoryBetRepository();
  const clock = new MutableClock(WITHIN_BETTING_WINDOW);
  const service = new BetService(referenceData, wallet, bets, clock.read);
  return { service, referenceData, wallet, bets, clock };
}

describe("BetService.placeBet", () => {
  it("stores an accepted bet stamped with the validation time", async () => {
    const { service, bets } = scenario();

    const bet = await service.placeBet(aPlaceBetCommand());

    expect(bet).toEqual({
      userId: "user-1",
      betId: "bet-1",
      gameId: "1",
      roundId: "1002",
      oddId: "roulette-red",
      betAmount: 10,
      status: "ACCEPTED",
      createdAt: WITHIN_BETTING_WINDOW,
    });
    expect(bets.bets).toEqual([bet]);
  });

  it("debits the wallet using the bet id as idempotency key", async () => {
    const { service, wallet } = scenario();

    await service.placeBet(aPlaceBetCommand({ betAmount: 25 }));

    expect(wallet.debits).toEqual([{ userId: "user-1", amount: 25, idempotencyKey: "bet-1" }]);
  });

  it.each([
    ["the game does not exist", { gameId: "9" }, GameNotFoundError],
    ["the round does not exist", { roundId: "9999" }, RoundNotFoundError],
    ["the round belongs to another game", { roundId: "2001" }, RoundNotFoundError],
    ["the odd does not exist", { oddId: "unknown" }, OddNotFoundError],
    ["the odd belongs to another game", { oddId: "baccarat-tie" }, OddGameMismatchError],
  ])("rejects the bet when %s", async (_description, overrides, expectedError) => {
    const { service, wallet, bets } = scenario();

    await expect(service.placeBet(aPlaceBetCommand(overrides))).rejects.toBeInstanceOf(
      expectedError,
    );
    expect(wallet.debits).toEqual([]);
    expect(bets.bets).toEqual([]);
  });

  it.each([
    ["before the round starts", "2026-10-04T21:59:59.999Z"],
    ["when the betting window has just ended", "2026-10-04T22:00:30.000Z"],
    ["after the round has ended", "2026-10-04T22:02:00.000Z"],
  ])("rejects the bet %s without debiting the wallet", async (_description, instant) => {
    const { service, wallet, bets, clock } = scenario();
    clock.set(new Date(instant));

    await expect(service.placeBet(aPlaceBetCommand())).rejects.toBeInstanceOf(
      BettingWindowClosedError,
    );
    expect(wallet.debits).toEqual([]);
    expect(bets.bets).toEqual([]);
  });

  it.each([
    ["exactly when the round starts", "2026-10-04T22:00:00.000Z"],
    ["in the last millisecond of the betting window", "2026-10-04T22:00:29.999Z"],
  ])("accepts the bet %s", async (_description, instant) => {
    const { service, clock } = scenario();
    clock.set(new Date(instant));

    const bet = await service.placeBet(aPlaceBetCommand());

    expect(bet.createdAt).toEqual(new Date(instant));
  });

  it("does not store the bet when the wallet reports insufficient funds", async () => {
    const { service, wallet, bets } = scenario();
    wallet.failure = new InsufficientFundsError("user-1");

    await expect(service.placeBet(aPlaceBetCommand())).rejects.toBeInstanceOf(
      InsufficientFundsError,
    );
    expect(bets.bets).toEqual([]);
  });

  it("rejects a second bet with the same idempotency key for the same user", async () => {
    const { service, bets } = scenario();
    await service.placeBet(aPlaceBetCommand());

    await expect(service.placeBet(aPlaceBetCommand({ betAmount: 99 }))).rejects.toBeInstanceOf(
      DuplicateBetError,
    );
    expect(bets.bets).toHaveLength(1);
    expect(bets.bets[0]?.betAmount).toBe(10);
  });

  it("accepts the same idempotency key from a different user", async () => {
    const { service, bets } = scenario();
    await service.placeBet(aPlaceBetCommand());

    await service.placeBet(aPlaceBetCommand({ userId: "user-2" }));

    expect(bets.bets.map((bet) => bet.userId)).toEqual(["user-1", "user-2"]);
  });
});
