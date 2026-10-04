import { InsufficientFundsError } from "../domain/errors";
import type { DebitRequest, WalletClient } from "./walletClient";

export class SimulatedWalletClient implements WalletClient {
  constructor(private readonly maxDebit: number) {}

  debit(request: DebitRequest): Promise<void> {
    if (request.amount > this.maxDebit) {
      return Promise.reject(new InsufficientFundsError(request.userId));
    }
    return Promise.resolve();
  }
}
