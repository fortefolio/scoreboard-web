import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageProvider, useTranslation } from "../LanguageContext";
import { getSportTranslation } from "../index";
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

  it("LanguageSelector opens dropdown and switches language", async () => {
    const user = userEvent.setup();

    render(
      <LanguageProvider>
        <LanguageSelector />
        <TestComponent />
      </LanguageProvider>
    );

    // Dropdown is initially closed
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    // Trigger button is present with current language EN
    const trigger = screen.getByRole("button", { name: /select language/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveTextContent("EN");

    // Click trigger to open dropdown
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    // Portuguese option is visible
    const ptOption = screen.getByRole("option", { name: /português/i });
    expect(ptOption).toBeInTheDocument();
    expect(ptOption).toHaveAttribute("aria-selected", "false");

    // Click Portuguese option
    await user.click(ptOption);

    // Language switched and dropdown closed
    expect(screen.getByTestId("current-locale").textContent).toBe("pt");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger).toHaveTextContent("PT");

    // Open dropdown again and click English option
    await user.click(trigger);
    const enOption = screen.getByRole("option", { name: /english/i });
    await user.click(enOption);

    expect(screen.getByTestId("current-locale").textContent).toBe("en");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger).toHaveTextContent("EN");
  });

  it("LanguageSelector closes dropdown on Escape key", async () => {
    const user = userEvent.setup();

    render(
      <LanguageProvider>
        <LanguageSelector />
      </LanguageProvider>
    );

    const trigger = screen.getByRole("button", { name: /select language/i });
    await user.click(trigger);
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("falls back gracefully when rendered without provider", () => {
    render(<TestComponent />);
    expect(screen.getByTestId("current-locale").textContent).toBe("en");
    expect(screen.getByTestId("hero-title").textContent).toBe("Scores and Tournaments");
  });

  it("translates sports correctly in both English and Portuguese", () => {
    function SportTranslationTest() {
      const { t, setLocale } = useTranslation();
      return (
        <div>
          <span data-testid="sport-basketball">{getSportTranslation("Basketball", t)}</span>
          <span data-testid="sport-beach-volleyball">{getSportTranslation("Beach Volleyball", t)}</span>
          <span data-testid="sport-beach-snake">{getSportTranslation("beach_volleyball", t)}</span>
          <span data-testid="sport-volleyball">{getSportTranslation("Volleyball", t)}</span>
          <span data-testid="sport-football">{getSportTranslation("Football", t)}</span>
          <span data-testid="sport-tennis">{getSportTranslation("Tennis", t)}</span>
          <span data-testid="sport-padel">{getSportTranslation("Padel", t)}</span>
          <button onClick={() => setLocale("pt")}>Set PT</button>
        </div>
      );
    }

    const { rerender } = render(
      <LanguageProvider>
        <SportTranslationTest />
      </LanguageProvider>
    );

    // English
    expect(screen.getByTestId("sport-basketball").textContent).toBe("Basketball");
    expect(screen.getByTestId("sport-beach-volleyball").textContent).toBe("Beach Volleyball");
    expect(screen.getByTestId("sport-beach-snake").textContent).toBe("Beach Volleyball");
    expect(screen.getByTestId("sport-volleyball").textContent).toBe("Volleyball");
    expect(screen.getByTestId("sport-football").textContent).toBe("Football");
    expect(screen.getByTestId("sport-tennis").textContent).toBe("Tennis");
    expect(screen.getByTestId("sport-padel").textContent).toBe("Padel");

    // Switch to Portuguese
    fireEvent.click(screen.getByText("Set PT"));

    expect(screen.getByTestId("sport-basketball").textContent).toBe("Basquetebol");
    expect(screen.getByTestId("sport-beach-volleyball").textContent).toBe("Voleibol de Praia");
    expect(screen.getByTestId("sport-beach-snake").textContent).toBe("Voleibol de Praia");
    expect(screen.getByTestId("sport-volleyball").textContent).toBe("Voleibol");
    expect(screen.getByTestId("sport-football").textContent).toBe("Futebol");
    expect(screen.getByTestId("sport-tennis").textContent).toBe("Ténis");
    expect(screen.getByTestId("sport-padel").textContent).toBe("Padel");
  });
});
