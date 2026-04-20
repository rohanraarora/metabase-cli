import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Command } from "commander";
import { profileCommand } from "../src/commands/profile.js";
import { queryCommand } from "../src/commands/query.js";
import { questionCommand } from "../src/commands/question.js";
import { dashboardCommand } from "../src/commands/dashboard.js";
import { collectionCommand } from "../src/commands/collection.js";
import { databaseCommand, tableCommand, fieldCommand } from "../src/commands/database.js";
import { searchCommand } from "../src/commands/search.js";
import { snippetCommand } from "../src/commands/snippet.js";
import { alertCommand } from "../src/commands/alert.js";
import { revisionCommand } from "../src/commands/revision.js";
import { activityCommand } from "../src/commands/activity.js";
import { timelineCommand } from "../src/commands/timeline.js";
import { segmentCommand } from "../src/commands/segment.js";
import { notificationCommand } from "../src/commands/notification.js";
import { doctorCommand } from "../src/commands/doctor.js";
import { MetabaseClient } from "../src/client.js";
import { updateProfile } from "../src/config/store.js";
import { resolveProfile as resolveProfileBase } from "../src/commands/helpers.js";
import type { Profile } from "../src/types.js";
import { handleError } from "../src/utils/errors.js";
import { formatJson } from "../src/utils/output.js";

const pkg = JSON.parse(readFileSync(resolve(__dirname, "..", "package.json"), "utf-8"));

const program = new Command();

program
  .name("metabase-cli")
  .description("Headless CLI for Metabase instances")
  .version(pkg.version)
  .option("--unsafe", "Bypass safe mode globally")
  .option("--profile <name>", "Use a specific profile for this command")
  .option("--verbose", "Print full error response bodies (also: METABASE_CLI_VERBOSE=1)")
  .hook("preAction", (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.profile) {
      process.env._METABASE_CLI_PROFILE = opts.profile;
    }
    if (opts.verbose) {
      process.env.METABASE_CLI_VERBOSE = "1";
    }
  });

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
program.addCommand(alertCommand());
program.addCommand(revisionCommand());
program.addCommand(activityCommand());
program.addCommand(timelineCommand());
program.addCommand(segmentCommand());
program.addCommand(notificationCommand());
program.addCommand(doctorCommand());

function resolveProfile(): Profile {
  const p = resolveProfileBase();
  if (!p) {
    console.error("No active profile. Run: metabase-cli profile add <name>");
    process.exit(1);
  }
  return p;
}

// Login command
program
  .command("login")
  .description("Login to the active profile")
  .addHelpText(
    "after",
    `
Examples:
  $ metabase-cli login`,
  )
  .action(async () => {
    const profile = resolveProfile();
    if (profile.auth.method !== "session") {
      console.log("Profile uses API key auth — no login needed.");
      return;
    }
    const client = new MetabaseClient(profile);
    await client.login();
    console.log(`Logged in to ${profile.domain} as ${profile.auth.email}.`);
    if (client.getProfile().user) {
      console.log(
        `User: ${client.getProfile().user!.first_name} ${client.getProfile().user!.last_name} (ID: ${client.getProfile().user!.id})`,
      );
    }
  });

// Logout command
program
  .command("logout")
  .description("Logout from the active profile")
  .addHelpText(
    "after",
    `
Examples:
  $ metabase-cli logout`,
  )
  .action(async () => {
    const profile = resolveProfile();
    const client = new MetabaseClient(profile);
    await client.logout();
    console.log("Logged out.");
  });

// Whoami command
program
  .command("whoami")
  .description("Show current user info")
  .option("--refresh", "Refresh cached user info from server")
  .addHelpText(
    "after",
    `
Examples:
  $ metabase-cli whoami
  $ metabase-cli whoami --refresh`,
  )
  .action(async (opts) => {
    const profile = resolveProfile();

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
    if (profile.name !== "__env__") {
      updateProfile(profile.name, {
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          is_superuser: user.is_superuser,
        },
      });
    }
    console.log(formatJson(user));
  });

program.parseAsync(process.argv).catch(handleError);
