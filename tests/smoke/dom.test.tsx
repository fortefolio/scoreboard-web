import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

describe("jsdom + RTL harness", () => {
  it("renders a React element and finds it", () => {
    render(<button>click me</button>);
    expect(screen.getByRole("button", { name: /click me/i })).toBeInTheDocument();
  });
});
