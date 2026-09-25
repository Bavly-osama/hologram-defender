export type GameEventMap = {
  ENEMY_DESTROYED: { kind: string; x: number; y: number; credits: number };
  CREDITS_EARNED: { amount: number; source: string; x?: number; y?: number };
  CREDITS_SPENT: { amount: number; reason: string };
  ITEM_PURCHASED: {
    type: "weapon" | "shield" | "upgrade" | "skin";
    id: string;
    level?: number;
  };
  ITEM_EQUIPPED: { type: "weapon" | "shield" | "skin"; id: string };
  UPGRADE_PURCHASED: { id: string; newLevel: number };
  WAVE_REWARD: { wave: number; bonus: number; perfect: boolean };
  STATS_CHANGED: void;
  SHOP_OPENED: void;
  SHOP_CLOSED: void;
};

type Handler<T> = (data: T) => void;

export class EventBus {
  private static instance: EventBus;
  private handlers = new Map<keyof GameEventMap, Set<Handler<any>>>();

  static get(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  on<K extends keyof GameEventMap>(event: K, handler: Handler<GameEventMap[K]>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  off<K extends keyof GameEventMap>(event: K, handler: Handler<GameEventMap[K]>): void {
    this.handlers.get(event)?.delete(handler);
  }

  emit<K extends keyof GameEventMap>(
    event: K,
    ...args: GameEventMap[K] extends void ? [] : [GameEventMap[K]]
  ): void {
    const list = this.handlers.get(event);
    if (!list) return;
    const data = args[0];
    for (const handler of list) {
      try {
        handler(data);
      } catch (err) {
        console.error(`[EventBus] Error in handler for event "${event}":`, err);
      }
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}
