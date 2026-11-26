
import { aggregatePlayers } from "./leaderboard.js";

const params = new URLSearchParams(window.location.search);
const racerId = params.get("id");

const numberFormat = new Intl.NumberFormat("en-US");

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return NaN;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : NaN;
}

const elements = {
  name: document.querySelector("#player-name"),
  meta: document.querySelector("#player-meta"),
  teams: document.querySelector("#player-teams"),
  error: document.querySelector("#profile-error"),

  races: document.querySelector("#profile-races"),
  wpm: document.querySelector("#profile-wpm"),
  accuracy: document.querySelector("#profile-accuracy"),
  duels: document.querySelector("#profile-duels"),
  seasons: document.querySelector("#profile-seasons"),
  racesDuel: document.querySelector("#profile-races-duel"),
  racesSeason: document.querySelector("#profile-races-season"),

  seasonHistory: document.querySelector("#season-history-body"),
  duelHistory: document.querySelector("#duel-history-body")
};

function formatNumber(value) {
  return numberFormat.format(value);
}

function formatWpm(value) {
  return Number.isFinite(value) ? value.toFixed(1) : "—";
}

function formatAccuracy(value) {
  return Number.isFinite(value)
    ? `${value.toFixed(2)}%`
    : "—";
}

function createCell(value) {
  const cell = document.createElement("td");
  cell.textContent = String(value ?? "—");
  return cell;
}

function createEmptyRow(body, message, columnCount) {
  const row = document.createElement("tr");
  const cell = createCell(message);

  cell.colSpan = columnCount;

  row.appendChild(cell);
  body.appendChild(row);
}

function showError(message) {
  elements.name.textContent = "Player not found";
  elements.meta.textContent = "";
  elements.error.textContent = message;
  elements.error.hidden = false;

  document.title = "Player Not Found | KPLAYOFFS";
}

function renderTeams(teams) {
  elements.teams.replaceChildren();

  if (!teams.length) {
    elements.teams.textContent = "No team information available";
    return;
  }

  teams.forEach(team => {
    const chip = document.createElement("span");

    chip.className = "team-chip";
    chip.textContent = team;

    elements.teams.appendChild(chip);
  });
}


// Calculate statistics for each season.
function buildSeasonHistory(appearances) {
  const seasonMap = new Map();

  for (const appearance of appearances) {
    const { season, racer } = appearance;

    if (!seasonMap.has(season)) {
      seasonMap.set(season, {
        season,
        duels: 0,
        races: 0,

        weightedWpm: 0,
        wpmWeight: 0,

        weightedAccuracy: 0,
        accuracyWeight: 0
      });
    }

    const stats = seasonMap.get(season);
    const races = Number(racer.races) || 0;
    const wpm = toNumber(racer.wpm);
    const accuracy = toNumber(racer.accuracy);

    stats.duels++;
    stats.races += races;

    if (Number.isFinite(wpm) && races > 0) {
      stats.weightedWpm += wpm * races;
      stats.wpmWeight += races;
    }

    if (Number.isFinite(accuracy) && races > 0) {
      stats.weightedAccuracy += accuracy * races;
      stats.accuracyWeight += races;
    }
  }

  return [...seasonMap.values()];
}


// Display the season history table.
function renderSeasonHistory(history) {
  elements.seasonHistory.replaceChildren();

  if (!history.length) {
    createEmptyRow(
      elements.seasonHistory,
      "No season history available.",
      5
    );
    return;
  }

  history.forEach(season => {
    const row = document.createElement("tr");

    const avgWpm = season.wpmWeight
      ? season.weightedWpm / season.wpmWeight
      : NaN;

    const avgAccuracy = season.accuracyWeight
      ? season.weightedAccuracy / season.accuracyWeight
      : NaN;

    const values = [
      season.season,
      season.duels,
      formatNumber(season.races),
      formatWpm(avgWpm),
      formatAccuracy(avgAccuracy)
    ];

    values.forEach(value => {
      row.appendChild(createCell(value));
    });

    elements.seasonHistory.appendChild(row);
  });
}


