import { describe, expect, it } from "vitest";
import { SimulatedWalletClient } from "../../src/clients/simulatedWalletClient";
import { InsufficientFundsError } from "../../src/domain/errors";

const MAX_DEBIT = 1000;

function debit(amount: number): Promise<void> {
  return new SimulatedWalletClient(MAX_DEBIT).debit({
    userId: "user-1",
    amount,
    idempotencyKey: "bet-1",
  });
}

describe("SimulatedWalletClient", () => {
  it.each([10, 999.99, MAX_DEBIT])("accepts a debit of %d", async (amount) => {
    await expect(debit(amount)).resolves.toBeUndefined();
  });

  it.each([MAX_DEBIT + 0.01, 5000])(
    "reports insufficient funds for a debit of %d",
    async (amount) => {
      await expect(debit(amount)).rejects.toBeInstanceOf(InsufficientFundsError);
    },
  );

  it("gives the same answer when the same debit is repeated", async () => {
    const wallet = new SimulatedWalletClient(MAX_DEBIT);
    const request = { userId: "user-1", amount: 10, idempotencyKey: "bet-1" };

    await expect(wallet.debit(request)).resolves.toBeUndefined();
    await expect(wallet.debit(request)).resolves.toBeUndefined();
  });
});
