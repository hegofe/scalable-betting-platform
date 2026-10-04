export interface DebitRequest {
  readonly userId: string;
  readonly amount: number;
  readonly idempotencyKey: string;
}

export interface WalletClient {
  debit(request: DebitRequest): Promise<void>;
}