// Display each individual duel.
function renderDuelHistory(appearances) {
  elements.duelHistory.replaceChildren();

  if (!appearances.length) {
    createEmptyRow(
      elements.duelHistory,
      "No duel history available.",
      7
    );
    return;
  }

  appearances.forEach(({ season, id, racer }) => {
    const row = document.createElement("tr");

    row.appendChild(createCell(season));

    const duelCell = document.createElement("td");
    const duelLink = document.createElement("a");

    duelLink.href = `https://klavia.io/comps/${id}`;
    duelLink.target = "_blank";
    duelLink.rel = "noopener noreferrer";
    duelLink.textContent = String(id);
    duelLink.className = "player-link";

    duelCell.appendChild(duelLink);
    row.appendChild(duelCell);

    const values = [
      racer.team || "—",
      racer.squad || "—",
      formatNumber(Number(racer.races) || 0),
      formatWpm(toNumber(racer.wpm)),
      formatAccuracy(toNumber(racer.accuracy))
    ];

    values.forEach(value => {
      row.appendChild(createCell(value));
    });

    elements.duelHistory.appendChild(row);
  });
}


// Fill the profile with the selected player's information.
function renderProfile(player, appearances) {
  elements.name.textContent =
    player.displayName || player.userName || "Unknown player";

  elements.meta.textContent =
    `@${player.userName || "Unknown"} · Racer ID: ${player.racerId}`;

  document.title =
    `${player.displayName || player.userName} | KPLAYOFFS`;

  renderTeams(player.teams);

  elements.races.textContent = formatNumber(player.totalRaces);

  elements.wpm.textContent =
    formatWpm(player.avgWpm);

  elements.accuracy.textContent =
    formatAccuracy(player.avgAccuracy);

  elements.duels.textContent =
    formatNumber(player.duelsPlayed);

  elements.seasons.textContent =
    formatNumber(player.seasonsPlayed);

  elements.racesDuel.textContent =
    formatWpm(player.avgRacesPerDuel);

  elements.racesSeason.textContent =
    formatWpm(player.avgRacesPerSeason);

  const seasonHistory = buildSeasonHistory(appearances);

  renderSeasonHistory(seasonHistory);
  renderDuelHistory(appearances);

  elements.error.hidden = true;
}


// Load the player's data from the saved JSON database.
async function loadProfile() {
  try {
    if (!racerId || !/^\d+$/.test(racerId)) {
      showError("The player ID in this URL is missing or invalid.");
      return;
    }

    const databaseURL = new URL(
      "../data/competition-results.json",
      import.meta.url
    );

    const response = await fetch(databaseURL, {
      cache: "no-cache"
    });

    if (!response.ok) {
      throw new Error(
        `Could not load the competition database. HTTP ${response.status}`
      );
    }

    const database = await response.json();

    if (!Array.isArray(database.competitions)) {
      throw new Error("The competition database is invalid.");
    }

    // Find the player across all competitions.
    const players = aggregatePlayers(database.competitions);

    const player = players.find(
      item => String(item.racerId) === racerId
    );

    if (!player) {
      showError(
        "This player could not be found in the playoff database."
      );
      return;
    }

    // Gather all competitions this player participated in.
    const appearances = [];

    for (const competition of database.competitions) {
      const racer = (competition.racers || []).find(
        item => String(item.racerId) === racerId
      );

      if (!racer || !(Number(racer.races) > 0)) {
        continue;
      }

      appearances.push({
        id: competition.id,
        season: competition.season,
        racer
      });
    }

    renderProfile(player, appearances);

  } catch (error) {
    console.error("Player profile error:", error);

    showError(
      `Unable to load this profile: ${error.message}`
    );
  }
}

loadProfile();
