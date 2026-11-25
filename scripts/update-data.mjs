
import {
  readFile,
  mkdir,
  writeFile,
  rename
} from "node:fs/promises";

import path from "node:path";
import { fileURLToPath } from "node:url";

import { competitions } from "../data/competitions.js";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

const WORKER_URL =
  "https://api-worker.klaviaplayoffs.workers.dev";

const OUTPUT_FILE = path.join(
  ROOT,
  "data",
  "competition-results.json"
);

const SECRET_FILE = path.join(
  ROOT,
  "api-worker",
  ".dev.vars"
);

// Read local secrets without putting them in source code.
function parseVars(contents) {
  const values = {};

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");

    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();

    let value = trimmed.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

const secretContents = await readFile(SECRET_FILE, "utf8");
const secrets = parseVars(secretContents);

const syncKey = secrets.SYNC_KEY;

if (!syncKey) {
  throw new Error(
    "SYNC_KEY is missing from api-worker/.dev.vars"
  );
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Retrieve a competition, retrying temporary failures.
async function fetchCompetition(competition) {
  let lastError;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(
        `${WORKER_URL}/api/comps/${competition.id}`,
        {
          headers: {
            "Accept": "application/json",
            "X-Sync-Key": syncKey
          },
          signal: AbortSignal.timeout(30000)
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: ${
            result.error || "Unknown error"
          }`
        );
      }

      if (
        result.competitionId !== competition.id ||
        !Array.isArray(result.racers)
      ) {
        throw new Error("Unexpected competition response");
      }

      return {
        id: competition.id,
        season: competition.season,
        racerCount: result.racerCount,
        racers: result.racers
      };

    } catch (error) {
      lastError = error;

      console.error(
        `Competition ${competition.id}, attempt ${attempt}/3:`,
        error.message
      );

      if (attempt < 3) {
        await delay(attempt * 1500);
      }
    }
  }

  throw new Error(
    `Failed to retrieve competition ${competition.id}: ${
      lastError?.message
    }`
  );
}

// Download with controlled concurrency.
const results = new Array(competitions.length);
const failures = [];

let nextIndex = 0;
let completed = 0;

async function worker() {
  while (true) {
    const index = nextIndex++;

    if (index >= competitions.length) return;

    const competition = competitions[index];

    try {
      results[index] = await fetchCompetition(competition);

      completed++;

      console.log(
        `[${completed}/${competitions.length}] ` +
        `${competition.season} — ${competition.id} — ` +
        `${results[index].racerCount} racers`
      );

    } catch (error) {
      failures.push(error.message);
    }
  }
}

console.log(
  `Starting download of ${competitions.length} competitions...`
);

await Promise.all(
  Array.from({ length: 4 }, () => worker())
);

// Never produce a misleading partial database.
if (failures.length > 0) {
  console.error("\nSome competitions could not be retrieved:");

  failures.forEach(error => console.error("- " + error));

  throw new Error(
    "Update cancelled. Fix the failed competitions and retry."
  );
}

// Save only after every competition has succeeded.
const database = {
  generatedAt: new Date().toISOString(),
  competitionCount: results.length,
  competitions: results
};

await mkdir(path.dirname(OUTPUT_FILE), {
  recursive: true
});

const temporaryFile = OUTPUT_FILE + ".tmp";

await writeFile(
  temporaryFile,
  JSON.stringify(database, null, 2),
  "utf8"
);

await rename(temporaryFile, OUTPUT_FILE);

console.log("\n==================================");
console.log("PLAYOFFS DATABASE UPDATED");
console.log("==================================");
console.log(`Competitions: ${results.length}`);
console.log(
  `Total racer appearances: ${
    results.reduce((sum, item) => sum + item.racerCount, 0)
  }`
);
console.log(`Saved to: ${OUTPUT_FILE}`);
console.log("==================================");
