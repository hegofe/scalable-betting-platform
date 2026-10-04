const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export interface RoundReference {
  readonly gameId: string;
  readonly roundId: string;
}

function fnv1a(value: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

export function shardIndex(betId: string, shardCount: number): number {
  return fnv1a(betId) % shardCount;
}

export function roundShardKey(round: RoundReference, shard: number): string {
  return `${round.gameId}#${round.roundId}#${shard}`;
}

export function roundShardFor(round: RoundReference, betId: string, shardCount: number): string {
  return roundShardKey(round, shardIndex(betId, shardCount));
}
