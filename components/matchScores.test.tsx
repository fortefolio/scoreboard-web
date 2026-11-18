import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import MatchCard from "./MatchCard";
import MatchListItem from "./MatchListItem";
import { getMatchColumns } from "./entityTableColumns";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
  },
}));

vi.mock("@/components/FollowButton", () => ({
  FollowButton: () => <button type="button" aria-label="Follow" />,
  SportFavoriteButton: () => <button type="button" aria-label="Follow" />,
}));

const sampleFootballMatch = {
  id: "match-1",
  sport_type: "Football",
  status: "ongoing",
  participants: [{ name: "Sporting CP" }, { name: "FC Porto" }],
  scores: {
    current: { home: 2, away: 1 },
    football: { goals: [2, 1] },
  },
  tournaments: { name: "Liga Portugal" },
};

describe("Match score font-digital and vertical layout regressions", () => {
  it("renders getMatchColumns score cell vertically with font-digital", () => {
    const columns = getMatchColumns((key) => key);
    const scoreCol = columns.find((c) => c.key === "score");
    expect(scoreCol).toBeDefined();

    const { container } = render(<>{scoreCol!.render(sampleFootballMatch)}</>);
    const wrapper = container.firstElementChild as HTMLElement;

    expect(wrapper).toHaveClass("flex-col", "font-digital");
    expect(wrapper.textContent).not.toContain("-");
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("renders MatchListItem scores vertically per team with font-digital", () => {
    render(
      <LanguageProvider>
        <MatchListItem match={sampleFootballMatch} />
      </LanguageProvider>
    );

    const score0 = screen.getByText("2");
    const score1 = screen.getByText("1");
    expect(score0).toHaveClass("font-digital");
    expect(score1).toHaveClass("font-digital");
    expect(score0.closest("div")).not.toBe(score1.closest("div"));
  });

  it("renders MatchCard scores vertically per team with font-digital", () => {
    render(
      <LanguageProvider>
        <MatchCard match={sampleFootballMatch} />
      </LanguageProvider>
    );

    const score0 = screen.getByText("2");
    const score1 = screen.getByText("1");
    expect(score0).toHaveClass("font-digital");
    expect(score1).toHaveClass("font-digital");
    expect(score0.closest("div")).not.toBe(score1.closest("div"));
  });

  it("omits the favorite button in MatchListItem and getMatchColumns when showFavorite is false", () => {
    const { rerender } = render(
      <LanguageProvider>
        <MatchListItem match={sampleFootballMatch} showFavorite={false} />
      </LanguageProvider>
    );
    expect(screen.queryByRole("button", { name: /follow/i })).not.toBeInTheDocument();

    const cols = getMatchColumns((k) => k, [], { showFavorite: false });
    const teamsCol = cols.find((c) => c.key === "teams");
    expect(teamsCol).toBeDefined();
    rerender(
      <LanguageProvider>
        <>{teamsCol!.render(sampleFootballMatch)}</>
      </LanguageProvider>
    );
    expect(screen.queryByRole("button", { name: /follow/i })).not.toBeInTheDocument();
  });
});
