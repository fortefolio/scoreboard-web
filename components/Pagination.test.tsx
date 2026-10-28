import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Pagination from "./Pagination";
import { LanguageProvider, useTranslation } from "@/lib/i18n";

function PaginationWithLanguageSwitcher({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  const { setLocale } = useTranslation();
  return (
    <div>
      <button onClick={() => setLocale("pt")}>Set PT</button>
      <button onClick={() => setLocale("en")}>Set EN</button>
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
    </div>
  );
}

describe("Pagination Component", () => {
  it("renders nothing when totalPages <= 1", () => {
    const { container } = render(
      <LanguageProvider>
        <Pagination currentPage={1} totalPages={1} onPageChange={vi.fn()} />
      </LanguageProvider>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders page buttons, chevrons, and page summary for multiple pages", () => {
    render(
      <LanguageProvider>
        <Pagination currentPage={1} totalPages={6} onPageChange={vi.fn()} />
      </LanguageProvider>
    );

    // Summary
    expect(screen.getByText(/page 1 of 6/i)).toBeInTheDocument();

    // Previous and Next buttons with icons
    const prevButton = screen.getByRole("button", { name: /previous/i });
    const nextButton = screen.getByRole("button", { name: /next/i });
    expect(prevButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();

    // Page numbers visible: 1, 2, ... 6
    expect(screen.getByRole("button", { name: "1" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "6" })).toBeInTheDocument();
    expect(screen.getByText("...")).toBeInTheDocument();
  });

  it("triggers onPageChange when clicking next, previous, or page number", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();

    render(
      <LanguageProvider>
        <Pagination currentPage={2} totalPages={6} onPageChange={onPageChange} />
      </LanguageProvider>
    );

    const prevButton = screen.getByRole("button", { name: /previous/i });
    const nextButton = screen.getByRole("button", { name: /next/i });
    const page3Button = screen.getByRole("button", { name: "3" });

    await user.click(prevButton);
    expect(onPageChange).toHaveBeenCalledWith(1);

    await user.click(nextButton);
    expect(onPageChange).toHaveBeenCalledWith(3);

    await user.click(page3Button);
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("translates labels according to current language (Anterior/Seguinte)", async () => {
    const user = userEvent.setup();

    render(
      <LanguageProvider>
        <PaginationWithLanguageSwitcher currentPage={1} totalPages={6} onPageChange={vi.fn()} />
      </LanguageProvider>
    );

    expect(screen.getByRole("button", { name: /previous/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();

    // Switch to Portuguese
    await user.click(screen.getByText("Set PT"));

    expect(screen.getByRole("button", { name: /anterior/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /seguinte/i })).toBeInTheDocument();
    expect(screen.getByText(/página 1 de 6/i)).toBeInTheDocument();
  });
});
