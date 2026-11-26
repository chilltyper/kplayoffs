
import "dotenv/config";

import {
  Client,
  Events,
  GatewayIntentBits,
  EmbedBuilder,
  escapeMarkdown,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} from "discord.js";

import {
  aggregatePlayers,
  sortPlayers
} from "../js/leaderboard.js";


// --------------------------------------------------
// CONFIGURATION
// --------------------------------------------------

const TOKEN = process.env.DISCORD_TOKEN;

const DATA_URL =
  "https://kplayoffs.online/data/competition-results.json";

const WEBSITE = "https://kplayoffs.online";

const CACHE_DURATION = 5 * 60 * 1000;

if (!TOKEN) {
  throw new Error("DISCORD_TOKEN is missing from .env");
}


// --------------------------------------------------
// DISCORD CLIENT
// --------------------------------------------------

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});


// --------------------------------------------------
// DATA CACHE
// --------------------------------------------------

let databaseCache = null;
let playersCache = null;
let cacheExpiry = 0;

async function loadData() {
  if (databaseCache && Date.now() < cacheExpiry) {
    return {
      database: databaseCache,
      players: playersCache
    };
  }

  const response = await fetch(DATA_URL, {
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    throw new Error(
      `Could not load KPLAYOFFS data: HTTP ${response.status}`
    );
  }

  const database = await response.json();

  if (!Array.isArray(database.competitions)) {
    throw new Error("Invalid competition database.");
  }

  const players = aggregatePlayers(database.competitions);

  databaseCache = database;
  playersCache = players;
  cacheExpiry = Date.now() + CACHE_DURATION;

  return { database, players };
}


// --------------------------------------------------
// HELPERS
// --------------------------------------------------

const numberFormat = new Intl.NumberFormat("en-US");

function number(value) {
  return numberFormat.format(value ?? 0);
}

function decimal(value, places = 1) {
  return Number.isFinite(value)
    ? value.toFixed(places)
    : "—";
}

function accuracy(value) {
  return Number.isFinite(value)
    ? `${value.toFixed(2)}%`
    : "—";
}

function cleanName(value) {
  return escapeMarkdown(String(value || "Unknown"));
}

function playerLink(player) {
  return `${WEBSITE}/player.html?id=${encodeURIComponent(player.racerId)}`;
}

function makeEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(0xC5A15B)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: "KPLAYOFFS · Klavia Playoff Statistics" });
}

const statisticNames = {
  totalRaces: "Total races",
  avgWpm: "Average WPM",
  avgAccuracy: "Average accuracy",
  duelsPlayed: "Duels played",
  seasonsPlayed: "Seasons played",
  avgRacesPerDuel: "Average races per duel",
  avgRacesPerSeason: "Average races per season"
};

function findPlayer(players, query) {
  const value = String(query).trim().toLowerCase();

  // Exact racer ID.
  let matches = players.filter(
    player => String(player.racerId) === value
  );

  if (matches.length) return matches;

  // Exact username.
  matches = players.filter(
    player => player.userName.toLowerCase() === value
  );

  if (matches.length) return matches;

  // Exact display name.
  matches = players.filter(
    player => player.displayName.toLowerCase() === value
  );

  if (matches.length) return matches;

  // Partial name matches.
  return players.filter(player =>
    player.displayName.toLowerCase().includes(value) ||
    player.userName.toLowerCase().includes(value)
  );
}

function playerChoiceName(player) {
  const name = player.displayName || player.userName;

  return `${name} (@${player.userName}) · ID ${player.racerId}`
    .slice(0, 100);
}


// --------------------------------------------------
// AUTOCOMPLETE
// --------------------------------------------------

async function handleAutocomplete(interaction) {
  try {
    const { players } = await loadData();

    const focused = interaction.options.getFocused(true);
    const query = String(focused.value || "").toLowerCase();

    let matches;

    if (!query) {
      matches = sortPlayers(
        players,
        "totalRaces",
        "desc"
      ).slice(0, 25);
    } else {
      matches = players.filter(player => {
        return (
          String(player.racerId).includes(query) ||
          player.displayName.toLowerCase().includes(query) ||
          player.userName.toLowerCase().includes(query)
        );
      }).slice(0, 25);
    }

    await interaction.respond(
      matches.map(player => ({
        name: playerChoiceName(player),
        value: String(player.racerId)
      }))
    );

  } catch (error) {
    console.error("Autocomplete error:", error);

    await interaction.respond([]);
  }
}


