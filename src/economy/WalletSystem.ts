import { EventBus } from "../core/EventBus";
import type { TransactionRecord } from "./StorageService";

export class WalletSystem {
  private _credits = 0;
  private _totalEarned = 0;
  private onMutate?: () => void;

  constructor(initialCredits = 0, totalEarned = 0, onMutate?: () => void) {
    this._credits = Math.max(0, Math.floor(initialCredits));
    this._totalEarned = Math.max(this._credits, Math.floor(totalEarned));
    this.onMutate = onMutate;
  }

  get credits(): number {
    return this._credits;
  }

  get balance(): number {
    return this._credits;
  }

  get totalEarned(): number {
    return this._totalEarned;
  }

  get formatted(): string {
    return `◈ ${this._credits.toLocaleString()}`;
  }

  canAfford(cost: number): boolean {
    if (cost < 0 || !Number.isFinite(cost)) return false;
    return this._credits >= cost;
  }

  add(amount: number, source: string, x?: number, y?: number): boolean {
    if (amount <= 0 || !Number.isFinite(amount)) return false;
    const rounded = Math.floor(amount);
    this._credits += rounded;
    this._totalEarned += rounded;

    EventBus.get().emit("CREDITS_EARNED", {
      amount: rounded,
      source,
      x,
      y,
    });

    this.onMutate?.();
    return true;
  }

  spend(amount: number, reason: string): boolean {
    if (amount < 0 || !Number.isFinite(amount)) return false;
    const rounded = Math.floor(amount);
    if (this._credits < rounded) return false;

    this._credits -= rounded;

    EventBus.get().emit("CREDITS_SPENT", {
      amount: rounded,
      reason,
    });

    this.onMutate?.();
    return true;
  }

  createTransaction(
    type: TransactionRecord["type"],
    amount: number,
    source: string,
    itemId?: string,
  ): TransactionRecord {
    return {
      id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type,
      amount,
      source,
      itemId,
      timestamp: Date.now(),
    };
  }
}
