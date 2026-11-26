
function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return NaN;
  }

  const result = Number(value);
  return Number.isFinite(result) ? result : NaN;
}

export function aggregatePlayers(competitionResults) {
  const players = new Map();

  for (const competition of competitionResults) {
    const seenInDuel = new Set();

    for (const racer of competition.racers || []) {
      const id = String(racer.racerId ?? "").trim();
      const races = toNumber(racer.races);

      // Only include players who completed at least one race.
      if (!id || !Number.isFinite(races) || races <= 0) {
        continue;
      }

      // Prevent duplicate entries within the same duel.
      if (seenInDuel.has(id)) continue;
      seenInDuel.add(id);

      // Create a new player record if necessary.
      if (!players.has(id)) {
        players.set(id, {
          racerId: id,
          userName: "",
          displayName: "",

          totalRaces: 0,

          // These MUST be Sets because we use .add() below.
          duelIds: new Set(),
          seasons: new Set(),
          teams: new Set(),

          weightedWpm: 0,
          wpmWeight: 0,

          weightedAccuracy: 0,
          accuracyWeight: 0
        });
      }

      const player = players.get(id);

      const wpm = toNumber(racer.wpm);
      const accuracy = toNumber(racer.accuracy);

      // Total races.
      player.totalRaces += races;

      // Unique duels and seasons.
      player.duelIds.add(String(competition.id));

      if (competition.season) {
        player.seasons.add(competition.season);
      }

      // Unique teams.
      const team = String(racer.team || "").trim();

      if (team) {
        player.teams.add(team);
      }

      // Race-weighted average WPM.
      if (Number.isFinite(wpm)) {
        player.weightedWpm += wpm * races;
        player.wpmWeight += races;
      }

      // Race-weighted average accuracy.
      if (Number.isFinite(accuracy)) {
        player.weightedAccuracy += accuracy * races;
        player.accuracyWeight += races;
      }

      // Use the current names returned by the API.
      if (racer.displayName?.trim()) {
        player.displayName = racer.displayName.trim();
      }

      if (racer.userName?.trim()) {
        player.userName = racer.userName.trim();
      }
    }
  }

  // Convert internal records into regular JavaScript objects.
  return Array.from(players.values()).map(player => {
    const duelsPlayed = player.duelIds.size;
    const seasonsPlayed = player.seasons.size;

    return {
      racerId: player.racerId,
      userName: player.userName,
      displayName: player.displayName || player.userName,

      totalRaces: player.totalRaces,

      avgWpm: player.wpmWeight > 0
        ? player.weightedWpm / player.wpmWeight
        : null,

      avgAccuracy: player.accuracyWeight > 0
        ? player.weightedAccuracy / player.accuracyWeight
        : null,

      duelsPlayed,
      seasonsPlayed,

      avgRacesPerDuel: duelsPlayed > 0
        ? player.totalRaces / duelsPlayed
        : 0,

      avgRacesPerSeason: seasonsPlayed > 0
        ? player.totalRaces / seasonsPlayed
        : 0,

      teams: [...player.teams].sort(),

      seasons: [...player.seasons]
    };
  });
}


// Sort players by any selected leaderboard column.
export function sortPlayers(
  players,
  sortKey = "totalRaces",
  direction = "desc"
) {
  const sorted = [...players];

  sorted.sort((a, b) => {
    let aValue = a[sortKey];
    let bValue = b[sortKey];

    if (Array.isArray(aValue)) {
      aValue = aValue.join(", ");
    }

    if (Array.isArray(bValue)) {
      bValue = bValue.join(", ");
    }

    // Always place missing values at the bottom.
    if (aValue == null && bValue != null) return 1;
    if (bValue == null && aValue != null) return -1;
    if (aValue == null && bValue == null) return 0;

    let comparison;

    if (
      typeof aValue === "number" &&
      typeof bValue === "number"
    ) {
      comparison = aValue - bValue;
    } else {
      comparison = String(aValue).localeCompare(
        String(bValue),
        undefined,
        {
          numeric: true,
          sensitivity: "base"
        }
      );
    }

    if (comparison !== 0) {
      return direction === "asc"
        ? comparison
        : -comparison;
    }

    // Consistent tie-breaking.
    return (
      b.totalRaces - a.totalRaces ||
      a.displayName.localeCompare(b.displayName)
    );
  });

  // Sort the entire database BEFORE limiting to 100.
  return sorted.slice(0, 100).map((player, index) => ({
    ...player,
    rank: index + 1
  }));
}
