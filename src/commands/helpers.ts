import { readFileSync } from "node:fs";
import { Command } from "commander";
import { MetabaseClient } from "../client.js";
import { getActiveProfile, getProfile } from "../config/store.js";

/**
 * Resolve the target profile, checking for a global --profile flag
 * via the METABASE_PROFILE env var (set by the root command hook).
 */
function resolveProfile() {
  const profileName = process.env._METABASE_CLI_PROFILE;
  if (profileName) {
    const profile = getProfile(profileName);
    if (!profile) {
      console.error(`Error: Profile "${profileName}" does not exist.`);
      process.exit(1);
    }
    return profile;
  }
  return getActiveProfile();
}

export async function resolveClient(): Promise<MetabaseClient> {
  const profile = resolveProfile();
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
  const profile = resolveProfile();
  if (profile?.defaultDb) return profile.defaultDb;
  console.error(
    "Error: --db is required (or set a default with: metabase-cli profile set-default-db <id>)",
  );
  process.exit(1);
}

/**
 * Resolve input from either an inline value or a file path.
 * Errors if both or neither are provided.
 */
export function resolveInput(
  inline: string | undefined,
  filePath: string | undefined,
  inlineFlag: string,
  fileFlag: string,
): string {
  if (inline && filePath) {
    console.error(`Error: --${inlineFlag} and --${fileFlag} are mutually exclusive.`);
    process.exit(1);
  }
  if (!inline && !filePath) {
    console.error(`Error: either --${inlineFlag} or --${fileFlag} is required.`);
    process.exit(1);
  }
  if (filePath) {
    return readFileSync(filePath, "utf-8").trim();
  }
  return inline!;
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
