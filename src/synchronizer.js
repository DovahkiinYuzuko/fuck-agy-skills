import fs from 'node:fs/promises';
import path from 'node:path';

export const CACHE_FILE_NAME = '.fuck-agy-cache.json';

/**
 * Returns the path to the synchronization cache file in target directory.
 * @param {string} targetDir
 * @returns {string}
 */
export function getCacheFilePath(targetDir) {
  return path.join(targetDir, CACHE_FILE_NAME);
}

/**
 * Loads the synchronization ledger cache.
 * @param {string} targetDir
 * @returns {Promise<{ version: string, last_sync: string, synced_skills: Array<string> }>}
 */
export async function loadSyncCache(targetDir) {
  const cachePath = getCacheFilePath(targetDir);
  try {
    const raw = await fs.readFile(cachePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      version: parsed.version ?? '1.0.0',
      last_sync: parsed.last_sync ?? new Date().toISOString(),
      synced_skills: Array.isArray(parsed.synced_skills) ? parsed.synced_skills : [],
    };
  } catch {
    return {
      version: '1.0.0',
      last_sync: new Date().toISOString(),
      synced_skills: [],
    };
  }
}

/**
 * Saves the synchronization ledger cache.
 * @param {string} targetDir
 * @param {Array<string>} syncedSkills
 * @returns {Promise<void>}
 */
export async function saveSyncCache(targetDir, syncedSkills) {
  const cachePath = getCacheFilePath(targetDir);
  const data = {
    version: '1.0.0',
    last_sync: new Date().toISOString(),
    synced_skills: [...new Set(syncedSkills)].sort(),
  };
  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(cachePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Checks if the given path is a symlink or junction.
 * @param {string} targetPath
 * @returns {Promise<boolean>}
 */
export async function isLinkOrJunction(targetPath) {
  try {
    const stat = await fs.lstat(targetPath);
    return stat.isSymbolicLink();
  } catch {
    return false;
  }
}

/**
 * Safely removes a symlink or junction without deleting target contents.
 * @param {string} targetPath
 * @returns {Promise<boolean>}
 */
export async function removeLink(targetPath) {
  try {
    const isLink = await isLinkOrJunction(targetPath);
    if (isLink) {
      await fs.unlink(targetPath);
      return true;
    }
    return false;
  } catch (err) {
    try {
      await fs.rmdir(targetPath);
      return true;
    } catch {
      throw err;
    }
  }
}

/**
 * Synchronizes a single skill directory from source to target.
 * @param {string} skillName
 * @param {string} sourceDir
 * @param {string} targetDir
 * @param {{ replace_links: boolean, dryRun?: boolean }} options
 * @returns {Promise<{ action: 'copied' | 'skipped' | 'failed', error?: Error }>}
 */
export async function syncSkill(skillName, sourceDir, targetDir, options = {}) {
  const srcPath = path.join(sourceDir, skillName);
  const destPath = path.join(targetDir, skillName);

  if (options.dryRun) {
    return { action: 'copied' };
  }

  try {
    if (options.replace_links) {
      const isLink = await isLinkOrJunction(destPath);
      if (isLink) {
        await removeLink(destPath);
      }
    }

    await fs.mkdir(targetDir, { recursive: true });
    await fs.cp(srcPath, destPath, { recursive: true, force: true });
    return { action: 'copied' };
  } catch (error) {
    return { action: 'failed', error };
  }
}

/**
 * Safely cleans up only previously synced skills (tracked in cache) that are missing from source.
 * Skills not in the ledger (e.g. Antigravity-native skills) are strictly preserved.
 * @param {string} sourceDir
 * @param {string} targetDir
 * @param {Array<string>} cacheSkills
 * @param {Array<string>} excludeList
 * @param {boolean} dryRun
 * @returns {Promise<Array<string>>}
 */
export async function cleanOrphanedSkills(sourceDir, targetDir, cacheSkills = [], excludeList = [], dryRun = false) {
  const cleaned = [];

  for (const skillName of cacheSkills) {
    if (excludeList.includes(skillName)) {
      continue;
    }

    const sourceSkillPath = path.join(sourceDir, skillName);
    let sourceExists = false;
    try {
      const stat = await fs.stat(sourceSkillPath);
      if (stat.isDirectory()) {
        sourceExists = true;
      }
    } catch {}

    // Exists in cache but no longer in source -> candidate for deletion
    if (!sourceExists) {
      const destPath = path.join(targetDir, skillName);
      if (!dryRun) {
        try {
          const isLink = await isLinkOrJunction(destPath);
          if (isLink) {
            await removeLink(destPath);
          } else {
            await fs.rm(destPath, { recursive: true, force: true });
          }
        } catch {}
      }
      cleaned.push(skillName);
    }
  }

  return cleaned;
}

/**
 * Runs the full synchronization flow based on configuration.
 * @param {object} config
 * @param {{ dryRun?: boolean }} [options={}]
 * @returns {Promise<{ copied: number, skipped: number, cleaned: number, errors: number, details: Array<any> }>}
 */
export async function runSync(config, options = {}) {
  const summary = {
    copied: 0,
    skipped: 0,
    cleaned: 0,
    errors: 0,
    details: [],
  };

  const { source, target, exclude = [], clean_deleted = false, replace_links = true } = config;
  const dryRun = options.dryRun ?? false;

  // Validate source directory
  try {
    const srcStat = await fs.stat(source);
    if (!srcStat.isDirectory()) {
      throw new Error(`Source path is not a directory: ${source}`);
    }
  } catch (err) {
    throw new Error(`Source directory does not exist or is not accessible: ${source} (${err.message})`);
  }

  // Load existing sync ledger cache
  const cache = await loadSyncCache(target);
  const currentlySyncedSkills = [];

  // Ensure target directory exists
  if (!dryRun) {
    await fs.mkdir(target, { recursive: true });
  }

  // List source skills
  const sourceEntries = await fs.readdir(source, { withFileTypes: true });
  for (const entry of sourceEntries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const skillName = entry.name;
    if (exclude.includes(skillName)) {
      summary.skipped++;
      summary.details.push({ skill: skillName, status: 'skipped', reason: 'excluded' });
      continue;
    }

    const result = await syncSkill(skillName, source, target, { replace_links, dryRun });
    if (result.action === 'copied') {
      summary.copied++;
      currentlySyncedSkills.push(skillName);
      summary.details.push({ skill: skillName, status: 'copied' });
    } else {
      summary.errors++;
      summary.details.push({ skill: skillName, status: 'failed', error: result.error?.message });
    }
  }

  // Clean deleted skills using the ledger cache
  if (clean_deleted) {
    const cleanedSkills = await cleanOrphanedSkills(source, target, cache.synced_skills, exclude, dryRun);
    summary.cleaned = cleanedSkills.length;
    for (const skill of cleanedSkills) {
      summary.details.push({ skill, status: 'cleaned' });
    }
  } else {
    // If clean_deleted is false, keep previously synced skills in the cache as well
    for (const prevSkill of cache.synced_skills) {
      if (!currentlySyncedSkills.includes(prevSkill)) {
        currentlySyncedSkills.push(prevSkill);
      }
    }
  }

  // Update sync cache ledger on disk
  if (!dryRun) {
    await saveSyncCache(target, currentlySyncedSkills);
  }

  return summary;
}
