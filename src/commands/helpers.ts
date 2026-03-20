import { Command } from "commander";
import { MetabaseClient } from "../client.js";
import { getActiveProfile } from "../config/store.js";

export async function resolveClient(): Promise<MetabaseClient> {
  const profile = getActiveProfile();
  if (!profile) {
    console.error("No active profile. Run: metabase-cli profile add <name>");
    process.exit(1);
  }

  const client = new MetabaseClient(profile);
  await client.ensureAuthenticated();
  return client;
}

export function resolveDb(optDb: number | undefined): number {
  if (optDb !== undefined) return optDb;
  const profile = getActiveProfile();
  if (profile?.defaultDb) return profile.defaultDb;
  console.error("Error: --db is required (or set a default with: metabase-cli profile set-default-db <id>)");
  process.exit(1);
}

export function isUnsafe(cmd: Command, localFlag?: boolean): boolean {
  if (localFlag) return true;
  if (process.env.METABASE_UNSAFE === "1") return true;
  // Walk up to root command to check global --unsafe
  let current: Command | null = cmd;
  while (current) {
    if (current.opts().unsafe) return true;
    current = current.parent;
  }
  return false;
}
