import { afterEach, describe, expect, it, vi } from "vitest";
import { originServerSnapshot, originSnapshot, subscribeOrigin } from "./origin";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("originSnapshot", () => {
  it("lee window.location.origin en el navegador", () => {
    vi.stubGlobal("window", { location: { origin: "https://simulado.test" } });
    expect(originSnapshot()).toBe("https://simulado.test");
  });

  it("devuelve cadena vacía sin ventana (contexto de servidor)", () => {
    expect(originSnapshot()).toBe("");
  });
});

describe("originServerSnapshot", () => {
  it("siempre devuelve vacío para el prerender", () => {
    expect(originServerSnapshot()).toBe("");
  });
});

describe("subscribeOrigin", () => {
  it("devuelve un unsubscribe sin efectos", () => {
    const unsubscribe = subscribeOrigin();
    expect(typeof unsubscribe).toBe("function");
    expect(() => unsubscribe()).not.toThrow();
  });
});
