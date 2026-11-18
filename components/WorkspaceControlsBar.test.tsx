import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import {
  WorkspaceControlsBar,
  filterAndSortMatches,
  filterAndSortTournaments,
} from "./WorkspaceControlsBar";

describe("WorkspaceControlsBar", () => {
  const baseProps = {
    searchQuery: "",
    onSearchChange: vi.fn(),
    searchPlaceholder: "Search matches...",
    sportFilter: "all",
    onSportChange: vi.fn(),
    statusFilter: "all",
    onStatusChange: vi.fn(),
    dateSort: "desc" as const,
    onDateSortChange: vi.fn(),
    onClearFilters: vi.fn(),
    viewMode: "list" as const,
    onViewModeChange: vi.fn(),
  };

  it("renders search, status/date controls, sport filter bar, and view toggle", () => {
    render(
      <LanguageProvider>
        <WorkspaceControlsBar {...baseProps} newAction={{ label: "New Match", onClick: vi.fn() }} />
      </LanguageProvider>
    );

    expect(screen.getByPlaceholderText("Search matches...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New Match" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /all sports/i })).toBeInTheDocument();
  });

  it("shows clear button when searchQuery is non-empty and clears on click", async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    render(
      <LanguageProvider>
        <WorkspaceControlsBar {...baseProps} searchQuery="Porto" onSearchChange={onSearchChange} />
      </LanguageProvider>
    );

    await user.click(screen.getAllByRole("button", { name: /clear/i })[0]);
    expect(onSearchChange).toHaveBeenCalledWith("");
  });
});

describe("filterAndSortMatches", () => {
  const sample = [
    {
      id: "1",
      sport_type: "beach_volleyball",
      status: "pending",
      scheduled_at: "2026-10-01T10:00:00Z",
      participants: [{ name: "Pair A" }, { name: "Pair B" }],
      tournaments: { name: "Beach Open" },
      organizer: { username: "alice" },
    },
    {
      id: "2",
      sport_type: "Tennis",
      status: "ongoing",
      scheduled_at: "2026-10-02T10:00:00Z",
      participants: [{ name: "Alcaraz" }, { name: "Sinner" }],
      tournaments: { name: "ATP Final" },
      organizer: { username: "bob" },
    },
  ];

  it("matches Beach Volleyball variants and scheduled/pending status", () => {
    const res = filterAndSortMatches(sample, {
      sportFilter: "Beach Volleyball",
      statusFilter: "scheduled",
      searchQuery: "",
      dateSort: "desc",
    });
    expect(res.map((m) => m.id)).toEqual(["1"]);
  });

  it("filters by @username and sorts ascending/descending", () => {
    const byUser = filterAndSortMatches(sample, {
      sportFilter: "all",
      statusFilter: "all",
      searchQuery: "@bob",
      dateSort: "desc",
    });
    expect(byUser.map((m) => m.id)).toEqual(["2"]);

    const asc = filterAndSortMatches(sample, {
      sportFilter: "all",
      statusFilter: "all",
      searchQuery: "",
      dateSort: "asc",
    });
    expect(asc.map((m) => m.id)).toEqual(["1", "2"]);
  });
});

describe("filterAndSortTournaments", () => {
  const sample = [
    { id: "t1", name: "Winter Cup", sport_type: "Padel", status: "ongoing", start_date: "2026-11-01" },
    { id: "t2", name: "Summer Open", sport_type: "Tennis", status: "completed", start_date: "2026-07-01" },
  ];

  it("filters by search query and status", () => {
    const res = filterAndSortTournaments(sample, {
      sportFilter: "all",
      statusFilter: "ongoing",
      searchQuery: "winter",
      dateSort: "desc",
    });
    expect(res.map((t) => t.id)).toEqual(["t1"]);
  });
});
