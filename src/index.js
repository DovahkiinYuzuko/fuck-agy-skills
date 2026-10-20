#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import process from 'node:process';
import {
  loadConfig,
  ensureConfigFile,
  saveConfigValue,
  createDefaultConfigFile,
  mergeCliOverrides,
} from './config.js';
import { runSync } from './synchronizer.js';

// ANSI color escape sequences
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

/**
 * Checks if the process should be respawned with Bun.
 * @returns {boolean}
 */
export function shouldRespawnWithBun() {
  if (process.versions.bun) {
    return false;
  }
  if (process.env.__FUCK_AGY_NO_BUN === '1') {
    return false;
  }

  const isWin = process.platform === 'win32';
  try {
    const probe = isWin
      ? spawnSync('cmd.exe', ['/c', 'bun', '--version'], { stdio: 'ignore' })
      : spawnSync('bun', ['--version'], { stdio: 'ignore' });
    return probe.status === 0;
  } catch {
    return false;
  }
}

/**
 * Respawns the current script with Bun runtime.
 */
export function respawnWithBun() {
  const env = { ...process.env, __FUCK_AGY_NO_BUN: '1' };
  const isWin = process.platform === 'win32';

  const bin = isWin ? 'cmd.exe' : 'bun';
  const spawnArgs = isWin
    ? ['/c', 'bun', process.argv[1], ...process.argv.slice(2)]
    : [process.argv[1], ...process.argv.slice(2)];

  const child = spawn(bin, spawnArgs, {
    stdio: 'inherit',
    env,
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
    } else {
      process.exit(code ?? 0);
    }
  });

  child.on('error', (err) => {
    console.warn(`${c.yellow}[WARN]${c.reset} Failed to spawn Bun runtime (${err.message}). Falling back to Node.js.`);
  });
}

/**
 * Prints comprehensive and helpful usage instructions.
 */
export function printHelp() {
  console.log(`
${c.bold}${c.cyan}fuck-agy-skills${c.reset} - Bridge Agent Skills (~/.agents/skills) to Google Antigravity (~/.gemini/config/skills)

${c.bold}Usage:${c.reset}
  fuck-agy-skills [options]
  fuck-agy-skills config <action> [key] [value]

${c.bold}Main Options (Synchronization):${c.reset}
  -c, --config <path>     Path to config.toml (defaults to package directory)
  -s, --source <path>     Override source directory for this run
  -t, --target <path>     Override target directory for this run
  -e, --exclude <list>    Comma-separated list of skill names to exclude
      --clean             Force clean skills removed from source (sync ledger safe)
      --no-clean          Disable clean_deleted for this run
  -d, --dry-run           Simulate actions without copying or deleting files
  -h, --help              Show this detailed help message
  -v, --version           Show CLI version

${c.bold}Configuration Management Subcommands:${c.reset}
  fuck-agy-skills config path
      Display the absolute path of the active config.toml.

  fuck-agy-skills config get [key]
      Display the current configuration value for [key], or all keys if omitted.
      Available keys: source, target, exclude, clean_deleted, replace_links.

  fuck-agy-skills config set <key> <value>
      Update and persist a setting in config.toml.
      Examples:
        fuck-agy-skills config set clean_deleted true
        fuck-agy-skills config set exclude '["skill-a", "skill-b"]'
        fuck-agy-skills config set source "C:/Users/.../skills"

  fuck-agy-skills config init [path]
      Initialize a new default config.toml with English documentation.
      Defaults to the package directory if path is not specified.

${c.bold}Safety & Architecture:${c.reset}
  - Sync Ledger: All synced skills are tracked in .fuck-agy-cache.json.
    Any native Antigravity skills existing in target are strictly protected
    and will NEVER be deleted by --clean.
  - Runtime: Automatically executes under Bun if available in system PATH,
    otherwise runs seamlessly on Node.js.
`);
}

/**
 * Handles 'config' subcommands.
 * @param {Array<string>} args
 * @param {string | null} customConfigPath
 * @returns {Promise<number>}
 */
export async function handleConfigSubcommand(args, customConfigPath = null) {
  const action = args[0];

  if (!action || action === 'help' || action === '-h' || action === '--help') {
    printHelp();
    return 0;
  }

  if (action === 'init') {
    const targetPath = args[1] ?? (customConfigPath || null);
    const createdPath = await createDefaultConfigFile(targetPath ?? (await ensureConfigFile()).filePath);
    console.log(`${c.green}[SUCCESS]${c.reset} Configuration initialized at: ${c.bold}${createdPath}${c.reset}`);
    return 0;
  }

  const { config, filePath } = await loadConfig(customConfigPath);

  if (action === 'path') {
    console.log(filePath);
    return 0;
  }

  if (action === 'get') {
    const key = args[1];
    if (key) {
      if (key in config) {
        console.log(typeof config[key] === 'object' ? JSON.stringify(config[key], null, 2) : config[key]);
      } else {
        console.error(`${c.red}[ERROR]${c.reset} Unknown configuration key: "${key}"`);
        return 1;
      }
    } else {
      console.log(JSON.stringify(config, null, 2));
    }
    return 0;
  }

  if (action === 'set') {
    const key = args[1];
    const rawValue = args[2];
    if (!key || rawValue === undefined) {
      console.error(`${c.red}[ERROR]${c.reset} Usage: fuck-agy-skills config set <key> <value>`);
      return 1;
    }
    const updated = await saveConfigValue(filePath, key, rawValue);
    console.log(`${c.green}[SUCCESS]${c.reset} Updated "${c.bold}${key}${c.reset}" in ${filePath}:`);
    console.log(`  ${key} = ${JSON.stringify(updated[key])}`);
    return 0;
  }

  console.error(`${c.red}[ERROR]${c.reset} Unknown config action: "${action}". Use "fuck-agy-skills --help" for guidance.`);
  return 1;
}