// --------------------------------------------------
// /PLAYER
// --------------------------------------------------

async function commandPlayer(interaction, players) {
  const query = interaction.options.getString("player");

  const matches = findPlayer(players, query);

  if (matches.length === 0) {
    await interaction.editReply(
      `No player found matching **${cleanName(query)}**.`
    );
    return;
  }

  if (matches.length > 1) {
    await interaction.editReply(
      "Multiple players matched that name. Please select one using autocomplete."
    );
    return;
  }

  const player = matches[0];

  const embed = makeEmbed(
    player.displayName || player.userName,
    [
      `**Username:** @${cleanName(player.userName)}`,
      `**Racer ID:** ${player.racerId}`,
      `**Teams:** ${player.teams.map(cleanName).join(", ") || "None"}`,
      "",
      `[View full player profile](${playerLink(player)})`
    ].join("\n")
  );

  embed.addFields(
    {
      name: "Total races",
      value: number(player.totalRaces),
      inline: true
    },
    {
      name: "Average WPM",
      value: decimal(player.avgWpm),
      inline: true
    },
    {
      name: "Accuracy",
      value: accuracy(player.avgAccuracy),
      inline: true
    },
    {
      name: "Duels",
      value: number(player.duelsPlayed),
      inline: true
    },
    {
      name: "Seasons",
      value: number(player.seasonsPlayed),
      inline: true
    },
    {
      name: "Races / duel",
      value: decimal(player.avgRacesPerDuel),
      inline: true
    },
    {
      name: "Races / season",
      value: decimal(player.avgRacesPerSeason),
      inline: true
    }
  );

  await interaction.editReply({ embeds: [embed] });
}


// --------------------------------------------------
// /LEADERBOARD
// --------------------------------------------------


const LEADERBOARD_PAGE_SIZE = 10;


// Format an individual leaderboard page.
function buildLeaderboardEmbed(sorted, stat, page, totalPages) {
  const start = page * LEADERBOARD_PAGE_SIZE;

  const pagePlayers = sorted.slice(
    start,
    start + LEADERBOARD_PAGE_SIZE
  );

  const lines = pagePlayers.map((player, index) => {
    const value = player[stat];

    let formatted;

    if (stat === "avgAccuracy") {
      formatted = accuracy(value);
    } else if (
      stat === "avgWpm" ||
      stat === "avgRacesPerDuel" ||
      stat === "avgRacesPerSeason"
    ) {
      formatted = decimal(value);
    } else {
      formatted = number(value);
    }

    return (
      `**${start + index + 1}.** ` +
      `${cleanName(player.displayName)} — **${formatted}**`
    );
  });

  const embed = makeEmbed(
    `All Time Playoff Leaderboard · ${statisticNames[stat]}`,
    lines.join("\n") || "No players found."
  );

  embed.setFooter({
    text:
      `KPLAYOFFS · ${number(sorted.length)} players · ` +
      `Page ${page + 1}/${totalPages}`
  });

  return embed;
}


// Create the Previous and Next buttons.
function buildLeaderboardButtons(page, totalPages, disableAll = false) {
  const previousButton = new ButtonBuilder()
    .setCustomId("leaderboard_previous")
    .setLabel("Previous")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disableAll || page === 0);

  const nextButton = new ButtonBuilder()
    .setCustomId("leaderboard_next")
    .setLabel("Next")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disableAll || page >= totalPages - 1);

  return [
    new ActionRowBuilder().addComponents(
      previousButton,
      nextButton
    )
  ];
}


