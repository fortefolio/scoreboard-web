import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import MatchAtmosphereBackground, { normalizeSportType } from "./MatchAtmosphereBackground";

vi.mock("next/image", () => ({
  default: ({ src, alt, ...props }: any) => (
    <img src={src} alt={alt || ""} data-testid="background-image" {...props} />
  ),
}));

describe("normalizeSportType", () => {
  it("normalizes tennis variants", () => {
    expect(normalizeSportType("Tennis")).toBe("tennis");
    expect(normalizeSportType("ténis")).toBe("tennis");
  });

  it("normalizes football variants", () => {
    expect(normalizeSportType("Football")).toBe("football");
    expect(normalizeSportType("soccer")).toBe("football");
    expect(normalizeSportType("Futebol")).toBe("football");
  });

  it("normalizes padel", () => {
    expect(normalizeSportType("Padel")).toBe("padel");
  });

  it("normalizes basketball", () => {
    expect(normalizeSportType("Basketball")).toBe("basketball");
    expect(normalizeSportType("Basket")).toBe("basketball");
  });

  it("normalizes volleyball and beach volleyball", () => {
    expect(normalizeSportType("Beach Volleyball")).toBe("beach_volleyball");
    expect(normalizeSportType("beach_volleyball")).toBe("beach_volleyball");
    expect(normalizeSportType("Volleyball")).toBe("volleyball");
  });

  it("falls back to tennis for unknown sports", () => {
    expect(normalizeSportType(null)).toBe("tennis");
    expect(normalizeSportType("Curling")).toBe("tennis");
  });
});

describe("MatchAtmosphereBackground component", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 500 });
    Object.defineProperty(window, "innerHeight", { writable: true, configurable: true, value: 800 });
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });

  it("renders with sport and orientation attributes in portrait spectator mode", () => {
    render(
      <MatchAtmosphereBackground sportType="Padel" mode="spectator">
        <div data-testid="test-content">Scoreboard Content</div>
      </MatchAtmosphereBackground>
    );

    const bg = screen.getByTestId("match-atmosphere-background");
    expect(bg).toHaveAttribute("data-sport", "padel");
    expect(bg).toHaveAttribute("data-orientation", "portrait");
    expect(bg).toHaveAttribute("data-mode", "spectator");

    const img = screen.getByTestId("background-image");
    expect(img).toHaveAttribute("src", "/backgrounds/padel-portrait.webp");
    expect(screen.getByTestId("test-content")).toBeInTheDocument();
  });

  it("respects forcedOrientation and umpire mode", () => {
    render(
      <MatchAtmosphereBackground
        sportType="Basketball"
        mode="umpire"
        forcedOrientation="landscape"
      />
    );

    const bg = screen.getByTestId("match-atmosphere-background");
    expect(bg).toHaveAttribute("data-sport", "basketball");
    expect(bg).toHaveAttribute("data-orientation", "landscape");
    expect(bg).toHaveAttribute("data-mode", "umpire");

    const img = screen.getByTestId("background-image");
    expect(img).toHaveAttribute("src", "/backgrounds/basketball-landscape.webp");
  });
});
