import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useScreenOrientation } from "./useScreenOrientation";

describe("useScreenOrientation", () => {
  let listeners: Record<string, ((e?: any) => void)[]> = {};

  beforeEach(() => {
    listeners = {};
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 500 });
    Object.defineProperty(window, "innerHeight", { writable: true, configurable: true, value: 800 });

    window.matchMedia = vi.fn().mockImplementation((query: string) => {
      const isLandscape = query.includes("landscape");
      return {
        matches: isLandscape ? window.innerWidth > window.innerHeight : false,
        media: query,
        onchange: null,
        addListener: vi.fn((cb) => {
          listeners["change"] = listeners["change"] || [];
          listeners["change"].push(cb);
        }),
        removeListener: vi.fn(),
        addEventListener: vi.fn((event, cb) => {
          listeners[event] = listeners[event] || [];
          listeners[event].push(cb);
        }),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("detects portrait by default when height > width", () => {
    window.innerWidth = 400;
    window.innerHeight = 800;

    const { result } = renderHook(() => useScreenOrientation());
    expect(result.current).toBe("portrait");
  });

  it("detects landscape when width > height", () => {
    window.innerWidth = 1200;
    window.innerHeight = 800;

    const { result } = renderHook(() => useScreenOrientation());
    expect(result.current).toBe("landscape");
  });

  it("updates dynamically when resize occurs", () => {
    window.innerWidth = 400;
    window.innerHeight = 800;

    const { result } = renderHook(() => useScreenOrientation());
    expect(result.current).toBe("portrait");

    act(() => {
      window.innerWidth = 1200;
      window.innerHeight = 800;
      window.dispatchEvent(new Event("resize"));
    });

    expect(result.current).toBe("landscape");
  });
});
