import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import TermsPage from "./page";

describe("TermsPage Component", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders terms & conditions page with key legal sections", () => {
    render(
      <LanguageProvider>
        <TermsPage />
      </LanguageProvider>
    );

    expect(screen.getByText(/Terms & Conditions of Service/i)).toBeInTheDocument();
    expect(screen.getByText(/Introduction & Acceptance of Terms/i)).toBeInTheDocument();
    expect(screen.getByText(/Subscriptions, Billing & Club Vouchers/i)).toBeInTheDocument();
    expect(screen.getByText(/Privacy, Data Retention & GDPR/i)).toBeInTheDocument();
    expect(screen.getByText("support@scoreboard.app")).toBeInTheDocument();
  });

  it("renders Portuguese translations when locale is pt", () => {
    localStorage.setItem("scoreboard_locale", "pt");

    render(
      <LanguageProvider>
        <TermsPage />
      </LanguageProvider>
    );

    expect(screen.getByText(/Termos & Condições de Utilização/i)).toBeInTheDocument();
    expect(screen.getByText(/Introdução e Aceitação/i)).toBeInTheDocument();
    expect(screen.getByText(/Subscrições, Faturação e Vouchers de Clube/i)).toBeInTheDocument();
  });
});
