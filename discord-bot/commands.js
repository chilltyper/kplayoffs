
import { SlashCommandBuilder } from "discord.js";

const seasons = [
  "Alpha",
  "Season 1",
  "Season 2",
  "Season 3",
  "Season 4",
  "Season 5",
  "Season 6",
  "Season 7",
  "Season 8",
  "Season 9"
];

const statistics = [
  { name: "Total races", value: "totalRaces" },
  { name: "Average WPM", value: "avgWpm" },
  { name: "Average accuracy", value: "avgAccuracy" },
  { name: "Duels played", value: "duelsPlayed" },
  { name: "Seasons played", value: "seasonsPlayed" },
  { name: "Average races per duel", value: "avgRacesPerDuel" },
  { name: "Average races per season", value: "avgRacesPerSeason" }
];

export const commands = [

  // PLAYER
  new SlashCommandBuilder()
    .setName("player")
    .setDescription("Look up a KPLAYOFFS player.")
    .addStringOption(option =>
      option
        .setName("player")
        .setDescription("Player name, username, or racer ID")
        .setRequired(true)
        .setAutocomplete(true)
    ),

  // LEADERBOARD
  new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("View the all-time playoffs leaderboard.")
    .addStringOption(option =>
      option
        .setName("stat")
        .setDescription("Choose the statistic to rank by")
        .setRequired(true)
        .addChoices(...statistics.map(stat => ({
          name: stat.name,
          value: stat.value
        })))
    ),

  // DUEL
  new SlashCommandBuilder()
    .setName("duel")
    .setDescription("View an individual duel's results.")
    .addIntegerOption(option =>
      option
        .setName("id")
        .setDescription("Klavia competition ID")
        .setRequired(true)
        .setMinValue(1)
    )
    .addStringOption(option =>
      option
        .setName("sort")
        .setDescription("Choose how to rank the duel")
        .setRequired(false)
        .addChoices(
          { name: "Races", value: "races" },
          { name: "WPM", value: "wpm" },
          { name: "Accuracy", value: "accuracy" },
          { name: "Points", value: "points" }
        )
    ),

  // SEASON
  new SlashCommandBuilder()
    .setName("season")
    .setDescription("View the leaderboard for an individual season.")
    .addStringOption(option =>
      option
        .setName("name")
        .setDescription("Choose a playoffs season")
        .setRequired(true)
        .addChoices(...seasons.map(season => ({
          name: season,
          value: season
        })))
    )
    .addStringOption(option =>
      option
        .setName("stat")
        .setDescription("Choose the ranking statistic")
        .setRequired(false)
        .addChoices(...statistics.map(stat => ({
          name: stat.name,
          value: stat.value
        })))
    ),

  // COMPARE
  new SlashCommandBuilder()
    .setName("compare")
    .setDescription("Compare two KPLAYOFFS players.")
    .addStringOption(option =>
      option
        .setName("player1")
        .setDescription("First player")
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(option =>
      option
        .setName("player2")
        .setDescription("Second player")
        .setRequired(true)
        .setAutocomplete(true)
    )

];
