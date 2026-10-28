import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageProvider, useTranslation } from "../LanguageContext";
import LanguageSelector from "@/components/LanguageSelector";

function TestComponent() {
  const { t, locale, setLocale } = useTranslation();
  return (
    <div>
      <span data-testid="current-locale">{locale}</span>
      <span data-testid="hero-title">{t("home.heroTitle")}</span>
      <span data-testid="page-of">{t("common.pageOf", { current: 2, total: 5 })}</span>
      <button onClick={() => setLocale("pt")}>Set PT</button>
      <button onClick={() => setLocale("en")}>Set EN</button>
    </div>
  );
}

describe("i18n System", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = "en";
  });

  it("defaults to English and translates keys correctly", () => {
    render(
      <LanguageProvider>
        <TestComponent />
      </LanguageProvider>
    );

    expect(screen.getByTestId("current-locale").textContent).toBe("en");
    expect(screen.getByTestId("hero-title").textContent).toBe("Scores and Tournaments");
    expect(screen.getByTestId("page-of").textContent).toBe("Page 2 of 5");
  });

  it("switches to Portuguese dynamically and persists in localStorage", async () => {
    const user = userEvent.setup();

    render(
      <LanguageProvider>
        <TestComponent />
      </LanguageProvider>
    );

    await user.click(screen.getByText("Set PT"));

    expect(screen.getByTestId("current-locale").textContent).toBe("pt");
    expect(screen.getByTestId("hero-title").textContent).toBe("Resultados e Torneios");
    expect(screen.getByTestId("page-of").textContent).toBe("Página 2 de 5");
    expect(localStorage.getItem("scoreboard_locale")).toBe("pt");
    expect(document.documentElement.lang).toBe("pt");
  });

  it("LanguageSelector toggles language via accessible buttons", async () => {
    const user = userEvent.setup();

    render(
      <LanguageProvider>
        <LanguageSelector />
        <TestComponent />
      </LanguageProvider>
    );

    // Initial state EN
    const ptButton = screen.getByRole("button", { name: "Português" });
    const enButton = screen.getByRole("button", { name: "English" });

    expect(enButton).toHaveAttribute("aria-pressed", "true");
    expect(ptButton).toHaveAttribute("aria-pressed", "false");

    // Click PT
    await user.click(ptButton);

    expect(screen.getByTestId("current-locale").textContent).toBe("pt");
    expect(ptButton).toHaveAttribute("aria-pressed", "true");
    expect(enButton).toHaveAttribute("aria-pressed", "false");

    // Click EN
    await user.click(enButton);

    expect(screen.getByTestId("current-locale").textContent).toBe("en");
    expect(enButton).toHaveAttribute("aria-pressed", "true");
  });

  it("falls back gracefully when rendered without provider", () => {
    // Tests that useLanguage() fallback doesn't throw when used in isolated components
    render(<TestComponent />);
    expect(screen.getByTestId("current-locale").textContent).toBe("en");
    expect(screen.getByTestId("hero-title").textContent).toBe("Scores and Tournaments");
  });
});
