
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
    // Prevent accidental duplicate entries within a duel.
    const seenInDuel = new Set();

    for (const racer of competition.racers || []) {
      const id = String(racer.racerId ?? "").trim();
      const races = toNumber(racer.races);

      // Only count players who actually raced.
      if (!id || !Number.isFinite(races) || races <= 0) {
        continue;
      }

      if (seenInDuel.has(id)) continue;
      seenInDuel.add(id);

      if (!players.has(id)) {
        players.set(id, {
          racerId: id,
          userName: "",
          displayName: "",

          totalRaces: 0,

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

      // Add the race count.
      player.totalRaces += races;

      // Record unique competitions and seasons.
      player.duelIds.add(String(competition.id));

      if (competition.season) {
        player.seasons.add(competition.season);
      }

      // Record every team the player has represented.
      const team = String(racer.team || "").trim();

      if (team) {
        player.teams.add(team);
      }

      // Race-weighted WPM.
      if (Number.isFinite(wpm)) {
        player.weightedWpm += wpm * races;
        player.wpmWeight += races;
      }

      // Race-weighted accuracy.
      if (Number.isFinite(accuracy)) {
        player.weightedAccuracy += accuracy * races;
        player.accuracyWeight += races;
      }

      // Keep the most recently encountered available names.
      if (racer.displayName?.trim()) {
        player.displayName = racer.displayName.trim();
      }

        // Store every observed username.
        if (racer.userName?.trim()) {
        const name = racer.userName.trim();
        
        player.userNames.add(name);
        player.userName = name;
        }
    }
  }

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

      avgRacesPerDuel: player.totalRaces / duelsPlayed,

      avgRacesPerSeason: player.totalRaces / seasonsPlayed,

      teams: [...player.teams].sort(),

      seasons: [...player.seasons].sort()
    };
  });
}


// Sort players by any supported statistic.
export function sortPlayers(players, sortKey, direction) {
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

    // Always keep unavailable values at the bottom.
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

  return sorted.slice(0, 100).map((player, index) => ({
    ...player,
    rank: index + 1
  }));
}
