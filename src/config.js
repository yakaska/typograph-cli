// Configuration for the ftl-json mode: which JSON fields are processed.

import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_FIELDS = [
  'title',
  'subtitle',
  'text',
  'description',
  'label',
  'message',
  'buttonText',
];

export const DEFAULT_EXCLUDE_FIELDS = [
  'type',
  'icon',
  'uri',
  'url',
  'link',
  'id',
  'toggle',
  'eventForAnalytic',
  'paramsForAnalytic',
  'subtitleVoice',
  'titleVoice',
];

export const DEFAULT_EXCLUDE_SUFFIXES = ['Voice'];

const RC_NAME = '.typographrc.json';

function findRcFile(startDir) {
  let dir = path.resolve(startDir);
  for (;;) {
    const candidate = path.join(dir, RC_NAME);
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Resolve the effective field configuration.
 *
 * @param {{fields?: string, excludeFields?: string, cwd?: string}} options
 *   `fields` / `excludeFields` are comma-separated strings from the CLI.
 */
export function resolveConfig(options = {}) {
  const cwd = options.cwd || process.cwd();
  let fields = DEFAULT_FIELDS.slice();
  let excludeFields = DEFAULT_EXCLUDE_FIELDS.slice();
  let excludeSuffixes = DEFAULT_EXCLUDE_SUFFIXES.slice();

  const rcPath = findRcFile(cwd);
  if (rcPath) {
    let rc = null;
    try {
      rc = JSON.parse(fs.readFileSync(rcPath, 'utf8'));
    } catch {
      rc = null;
    }
    if (rc) {
      if (Array.isArray(rc.fields)) fields = rc.fields.map(String);
      if (Array.isArray(rc.excludeFields)) excludeFields = rc.excludeFields.map(String);
      if (Array.isArray(rc.excludeSuffixes)) excludeSuffixes = rc.excludeSuffixes.map(String);
    }
  }

  if (options.fields) {
    fields = options.fields.split(',').map((s) => s.trim()).filter(Boolean);
  }
  if (options.excludeFields) {
    excludeFields = options.excludeFields.split(',').map((s) => s.trim()).filter(Boolean);
  }

  return {
    fields: new Set(fields),
    excludeFields: new Set(excludeFields),
    excludeSuffixes,
    rcPath,
  };
}

export function shouldProcess(config, key) {
  if (!key) return false;
  if (config.excludeFields.has(key)) return false;
  for (const suffix of config.excludeSuffixes) {
    if (key.endsWith(suffix)) return false;
  }
  return config.fields.has(key);
}
