
import {
  readFile,
  writeFile,
  mkdir
} from "node:fs/promises";

import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  aggregatePlayers
} from "../js/leaderboard.js";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

const DATA_DIR = path.join(ROOT, "data");

const DATABASE_FILE = path.join(
  DATA_DIR,
  "competition-results.json"
);

const DUELS_DIR = path.join(
  DATA_DIR,
  "discord-duels"
);

async function saveJSON(file, data) {
  await mkdir(path.dirname(file), {
    recursive: true
  });

  await writeFile(
    file,
    JSON.stringify(data, null, 2),
    "utf8"
  );
}

async function main() {
  console.log("Building KPLAYOFFS Discord database...");

  const database = JSON.parse(
    await readFile(DATABASE_FILE, "utf8")
  );

  if (
    !Array.isArray(database.competitions) ||
    database.competitions.length === 0
  ) {
    throw new Error("Competition database is missing or empty.");
  }

  const competitions = database.competitions;

  // 1. All-time player statistics
  const players = aggregatePlayers(competitions);

  await saveJSON(
    path.join(DATA_DIR, "discord-players.json"),
    {
      generatedAt: database.generatedAt,
      playerCount: players.length,
      players
    }
  );

  console.log(`Players: ${players.length}`);

  // 2. Individual season statistics
  const seasonNames = [
    ...new Set(competitions.map(comp => comp.season))
  ];

  const seasons = {};

  for (const seasonName of seasonNames) {
    const seasonCompetitions = competitions.filter(
      comp => comp.season === seasonName
    );

    const seasonPlayers = aggregatePlayers(
      seasonCompetitions
    );

    seasons[seasonName] = {
      name: seasonName,
      duelCount: seasonCompetitions.length,
      playerCount: seasonPlayers.length,
      players: seasonPlayers
    };

    console.log(
      `${seasonName}: ${seasonCompetitions.length} duels`
    );
  }

  await saveJSON(
    path.join(DATA_DIR, "discord-seasons.json"),
    {
      generatedAt: database.generatedAt,
      seasons
    }
  );

  // 3. Individual duel results
  await mkdir(DUELS_DIR, {
    recursive: true
  });

  for (const competition of competitions) {
    const racers = (competition.racers || []).map(racer => ({
      racerId: String(racer.racerId),
      userName: racer.userName || "",
      displayName: racer.displayName || "",

      tier: racer.tier || "",
      team: racer.team || "",
      squad: racer.squad || "",

      races: Number(racer.races) || 0,
      dqs: Number(racer.dqs) || 0,
      dqRate: Number(racer.dqRate) || 0,

      wpm: Number(racer.wpm) || 0,
      accuracy: Number(racer.accuracy) || 0,

      perfectAccuracy: Number(racer.perfectAccuracy) || 0,
      points: Number(racer.points) || 0
    }));

    await saveJSON(
      path.join(DUELS_DIR, `${competition.id}.json`),
      {
        id: competition.id,
        season: competition.season,
        racerCount: racers.length,
        racers
      }
    );
  }

  console.log("\n==============================");
  console.log("DISCORD DATABASE GENERATED");
  console.log("==============================");
  console.log(`Players: ${players.length}`);
  console.log(`Seasons: ${seasonNames.length}`);
  console.log(`Duels: ${competitions.length}`);
  console.log("==============================");
}

main().catch(error => {
  console.error("Database generation failed:", error);
  process.exitCode = 1;
});
