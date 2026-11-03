import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TermsPage from "./page";

describe("TermsPage Component", () => {
  it("renders terms & conditions page with key legal sections", () => {
    render(<TermsPage />);

    expect(screen.getByText(/Terms & Conditions of Service/i)).toBeInTheDocument();
    expect(screen.getByText(/Introduction & Acceptance of Terms/i)).toBeInTheDocument();
    expect(screen.getByText(/Subscriptions, Billing & Club Vouchers/i)).toBeInTheDocument();
    expect(screen.getByText(/Privacy, Data Retention & GDPR/i)).toBeInTheDocument();
    expect(screen.getByText("support@scoreboard.app")).toBeInTheDocument();
  });

  it("switches language between English and Portuguese", () => {
    render(<TermsPage />);

    const ptButton = screen.getByRole("button", { name: "PT" });
    fireEvent.click(ptButton);

    expect(screen.getByText(/Termos & Condições de Utilização/i)).toBeInTheDocument();
    expect(screen.getByText(/Introdução e Aceitação/i)).toBeInTheDocument();
    expect(screen.getByText(/Subscrições, Faturação e Vouchers de Clube/i)).toBeInTheDocument();

    const enButton = screen.getByRole("button", { name: "EN" });
    fireEvent.click(enButton);

    expect(screen.getByText(/Terms & Conditions of Service/i)).toBeInTheDocument();
  });
});
