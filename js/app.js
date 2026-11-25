
import { seasons, competitions } from "../data/competitions.js";

import {
  aggregatePlayers,
  sortPlayers
} from "./leaderboard.js";

let players = [];

let sortKey = "totalRaces";
let sortDirection = "desc";

const tableBody = document.querySelector("#leaderboard-body");
const status = document.querySelector("#table-status");

const seasonCount = document.querySelector("#season-count");
const duelCount = document.querySelector("#duel-count");
const playerCount = document.querySelector("#player-count");

const numberFormat = new Intl.NumberFormat("en-US");

// Show the season and competition counts.
seasonCount.textContent = numberFormat.format(seasons.length);
duelCount.textContent = numberFormat.format(competitions.length);


// Draw the leaderboard.
function renderLeaderboard() {
  tableBody.replaceChildren();

  const topPlayers = sortPlayers(
    players,
    sortKey,
    sortDirection
  );

  if (topPlayers.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");

    cell.colSpan = 10;
    cell.textContent = "No eligible players found.";

    row.appendChild(cell);
    tableBody.appendChild(row);

    return;
  }

  topPlayers.forEach(player => {
    const row = document.createElement("tr");

    const values = [
      player.rank,

      player.displayName || player.userName,

      player.teams.join(", ") || "—",

      numberFormat.format(player.totalRaces),

      player.avgWpm === null
        ? "—"
        : player.avgWpm.toFixed(1),

      player.avgAccuracy === null
        ? "—"
        : `${player.avgAccuracy.toFixed(2)}%`,

      numberFormat.format(player.duelsPlayed),

      numberFormat.format(player.seasonsPlayed),

      player.avgRacesPerDuel.toFixed(1),

      player.avgRacesPerSeason.toFixed(1)
    ];

    values.forEach(value => {
      const cell = document.createElement("td");
      cell.textContent = String(value);
      row.appendChild(cell);
    });

    tableBody.appendChild(row);
  });
}


// Update arrows on the sortable headings.
function updateSortIndicators() {
  document.querySelectorAll("[data-sort]").forEach(button => {
    const active = button.dataset.sort === sortKey;

    const arrow = active
      ? sortDirection === "desc" ? " ↓" : " ↑"
      : "";

    button.textContent = button.dataset.label + arrow;
  });
}


// Attach sorting events to every sortable heading.
document.querySelectorAll("[data-sort]").forEach(button => {
  button.addEventListener("click", () => {
    const selectedKey = button.dataset.sort;

    if (selectedKey === sortKey) {
      sortDirection =
        sortDirection === "desc" ? "asc" : "desc";
    } else {
      sortKey = selectedKey;

      // Names and teams start A-Z.
      // Numerical statistics start highest-first.
      sortDirection =
        ["displayName", "teams"].includes(selectedKey)
          ? "asc"
          : "desc";
    }

    updateSortIndicators();
    renderLeaderboard();
  });
});


// Load the saved competition database.
async function loadDatabase() {
  try {
    status.textContent = "Loading playoff statistics...";

    const databaseURL = new URL(
      "../data/competition-results.json",
      import.meta.url
    );

    const response = await fetch(databaseURL, {
      cache: "no-cache"
    });

    if (!response.ok) {
      throw new Error(
        `Could not load player database. HTTP ${response.status}`
      );
    }

    const database = await response.json();

    if (
      !Array.isArray(database.competitions) ||
      database.competitions.length === 0
    ) {
      throw new Error("Competition database is empty or invalid.");
    }

    if (database.competitions.length !== competitions.length) {
      throw new Error(
        `Expected ${competitions.length} competitions but found ` +
        `${database.competitions.length}.`
      );
    }

    // Combine all racer appearances into unique players.
    players = aggregatePlayers(database.competitions);

    playerCount.textContent = numberFormat.format(players.length);

    updateSortIndicators();
    renderLeaderboard();

    const updated = database.generatedAt
      ? new Date(database.generatedAt).toLocaleString()
      : "Unknown";

    status.textContent =
      `Showing top ${Math.min(100, players.length)} of ` +
      `${numberFormat.format(players.length)} players` +
      ` · ${database.competitionCount} duels loaded` +
      ` · Updated ${updated}`;

  } catch (error) {
    console.error("Leaderboard loading error:", error);

    playerCount.textContent = "—";

    status.textContent =
      `Could not load leaderboard: ${error.message}`;
  }
}


// Start the website.
loadDatabase();
