import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { Config, Profile } from "../types.js";

function getConfigDir(): string {
  return path.join(os.homedir(), ".metabase-cli");
}

function getConfigFile(): string {
  return path.join(getConfigDir(), "config.json");
}

function ensureConfigDir(): void {
  if (!fs.existsSync(getConfigDir())) {
    fs.mkdirSync(getConfigDir(), { recursive: true, mode: 0o700 });
  }
}

function defaultConfig(): Config {
  return { activeProfile: "", profiles: {} };
}

export function loadConfig(): Config {
  ensureConfigDir();
  if (!fs.existsSync(getConfigFile())) {
    return defaultConfig();
  }
  const raw = fs.readFileSync(getConfigFile(), "utf-8");
  return JSON.parse(raw) as Config;
}

export function saveConfig(config: Config): void {
  ensureConfigDir();
  fs.writeFileSync(getConfigFile(), JSON.stringify(config, null, 2), {
    encoding: "utf-8",
    mode: 0o600,
  });
}

export function getActiveProfile(): Profile | null {
  const config = loadConfig();
  if (!config.activeProfile || !config.profiles[config.activeProfile]) {
    return null;
  }
  return config.profiles[config.activeProfile];
}

export function setActiveProfile(name: string): void {
  const config = loadConfig();
  if (!config.profiles[name]) {
    throw new Error(`Profile "${name}" does not exist`);
  }
  config.activeProfile = name;
  saveConfig(config);
}

export function addProfile(profile: Profile): void {
  const config = loadConfig();
  config.profiles[profile.name] = profile;
  if (!config.activeProfile) {
    config.activeProfile = profile.name;
  }
  saveConfig(config);
}

export function removeProfile(name: string): void {
  const config = loadConfig();
  if (!config.profiles[name]) {
    throw new Error(`Profile "${name}" does not exist`);
  }
  delete config.profiles[name];
  if (config.activeProfile === name) {
    const remaining = Object.keys(config.profiles);
    config.activeProfile = remaining.length > 0 ? remaining[0] : "";
  }
  saveConfig(config);
}

export function updateProfile(
  name: string,
  updates: Partial<Profile>,
): void {
  const config = loadConfig();
  if (!config.profiles[name]) {
    throw new Error(`Profile "${name}" does not exist`);
  }
  config.profiles[name] = { ...config.profiles[name], ...updates };
  saveConfig(config);
}

export function listProfiles(): { profiles: Profile[]; active: string } {
  const config = loadConfig();
  return {
    profiles: Object.values(config.profiles),
    active: config.activeProfile,
  };
}
