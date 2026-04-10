import { useEffect, useState } from "react";
import type { GamificationMe, LeaderboardEntry } from "../types";
import { api } from "../lib/api";

type Props = {
  token: string;
};

export function LeaderboardPage({ token }: Props) {
  const [me, setMe] = useState<GamificationMe | null>(null);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setError(null);
    const [meResult, board] = await Promise.all([
      api.gamificationMe(token),
      api.gamificationLeaderboard(token, 25),
    ]);
    setMe(meResult);
    setEntries(board.entries);
    setTotalUsers(board.totalUsers);
  }

  useEffect(() => {
    refresh().catch((e: Error) => setError(e.message));
  }, [token]);

  return (
    <main className="leaderboard-shell">
      <header className="leaderboard-head">
        <div>
          <h1>Leaderboard</h1>
          <p>
            Top contributors right now. {totalUsers ? `${totalUsers} total users.` : ""}
          </p>
          {me && (
            <div className="leaderboard-me">
              <span>Rank #{me.rank}</span>
              <span>{me.points} points</span>
              <span>
                Level {me.level} {me.levelName}
              </span>
            </div>
          )}
        </div>
        <button className="ghost" onClick={() => refresh()}>
          Refresh
        </button>
      </header>

      {error && <div className="leaderboard-error">{error}</div>}

      <section className="leaderboard-table" aria-label="Leaderboard table">
        <div className="leaderboard-row leaderboard-row-head">
          <div>Rank</div>
          <div>Name</div>
          <div>Points</div>
          <div>Level</div>
        </div>
        {entries.map((entry, index) => (
          <div key={`${entry.rank}-${entry.name}-${entry.points}-${index}`} className="leaderboard-row">
            <div className="leaderboard-rank">#{entry.rank}</div>
            <div className="leaderboard-name">{entry.name}</div>
            <div className="leaderboard-points">{entry.points}</div>
            <div className="leaderboard-level">
              {entry.level} {entry.levelName}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
