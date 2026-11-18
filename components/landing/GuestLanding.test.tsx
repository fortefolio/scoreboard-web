import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import { GuestLandingHero } from "./GuestLandingHero";
import { TechnicalCapabilitiesSection } from "./TechnicalCapabilitiesSection";

describe("GuestLandingHero", () => {
  it("renders headline, court live preview, and triggers CTA callbacks", async () => {
    const user = userEvent.setup();
    const onGetStarted = vi.fn();
    const onExploreLive = vi.fn();

    render(
      <LanguageProvider>
        <GuestLandingHero onGetStarted={onGetStarted} onExploreLive={onExploreLive} />
      </LanguageProvider>
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /don't just follow the score\./i
    );
    expect(
      screen.getByAltText(/courtside scorer tracking a live basketball match on a tablet/i)
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /get started/i }));
    expect(onGetStarted).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /watch live feeds/i }));
    expect(onExploreLive).toHaveBeenCalledTimes(1);
  });
});

describe("TechnicalCapabilitiesSection", () => {
  it("renders all 3 technical capability cards modeled after ScoreBoard views", () => {
    render(
      <LanguageProvider>
        <TechnicalCapabilitiesSection />
      </LanguageProvider>
    );

    expect(screen.getByText(/technical capabilities/i)).toBeInTheDocument();
    expect(screen.getByText(/umpire-to-crowd instant sync/i)).toBeInTheDocument();
    expect(screen.getByText(/crowd overview/i)).toBeInTheDocument();
    expect(screen.getByText(/automated tournament engine/i)).toBeInTheDocument();
    expect(screen.getByText(/broadcast overlays \(obs \/ vmix\)/i)).toBeInTheDocument();
    expect(screen.getByText("128 : 127")).toBeInTheDocument();
  });
});
