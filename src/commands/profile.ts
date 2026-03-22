import { Command } from "commander";
import {
  addProfile,
  removeProfile,
  setActiveProfile,
  listProfiles,
  getActiveProfile,
  updateProfile,
} from "../config/store.js";
import type { Profile, SessionAuth, ApiKeyAuth } from "../types.js";
import { formatEntityTable } from "../utils/output.js";
import { MetabaseClient } from "../client.js";

export function profileCommand(): Command {
  const cmd = new Command("profile").description("Manage Metabase profiles").addHelpText(
    "after",
    `
The first profile added becomes the default (active) profile.
All commands use the active profile unless you switch with 'profile switch'.

Examples:
  $ metabase-cli profile add prod --domain https://metabase.example.com --email you@co.com --password secret
  $ metabase-cli profile add staging --domain https://staging.metabase.co --api-key mb_xxxxx
  $ metabase-cli profile list
  $ metabase-cli profile switch staging
  $ metabase-cli profile current
  $ metabase-cli profile remove staging`,
  );

  cmd
    .command("add <name>")
    .description("Add a new profile (becomes default if first)")
    .requiredOption("--domain <url>", "Metabase instance URL")
    .option("--email <email>", "Login email")
    .option("--password <password>", "Login password")
    .option("--api-key <key>", "API key (alternative to email/password)")
    .option("--default-db <id>", "Default database ID for queries", parseInt)
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli profile add prod --domain https://metabase.example.com --email you@co.com --password secret
  $ metabase-cli profile add prod --domain https://metabase.example.com --email you@co.com --password secret --default-db 1
  $ metabase-cli profile add staging --domain https://staging.example.com --api-key mb_xxxxx`,
    )
    .action(async (name: string, opts) => {
      let auth: SessionAuth | ApiKeyAuth;

      if (opts.apiKey) {
        auth = { method: "api-key", apiKey: opts.apiKey };
      } else if (opts.email && opts.password) {
        auth = { method: "session", email: opts.email, password: opts.password };
      } else {
        console.error("Error: Provide --email and --password, or --api-key");
        process.exit(1);
      }

      const profile: Profile = {
        name,
        domain: opts.domain,
        auth,
        defaultDb: opts.defaultDb,
      };

      addProfile(profile);
      console.log(`Profile "${name}" added.`);

      if (auth.method === "session") {
        try {
          const client = new MetabaseClient(profile);
          await client.login();
          console.log(`Logged in to ${profile.domain} as ${auth.email}.`);
          if (client.getProfile().user) {
            const u = client.getProfile().user!;
            console.log(`User: ${u.first_name} ${u.last_name} (ID: ${u.id})`);
          }
        } catch (err: any) {
          console.warn(`Warning: Profile saved but login failed — ${err.message}`);
          console.warn(`You can retry with: metabase-cli login`);
        }
      }
    });

  cmd
    .command("list")
    .description("List all profiles (* = active/default)")
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli profile list`,
    )
    .action(() => {
      const { profiles, active } = listProfiles();
      if (profiles.length === 0) {
        console.log("No profiles configured. Run: metabase-cli profile add <name>");
        return;
      }
      const items = profiles.map((p) => ({
        active: p.name === active ? "*" : "",
        name: p.name,
        domain: p.domain,
        auth: p.auth.method,
        user: p.user
          ? `${p.user.first_name} ${p.user.last_name} (${p.user.email})`
          : "not logged in",
      }));
      console.log(
        formatEntityTable(items, [
          { key: "active", header: "" },
          { key: "name", header: "Name" },
          { key: "domain", header: "Domain" },
          { key: "auth", header: "Auth" },
          { key: "user", header: "User" },
        ]),
      );
    });

  cmd
    .command("switch <name>")
    .description("Switch active (default) profile")
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli profile switch staging`,
    )
    .action((name: string) => {
      setActiveProfile(name);
      console.log(`Switched to profile "${name}".`);
    });

  cmd
    .command("remove <name>")
    .description("Remove a profile")
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli profile remove staging`,
    )
    .action((name: string) => {
      removeProfile(name);
      console.log(`Profile "${name}" removed.`);
    });

  cmd
    .command("current")
    .description("Show current active (default) profile")
    .addHelpText(
      "after",
      `
Examples:
  $ metabase-cli profile current`,
    )
    .action(() => {
      const profile = getActiveProfile();
      if (!profile) {
        console.log("No active profile. Run: metabase-cli profile add <name>");
        return;
      }
      console.log(`Profile: ${profile.name}`);
      console.log(`Domain:  ${profile.domain}`);
      console.log(`Auth:    ${profile.auth.method}`);
      if (profile.user) {
        console.log(
          `User:    ${profile.user.first_name} ${profile.user.last_name} (${profile.user.email})`,
        );
      }
      if (profile.defaultDb) {
        console.log(`Default DB: ${profile.defaultDb}`);
      }
    });

  cmd
    .command("set-default-db <id>")
    .description("Set the default database ID for the active profile")
    .addHelpText(
      "after",
      `
The default database is used when --db is not specified in query/question commands.

Examples:
  $ metabase-cli profile set-default-db 1
  $ metabase-cli profile set-default-db 3`,
    )
    .action((id: string) => {
      const profile = getActiveProfile();
      if (!profile) {
        console.error("No active profile. Run: metabase-cli profile add <name>");
        process.exit(1);
      }
      updateProfile(profile.name, { defaultDb: parseInt(id) });
      console.log(`Default database set to #${id} for profile "${profile.name}".`);
    });

  return cmd;
}
