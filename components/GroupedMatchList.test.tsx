import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import GroupedMatchList, { groupMatchesByTournament } from "./GroupedMatchList";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/components/FollowButton", () => ({
  FollowButton: () => <button type="button" aria-label="Follow" />,
  SportFavoriteButton: () => <button type="button" aria-label="Sport Favorite" />,
}));

const sampleMatches = [
  {
    id: "m1",
    tournament_id: "t1",
    sport_type: "Tennis",
    status: "ongoing",
    scheduled_at: "2026-11-13T15:05:00Z",
    participants: [{ name: "Lisbon Master" }, { name: "Porto FC" }],
    scores: { current: { home: 1, away: 0 } },
    tournaments: { name: "Cantanhede Ladies Open 2026" },
    organizer: { username: "gjoforte" },
  },
  {
    id: "m2",
    tournament_id: "t1",
    sport_type: "Tennis",
    status: "scheduled",
    scheduled_at: "2026-11-13T16:00:00Z",
    participants: [{ name: "Braga" }, { name: "Evora" }],
    scores: { current: { home: 0, away: 0 } },
    tournaments: { name: "Cantanhede Ladies Open 2026" },
    organizer: { username: "gjoforte" },
  },
  {
    id: "m3",
    tournament_id: null,
    sport_type: "Basketball",
    status: "completed",
    scheduled_at: "2026-11-12T20:30:00Z",
    participants: [{ name: "SL Benfica" }, { name: "FC Porto" }],
    scores: { current: { home: 80, away: 81 }, basketball: { total_points: [80, 81] } },
  },
];

describe("groupMatchesByTournament", () => {
  it("groups matches by tournament_id and puts null tournament_id into __standalone__", () => {
    const groups = groupMatchesByTournament(sampleMatches);
    expect(groups).toHaveLength(2);
    expect(groups[0].key).toBe("t1");
    expect(groups[0].matches).toHaveLength(2);
    expect(groups[1].key).toBe("__standalone__");
    expect(groups[1].matches).toHaveLength(1);
  });
});

describe("GroupedMatchList", () => {
  beforeEach(() => {
    pushMock.mockClear();
  });

  it("renders tournament header once for multiple matches and standalone section", () => {
    render(
      <LanguageProvider>
        <GroupedMatchList matches={sampleMatches} />
      </LanguageProvider>
    );

    expect(screen.getAllByText("Cantanhede Ladies Open 2026")).toHaveLength(1);
    expect(screen.getByText("@gjoforte")).toBeInTheDocument();
    expect(screen.getByText(/standalone matches/i)).toBeInTheDocument();
    expect(screen.getAllByText("Lisbon Master").length).toBeGreaterThan(0);
  });

  it("collapses and expands a tournament group on toggle click", async () => {
    const user = userEvent.setup();
    render(
      <LanguageProvider>
        <GroupedMatchList matches={sampleMatches} />
      </LanguageProvider>
    );

    const toggleButtons = screen.getAllByRole("button", { expanded: true });
    await user.click(toggleButtons[0]);

    expect(screen.getByText("Matches (2)")).toBeInTheDocument();
    expect(screen.queryByText("Lisbon Master")).not.toBeInTheDocument();
  });
});
