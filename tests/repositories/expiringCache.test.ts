import { describe, expect, it } from "vitest";
import { ExpiringCache } from "../../src/repositories/expiringCache";
import { ROUND_START } from "../support/builders";
import { MutableClock } from "../support/fakes";

const ONE_MINUTE = 60_000;

function inOneMinute(clock: MutableClock): Date {
  return new Date(clock.read().getTime() + ONE_MINUTE);
}

describe("ExpiringCache", () => {
  it("returns nothing for a key that was never stored", () => {
    const cache = new ExpiringCache<string>(new MutableClock(ROUND_START).read, 10);

    expect(cache.get("missing")).toBeUndefined();
  });

  it("returns a stored value until it expires", () => {
    const clock = new MutableClock(ROUND_START);
    const cache = new ExpiringCache<string>(clock.read, 10);
    cache.set("key", "value", inOneMinute(clock));

    clock.advance(ONE_MINUTE - 1);
    expect(cache.get("key")).toBe("value");

    clock.advance(1);
    expect(cache.get("key")).toBeUndefined();
  });

  it("replaces the value and expiry of an existing key", () => {
    const clock = new MutableClock(ROUND_START);
    const cache = new ExpiringCache<string>(clock.read, 10);
    cache.set("key", "first", inOneMinute(clock));
    clock.advance(ONE_MINUTE - 1);

    cache.set("key", "second", inOneMinute(clock));
    clock.advance(ONE_MINUTE - 1);

    expect(cache.get("key")).toBe("second");
  });

  it("evicts expired entries before live ones when it is full", () => {
    const clock = new MutableClock(ROUND_START);
    const cache = new ExpiringCache<string>(clock.read, 2);
    cache.set("short", "a", new Date(clock.read().getTime() + 1));
    cache.set("long", "b", inOneMinute(clock));
    clock.advance(1);

    cache.set("new", "c", inOneMinute(clock));

    expect(cache.get("long")).toBe("b");
    expect(cache.get("new")).toBe("c");
  });

  it("evicts the oldest entry when it is full of live entries", () => {
    const clock = new MutableClock(ROUND_START);
    const cache = new ExpiringCache<string>(clock.read, 2);
    cache.set("oldest", "a", inOneMinute(clock));
    cache.set("newer", "b", inOneMinute(clock));

    cache.set("newest", "c", inOneMinute(clock));

    expect(cache.get("oldest")).toBeUndefined();
    expect(cache.get("newer")).toBe("b");
    expect(cache.get("newest")).toBe("c");
  });
});
