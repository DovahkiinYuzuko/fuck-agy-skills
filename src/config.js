import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { parse, stringify } from 'smol-toml';

export const DEFAULT_CONFIG = {
  source: '~/.agents/skills',
  target: '~/.gemini/config/skills',
  exclude: [],
  clean_deleted: false,
  replace_links: true,
};

export const DEFAULT_CONFIG_TEMPLATE = `# fuck-agy-skills configuration file

# Source directory containing agent skills (common agent specification)
source = "~/.agents/skills"

# Target directory where Google Antigravity looks for global skills
target = "~/.gemini/config/skills"

# Skill names to exclude from synchronization
exclude = [
  # "some-special-skill",
]

# Whether to delete skills in target that were previously synced but removed from source
clean_deleted = false

# Automatically replace existing junction/symlink with physical folder
replace_links = true
`;

/**
 * Expands leading tilde (~) to user's home directory.
 * @param {string} filePath
 * @returns {string}
 */
export function expandHomePath(filePath) {
  if (typeof filePath !== 'string') {
    return filePath;
  }
  if (filePath === '~' || filePath.startsWith('~/') || filePath.startsWith('~\\')) {
    const relativePart = filePath.slice(1).replace(/^[/\\]/, '');
    return path.resolve(os.homedir(), relativePart);
  }
  return path.resolve(filePath);
}

/**
 * Returns the package's root config.toml path.
 * @returns {string}
 */
function getPackageConfigPath() {
  const pkgDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
  return path.resolve(pkgDir, '../config.toml');
}

/**
 * Finds the config.toml file using priority lookup.
 * @param {string | null} [customPath=null]
 * @returns {Promise<string | null>}
 */
export async function findConfigFile(customPath = null) {
  if (customPath) {
    const resolvedCustom = expandHomePath(customPath);
    try {
      const stat = await fs.stat(resolvedCustom);
      if (stat.isFile()) {
        return resolvedCustom;
      }
    } catch {}
    return null;
  }

  // Package / install root directory
  try {
    const packageConfig = getPackageConfigPath();
    const stat = await fs.stat(packageConfig);
    if (stat.isFile()) {
      return packageConfig;
    }
  } catch {}

  return null;
}

/**
 * Creates a default config file with English comments at the specified path.
 * @param {string} targetFilePath
 * @returns {Promise<string>}
 */
export async function createDefaultConfigFile(targetFilePath) {
  const resolvedPath = expandHomePath(targetFilePath);
  const dir = path.dirname(resolvedPath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(resolvedPath, DEFAULT_CONFIG_TEMPLATE, 'utf-8');
  return resolvedPath;
}

/**
 * Ensures a config file exists. If none found, creates config.toml in the package directory.
 * @param {string | null} [customPath=null]
 * @returns {Promise<{ filePath: string, created: boolean }>}
 */
export async function ensureConfigFile(customPath = null) {
  let existing = await findConfigFile(customPath);
  if (existing) {
    return { filePath: existing, created: false };
  }

  const createTarget = customPath ? expandHomePath(customPath) : getPackageConfigPath();
  await createDefaultConfigFile(createTarget);
  return { filePath: createTarget, created: true };
}

/**
 * Loads and parses config.toml, ensuring defaults and expanding paths.
 * @param {string | null} [customPath=null]
 * @returns {Promise<{ config: typeof DEFAULT_CONFIG, filePath: string }>}
 */
export async function loadConfig(customPath = null) {
  const { filePath } = await ensureConfigFile(customPath);
  let parsed = {};

  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    parsed = parse(raw);
  } catch (err) {
    console.warn(`[WARN] Failed to parse config file at ${filePath}: ${err.message}. Using defaults.`);
  }

  const merged = {
    source: expandHomePath(parsed.source ?? DEFAULT_CONFIG.source),
    target: expandHomePath(parsed.target ?? DEFAULT_CONFIG.target),
    exclude: Array.isArray(parsed.exclude) ? parsed.exclude : DEFAULT_CONFIG.exclude,
    clean_deleted: typeof parsed.clean_deleted === 'boolean' ? parsed.clean_deleted : DEFAULT_CONFIG.clean_deleted,
    replace_links: typeof parsed.replace_links === 'boolean' ? parsed.replace_links : DEFAULT_CONFIG.replace_links,
  };

  return { config: merged, filePath };
}

/**
 * Saves a specific configuration key/value to the config file.
 * @param {string} filePath
 * @param {string} key
 * @param {string} rawValue
 * @returns {Promise<object>}
 */
export async function saveConfigValue(filePath, key, rawValue) {
  const resolvedPath = expandHomePath(filePath);
  let parsed = {};
  try {
    const raw = await fs.readFile(resolvedPath, 'utf-8');
    parsed = parse(raw);
  } catch {}

  let valueToSet = rawValue;
  if (rawValue === 'true') valueToSet = true;
  else if (rawValue === 'false') valueToSet = false;
  else if (!isNaN(Number(rawValue)) && rawValue.trim() !== '') valueToSet = Number(rawValue);
  else if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
    try {
      valueToSet = JSON.parse(rawValue);
    } catch {
      valueToSet = rawValue
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
    }
  }

  parsed[key] = valueToSet;
  const newToml = stringify(parsed);
  await fs.writeFile(resolvedPath, newToml, 'utf-8');
  return parsed;
}

/**
 * Merges runtime CLI overrides into the loaded configuration.
 * @param {typeof DEFAULT_CONFIG} config
 * @param {object} cliOptions
 * @returns {typeof DEFAULT_CONFIG}
 */
export function mergeCliOverrides(config, cliOptions = {}) {
  const overridden = { ...config };

  if (cliOptions.source) {
    overridden.source = expandHomePath(cliOptions.source);
  }
  if (cliOptions.target) {
    overridden.target = expandHomePath(cliOptions.target);
  }
  if (typeof cliOptions.clean === 'boolean') {
    overridden.clean_deleted = cliOptions.clean;
  }
  if (Array.isArray(cliOptions.exclude)) {
    overridden.exclude = cliOptions.exclude;
  }

  return overridden;
}
