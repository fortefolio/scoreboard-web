import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import LanguageSelector from "./LanguageSelector";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";

function renderLanguageSelector() {
  return render(
    <LanguageProvider>
      <LanguageSelector />
    </LanguageProvider>
  );
}

describe("LanguageSelector Component", () => {
  it("renders trigger button with current language uppercase code", () => {
    renderLanguageSelector();
    // Default locale is en
    expect(screen.getByRole("button", { name: /Select language/i })).toHaveTextContent("EN");
  });

  it("opens dropdown and selects language on click", () => {
    renderLanguageSelector();
    const trigger = screen.getByRole("button", { name: /Select language/i });

    // Open dropdown
    fireEvent.click(trigger);
    expect(screen.getByRole("listbox", { name: /Available languages/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Português/i })).toBeInTheDocument();

    // Select Portuguese
    fireEvent.click(screen.getByRole("option", { name: /Português/i }));

    // Dropdown should close and trigger should show PT
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger).toHaveTextContent("PT");
  });

  it("closes dropdown on Escape key", () => {
    renderLanguageSelector();
    const trigger = screen.getByRole("button", { name: /Select language/i });

    fireEvent.click(trigger);
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
