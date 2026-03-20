import { Command } from "commander";
import { profileCommand } from "../src/commands/profile.js";
import { queryCommand } from "../src/commands/query.js";
import { questionCommand } from "../src/commands/question.js";
import { dashboardCommand } from "../src/commands/dashboard.js";
import { collectionCommand } from "../src/commands/collection.js";
import { databaseCommand, tableCommand, fieldCommand } from "../src/commands/database.js";
import { searchCommand } from "../src/commands/search.js";
import { snippetCommand } from "../src/commands/snippet.js";
import { MetabaseClient } from "../src/client.js";
import { getActiveProfile, updateProfile } from "../src/config/store.js";
import { handleError } from "../src/utils/errors.js";
import { formatJson } from "../src/utils/output.js";

const program = new Command();

program
  .name("metabase-cli")
  .description("Headless CLI for Metabase instances")
  .version("0.1.2")
  .option("--unsafe", "Bypass safe mode globally");

// Top-level commands
program.addCommand(profileCommand());
program.addCommand(queryCommand());
program.addCommand(questionCommand());
program.addCommand(dashboardCommand());
program.addCommand(collectionCommand());
program.addCommand(databaseCommand());
program.addCommand(tableCommand());
program.addCommand(fieldCommand());
program.addCommand(searchCommand());
program.addCommand(snippetCommand());

// Login command
program
  .command("login")
  .description("Login to the active profile")
  .addHelpText("after", `
Examples:
  $ metabase-cli login`)
  .action(async () => {
    const profile = getActiveProfile();
    if (!profile) {
      console.error("No active profile. Run: metabase-cli profile add <name>");
      process.exit(1);
    }
    if (profile.auth.method !== "session") {
      console.log("Profile uses API key auth — no login needed.");
      return;
    }
    const client = new MetabaseClient(profile);
    await client.login();
    console.log(`Logged in to ${profile.domain} as ${profile.auth.email}.`);
    if (client.getProfile().user) {
      console.log(`User: ${client.getProfile().user!.first_name} ${client.getProfile().user!.last_name} (ID: ${client.getProfile().user!.id})`);
    }
  });

// Logout command
program
  .command("logout")
  .description("Logout from the active profile")
  .addHelpText("after", `
Examples:
  $ metabase-cli logout`)
  .action(async () => {
    const profile = getActiveProfile();
    if (!profile) {
      console.error("No active profile.");
      process.exit(1);
    }
    const client = new MetabaseClient(profile);
    await client.logout();
    console.log("Logged out.");
  });

// Whoami command
program
  .command("whoami")
  .description("Show current user info")
  .option("--refresh", "Refresh cached user info from server")
  .addHelpText("after", `
Examples:
  $ metabase-cli whoami
  $ metabase-cli whoami --refresh`)
  .action(async (opts) => {
    const profile = getActiveProfile();
    if (!profile) {
      console.error("No active profile.");
      process.exit(1);
    }

    if (!opts.refresh && profile.user) {
      console.log(`${profile.user.first_name} ${profile.user.last_name}`);
      console.log(`Email:      ${profile.user.email}`);
      console.log(`User ID:    ${profile.user.id}`);
      console.log(`Superuser:  ${profile.user.is_superuser}`);
      console.log(`Profile:    ${profile.name}`);
      console.log(`Domain:     ${profile.domain}`);
      return;
    }

    const client = new MetabaseClient(profile);
    await client.ensureAuthenticated();
    const user = await client.get<any>("/api/user/current");
    updateProfile(profile.name, {
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        is_superuser: user.is_superuser,
      },
    });
    console.log(formatJson(user));
  });

program.parseAsync(process.argv).catch(handleError);