// /LEADERBOARD
async function commandLeaderboard(interaction, players) {
  const stat = interaction.options.getString("stat");

  // Passing null means we want ALL players, not just the top 100.
  const sorted = sortPlayers(players, stat, "desc", null);

  const totalPages = Math.max(
    1,
    Math.ceil(sorted.length / LEADERBOARD_PAGE_SIZE)
  );

  let currentPage = 0;

  // Send the first page.
  const message = await interaction.editReply({
    embeds: [
      buildLeaderboardEmbed(
        sorted,
        stat,
        currentPage,
        totalPages
      )
    ],
    components: buildLeaderboardButtons(
      currentPage,
      totalPages
    )
  });

  // Listen for button clicks on this particular leaderboard.
  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 5 * 60 * 1000
  });

  collector.on("collect", async buttonInteraction => {

    // Only the person who ran the command can turn pages.
    if (buttonInteraction.user.id !== interaction.user.id) {
      await buttonInteraction.reply({
        content: "Only the person who requested this leaderboard can use these buttons.",
        ephemeral: true
      });

      return;
    }

    if (buttonInteraction.customId === "leaderboard_previous") {
      currentPage = Math.max(0, currentPage - 1);
    }

    if (buttonInteraction.customId === "leaderboard_next") {
      currentPage = Math.min(
        totalPages - 1,
        currentPage + 1
      );
    }

    // Update the existing message rather than sending a new one.
    await buttonInteraction.update({
      embeds: [
        buildLeaderboardEmbed(
          sorted,
          stat,
          currentPage,
          totalPages
        )
      ],
      components: buildLeaderboardButtons(
        currentPage,
        totalPages
      )
    });
  });

  // Disable buttons after five minutes.
  collector.on("end", () => {
    message.edit({
      components: buildLeaderboardButtons(
        currentPage,
        totalPages,
        true
      )
    }).catch(console.error);
  });
}


// --------------------------------------------------
// /DUEL
// --------------------------------------------------

async function commandDuel(interaction, database) {
  const id = interaction.options.getInteger("id");

  const sortBy =
    interaction.options.getString("sort") || "races";

  const competition = database.competitions.find(
    item => Number(item.id) === id
  );

  if (!competition) {
    await interaction.editReply(
      `Competition **${id}** wasn't found in the KPLAYOFFS database.`
    );
    return;
  }

  const racers = (competition.racers || [])
    .filter(racer => Number(racer.races) > 0)
    .sort((a, b) => {
      const difference =
        (Number(b[sortBy]) || 0) -
        (Number(a[sortBy]) || 0);

      return difference ||
        String(a.userName).localeCompare(String(b.userName));
    });

  const top = racers.slice(0, 10);

  const lines = top.map((racer, index) =>
    [
      `**${index + 1}.** ${cleanName(racer.displayName || racer.userName)}`,
      `${number(Number(racer.races) || 0)} races`,
      `${decimal(Number(racer.wpm))} WPM`,
      `${accuracy(Number(racer.accuracy))}`
    ].join(" · ")
  );

  const embed = makeEmbed(
    `${competition.season} · Duel ${id}`,
    lines.join("\n") || "No racers found."
  );

  embed.setURL(`https://klavia.io/comps/${id}`);

  embed.setFooter({
    text: `KPLAYOFFS · ${number(racers.length)} participants · Top 10`
  });

  await interaction.editReply({ embeds: [embed] });
}


// --------------------------------------------------
// /SEASON
// --------------------------------------------------

async function commandSeason(interaction, database) {
  const season = interaction.options.getString("name");

  const stat =
    interaction.options.getString("stat") || "totalRaces";

  const competitions = database.competitions.filter(
    competition => competition.season === season
  );

  if (competitions.length === 0) {
    await interaction.editReply(
      `No competitions were found for **${season}**.`
    );
    return;
  }

  const players = aggregatePlayers(competitions);

  const top = sortPlayers(
    players,
    stat,
    "desc"
  ).slice(0, 10);

  const lines = top.map(player => {
    const value = player[stat];

    let formatted;

    if (stat === "avgAccuracy") {
      formatted = accuracy(value);
    } else if (
      stat === "avgWpm" ||
      stat === "avgRacesPerDuel" ||
      stat === "avgRacesPerSeason"
    ) {
      formatted = decimal(value);
    } else {
      formatted = number(value);
    }

    return (
      `**${player.rank}.** ${cleanName(player.displayName)} ` +
      `— **${formatted}**`
    );
  });

  const embed = makeEmbed(
    `${season} Leaderboard`,
    lines.join("\n")
  );

  embed.setFooter({
    text: `KPLAYOFFS · ${competitions.length} duels · ${players.length} players`
  });

  await interaction.editReply({ embeds: [embed] });
}




