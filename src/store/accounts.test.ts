import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SAVE_KEY } from "./game";
import { seal, unseal } from "./seal";

/** A browser-like localStorage for the store's own saves. */
function fakeLocalStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    key: () => null,
    length: 0,
    clear: () => data.clear(),
  };
}

describe("one life per account", () => {
  let ls: ReturnType<typeof fakeLocalStorage>;
  beforeEach(() => {
    ls = fakeLocalStorage();
    vi.stubGlobal("localStorage", ls);
    vi.stubGlobal("window", { localStorage: ls, location: { search: "" }, addEventListener: () => {} });
    vi.resetModules();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("gives each account its own save, so a new account starts a new life", async () => {
    const { setAccount, getGameStore, saveKeyFor } = await import("./index");
    setAccount("user-a");
    getGameStore().getState().setCharacter({ name: "Ada", g: "f", skin: "#8D5524", cloth: "#F4F1EA" });
    expect(getGameStore().getState().game.char?.name).toBe("Ada");
    setAccount("user-b");
    expect(getGameStore().getState().game.char).toBeNull();
    expect(saveKeyFor("user-a")).not.toBe(saveKeyFor("user-b"));
  });

  it("hands the save made before accounts to the first account to sign in, and to nobody else", async () => {
    const life = JSON.stringify({ state: { game: { money: 123456 } }, version: 1 });
    ls.setItem(SAVE_KEY, seal(SAVE_KEY, life));
    const { setAccount, saveKeyFor } = await import("./index");
    setAccount("first");
    const mine = ls.getItem(saveKeyFor("first"));
    expect(unseal(saveKeyFor("first"), mine)).toBe(life);
    expect(ls.getItem(SAVE_KEY)).toBeNull();
    setAccount("second");
    expect(ls.getItem(saveKeyFor("second"))).toBeNull();
  });
});
