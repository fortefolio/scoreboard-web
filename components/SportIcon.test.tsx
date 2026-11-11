import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import SportIcon from "./SportIcon";

describe("SportIcon Component", () => {
  it("renders Tennis SVG icon matching mobile vector", () => {
    const { container } = render(<SportIcon sport="Tennis" className="text-text-primary" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-label", "Tennis");
    expect(svg).toHaveAttribute("viewBox", "0 0 512 512");
  });

  it("renders Padel SVG icon matching mobile vector", () => {
    const { container } = render(<SportIcon sport="Padel" className="text-text-primary" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-label", "Padel");
    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
  });

  it("renders Football SVG icon matching mobile vector", () => {
    const { container } = render(<SportIcon sport="Football" className="text-text-primary" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-label", "Football");
    expect(svg).toHaveAttribute("viewBox", "0 0 512 512");
  });

  it("renders Basketball SVG icon matching mobile vector", () => {
    const { container } = render(<SportIcon sport="Basketball" className="text-text-primary" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-label", "Basketball");
    expect(svg).toHaveAttribute("viewBox", "0 0 512 512");
  });

  it("renders Volleyball SVG icon matching mobile vector", () => {
    const { container } = render(<SportIcon sport="Volleyball" className="text-text-primary" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-label", "Volleyball");
    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
  });

  it("renders Beach Volleyball SVG icon matching mobile vector", () => {
    const { container } = render(<SportIcon sport="Beach Volleyball" className="text-text-primary" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-label", "Volleyball");
  });

  it("renders fallback trophy SVG for unknown sport", () => {
    const { container } = render(<SportIcon sport="UnknownSport" className="text-text-primary" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-label", "Sport");
  });
});