// --------------------------------------------------
// /COMPARE
// --------------------------------------------------

async function commandCompare(interaction, players) {
  const query1 = interaction.options.getString("player1");
  const query2 = interaction.options.getString("player2");

  const matches1 = findPlayer(players, query1);
  const matches2 = findPlayer(players, query2);

  if (matches1.length !== 1 || matches2.length !== 1) {
    await interaction.editReply(
      "One or both players couldn't be identified. Please select both players using autocomplete."
    );
    return;
  }

  const first = matches1[0];
  const second = matches2[0];

  if (first.racerId === second.racerId) {
    await interaction.editReply(
      "Please select two different players."
    );
    return;
  }

  const embed = makeEmbed(
    "KPLAYOFFS · Player Comparison",
    `[${cleanName(first.displayName)}](${playerLink(first)})` +
    " vs " +
    `[${cleanName(second.displayName)}](${playerLink(second)})`
  );

  embed.addFields(
    {
      name: cleanName(first.displayName),
      value: [
        `**Races:** ${number(first.totalRaces)}`,
        `**WPM:** ${decimal(first.avgWpm)}`,
        `**Accuracy:** ${accuracy(first.avgAccuracy)}`,
        `**Duels:** ${number(first.duelsPlayed)}`,
        `**Seasons:** ${number(first.seasonsPlayed)}`,
        `**Teams:** ${first.teams.map(cleanName).join(", ") || "None"}`
      ].join("\n"),
      inline: true
    },
    {
      name: cleanName(second.displayName),
      value: [
        `**Races:** ${number(second.totalRaces)}`,
        `**WPM:** ${decimal(second.avgWpm)}`,
        `**Accuracy:** ${accuracy(second.avgAccuracy)}`,
        `**Duels:** ${number(second.duelsPlayed)}`,
        `**Seasons:** ${number(second.seasonsPlayed)}`,
        `**Teams:** ${second.teams.map(cleanName).join(", ") || "None"}`
      ].join("\n"),
      inline: true
    }
  );

  await interaction.editReply({ embeds: [embed] });
}


// --------------------------------------------------
// INTERACTION HANDLER
// --------------------------------------------------

client.on(Events.InteractionCreate, async interaction => {

  if (interaction.isAutocomplete()) {
    await handleAutocomplete(interaction);
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  try {
    // Acknowledge immediately so Discord does not time out.
    await interaction.deferReply();

    const { database, players } = await loadData();

    switch (interaction.commandName) {

      case "player":
        await commandPlayer(interaction, players);
        break;

      case "leaderboard":
        await commandLeaderboard(interaction, players);
        break;

      case "duel":
        await commandDuel(interaction, database);
        break;

      case "season":
        await commandSeason(interaction, database);
        break;

      case "compare":
        await commandCompare(interaction, players);
        break;

      default:
        await interaction.editReply("Unknown command.");
    }

  } catch (error) {
    console.error(
      `Command ${interaction.commandName} failed:`,
      error
    );

    const message =
      "Something went wrong while retrieving KPLAYOFFS statistics.";

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(message).catch(console.error);
    }
  }
});


// --------------------------------------------------
// START THE BOT
// --------------------------------------------------

client.once(Events.ClientReady, readyClient => {
  console.log(`KPLAYOFFS bot online as ${readyClient.user.tag}`);

  // Warm the database cache in the background.
  loadData()
    .then(({ players }) => {
      console.log(`Loaded ${players.length} playoff players.`);
    })
    .catch(error => {
      console.error("Initial data loading failed:", error.message);
    });
});

client.login(TOKEN);
