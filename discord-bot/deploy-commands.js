
import "dotenv/config";

import {
  REST,
  Routes
} from "discord.js";

import { commands } from "./commands.js";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_DEV_GUILD_ID;

if (!token || !clientId) {
  throw new Error(
    "DISCORD_TOKEN or DISCORD_CLIENT_ID is missing from .env"
  );
}

const scope = process.argv[2] || "guild";

const rest = new REST({ version: "10" }).setToken(token);

const commandData = commands.map(command => command.toJSON());

async function deploy() {
  let route;

  if (scope === "guild") {
    if (!guildId) {
      throw new Error(
        "DISCORD_DEV_GUILD_ID is missing from .env"
      );
    }

    route = Routes.applicationGuildCommands(
      clientId,
      guildId
    );

    console.log("Registering commands in your test server...");

  } else if (scope === "global") {
    route = Routes.applicationCommands(clientId);

    console.log("Registering global KPLAYOFFS commands...");

  } else {
    throw new Error("Use either guild or global.");
  }

  await rest.put(route, {
    body: commandData
  });

  console.log(
    `Successfully registered ${commandData.length} commands.`
  );
}

deploy().catch(error => {
  console.error("Command registration failed:", error);
  process.exitCode = 1;
});