/**
 * Main CLI entry point.
 * @param {Array<string>} argv
 * @returns {Promise<number>}
 */
export async function main(argv = process.argv.slice(2)) {
  if (argv.length > 0 && argv[0] === 'config') {
    return handleConfigSubcommand(argv.slice(1));
  }

  let customConfig = null;
  const cliOptions = {};
  let dryRun = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') {
      printHelp();
      return 0;
    }
    if (arg === '-v' || arg === '--version') {
      console.log(`${c.bold}fuck-agy-skills${c.reset} v0.1.0`);
      return 0;
    }
    if (arg === '-d' || arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--clean') {
      cliOptions.clean = true;
    } else if (arg === '--no-clean') {
      cliOptions.clean = false;
    } else if (arg === '-c' || arg === '--config') {
      if (i + 1 < argv.length) {
        customConfig = argv[++i];
      } else {
        console.error(`${c.red}[ERROR]${c.reset} Option --config requires a path argument.`);
        return 1;
      }
    } else if (arg === '-s' || arg === '--source') {
      if (i + 1 < argv.length) {
        cliOptions.source = argv[++i];
      } else {
        console.error(`${c.red}[ERROR]${c.reset} Option --source requires a path argument.`);
        return 1;
      }
    } else if (arg === '-t' || arg === '--target') {
      if (i + 1 < argv.length) {
        cliOptions.target = argv[++i];
      } else {
        console.error(`${c.red}[ERROR]${c.reset} Option --target requires a path argument.`);
        return 1;
      }
    } else if (arg === '-e' || arg === '--exclude') {
      if (i + 1 < argv.length) {
        cliOptions.exclude = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
      } else {
        console.error(`${c.red}[ERROR]${c.reset} Option --exclude requires a list argument.`);
        return 1;
      }
    } else {
      console.warn(`${c.yellow}[WARN]${c.reset} Unknown option: "${arg}". Ignoring.`);
    }
  }

  const runtimeName = process.versions.bun ? `Bun ${process.versions.bun}` : `Node.js ${process.version}`;
  console.log(`${c.cyan}[INFO]${c.reset} ${c.bold}fuck-agy-skills v0.1.0${c.reset} starting (Runtime: ${c.green}${runtimeName}${c.reset})...`);
  if (dryRun) {
    console.log(`${c.yellow}[INFO] Running in DRY-RUN mode. No files will be modified.${c.reset}`);
  }

  try {
    const { config: baseConfig, filePath } = await loadConfig(customConfig);
    const config = mergeCliOverrides(baseConfig, cliOptions);

    console.log(`${c.cyan}[INFO]${c.reset} Config : ${c.dim}${filePath}${c.reset}`);
    console.log(`${c.cyan}[INFO]${c.reset} Source : ${config.source}`);
    console.log(`${c.cyan}[INFO]${c.reset} Target : ${config.target}`);
    console.log(`${c.cyan}[INFO]${c.reset} Clean  : ${config.clean_deleted ? `${c.yellow}enabled (ledger-safe)${c.reset}` : `${c.dim}disabled${c.reset}`}`);
    if (config.exclude.length > 0) {
      console.log(`${c.cyan}[INFO]${c.reset} Exclude: ${c.dim}${config.exclude.join(', ')}${c.reset}`);
    }

    const result = await runSync(config, { dryRun });

    console.log(`\n${c.bold}[SUMMARY] Synchronization complete${dryRun ? ' (dry-run)' : ''}:${c.reset}`);
    console.log(`  - Copied  : ${c.green}${result.copied}${c.reset}`);
    console.log(`  - Skipped : ${result.skipped > 0 ? `${c.yellow}${result.skipped}${c.reset}` : '0'}`);
    console.log(`  - Cleaned : ${result.cleaned > 0 ? `${c.magenta}${result.cleaned}${c.reset}` : '0'}`);
    console.log(`  - Errors  : ${result.errors > 0 ? `${c.bold}${c.red}${result.errors}${c.reset}` : `${c.gray}0${c.reset}`}`);

    if (result.errors > 0) {
      console.error(`\n${c.red}[WARNING] Completed with errors:${c.reset}`);
      for (const item of result.details) {
        if (item.status === 'failed') {
          console.error(`  - ${item.skill}: ${item.error}`);
        }
      }
      return 1;
    }

    return 0;
  } catch (err) {
    console.error(`\n${c.red}[FATAL] Synchronization failed: ${err.message}${c.reset}`);
    return 1;
  }
}

// Automatic Bun respawn check
if (shouldRespawnWithBun()) {
  respawnWithBun();
} else {
  main().then((code) => {
    process.exit(code);
  });
}
