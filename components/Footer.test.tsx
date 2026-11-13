import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Footer from "./Footer";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";

let mockPathname = "/";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

function renderFooter() {
  return render(
    <LanguageProvider>
      <Footer />
    </LanguageProvider>
  );
}

describe("Footer Component", () => {
  it("renders global branding, nav links, and copyright on standard pages", () => {
    mockPathname = "/";
    renderFooter();

    expect(screen.getByText("ScoreBoard")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Matches$/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Tournaments$/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Terms & Privacy/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Settings$/i })).toBeInTheDocument();
    expect(screen.getByText(/All rights reserved/i)).toBeInTheDocument();
  });

  it("hides completely on live broadcast overlay routes", () => {
    mockPathname = "/match/test-id/overlay";
    const { container } = renderFooter();
    expect(container).toBeEmptyDOMElement();
  });

  it("hides completely on live broadcast scoreboard routes", () => {
    mockPathname = "/match/test-id/scoreboard";
    const { container } = renderFooter();
    expect(container).toBeEmptyDOMElement();
  });
});
