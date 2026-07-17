#!/usr/bin/env node

// Dependency-license gate. Determines what actually ships by inspecting the
// esbuild bundle (not npm's dev/prod flag — bundled devDependencies like valibot
// ship too), fails the build when any shipped package carries a disallowed or
// unknown license, and keeps the committed third-party attribution — including
// each package's full license text — in sync with what ships.
//
//   node scripts/check-licenses.mjs           validate policy + attribution freshness
//   node scripts/check-licenses.mjs --write    regenerate THIRD-PARTY-LICENSES.txt

import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { bundledPackageDirectories } from './extension-build-policy.mjs';
import {
  describeViolation,
  evaluateLicenses,
  isAllowedLicense,
  lockfileDependencies,
  manifestLicense,
  renderAttribution,
} from './license-policy.mjs';

export const ATTRIBUTION_FILE = 'THIRD-PARTY-LICENSES.txt';
const NOTICE_FILE = /^(?:licen[cs]e|copying|notice)(?:[.-].*)?$/iu;

async function readNoticeText(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return null;
  }
  const noticeName = entries
    .filter((entry) => entry.isFile() && NOTICE_FILE.test(entry.name))
    .map((entry) => entry.name)
    .sort()[0];
  if (!noticeName) return null;
  try {
    return (await readFile(path.join(directory, noticeName), 'utf8')).replace(/\r\n/gu, '\n');
  } catch {
    return null;
  }
}

async function readManifest(directory) {
  try {
    return JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
  } catch {
    return {};
  }
}

// Describe each installed package directory esbuild bundles: its declared name,
// version, license, and verbatim notice text.
async function describeBundledPackages(directories) {
  return Promise.all(
    directories.map(async (directory) => {
      const manifest = await readManifest(directory);
      return {
        name: typeof manifest.name === 'string' ? manifest.name : path.basename(directory),
        version: typeof manifest.version === 'string' ? manifest.version : null,
        license: manifestLicense(manifest),
        notice: await readNoticeText(directory),
      };
    }),
  );
}

async function readAttribution() {
  try {
    return await readFile(ATTRIBUTION_FILE, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

async function main() {
  const write = process.argv.slice(2).includes('--write');

  const shipped = await describeBundledPackages(await bundledPackageDirectories());
  const errors = shipped.filter((entry) => !isAllowedLicense(entry.license));

  // Everything installed but not bundled is advisory only — build tooling that
  // never reaches users. Surface high-signal disallowed licenses; summarize the
  // no-metadata noise (packages that simply omit the field).
  const shippedNames = new Set(shipped.map((entry) => entry.name));
  const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
  const nonShipped = lockfileDependencies(lock).filter((dependency) => !shippedNames.has(dependency.name));
  const { warnings } = evaluateLicenses(nonShipped);
  for (const warning of warnings.filter((warning) => warning.kind === 'disallowed')) {
    console.warn(`license warning (not shipped): ${describeViolation(warning)}`);
  }
  const unknownCount = warnings.filter((warning) => warning.kind === 'unknown').length;
  if (unknownCount > 0)
    console.warn(`license note: ${unknownCount} non-shipped dependencies have no resolvable license metadata (advisory only).`);

  const expectedAttribution = renderAttribution(shipped);
  if (write) {
    await writeFile(ATTRIBUTION_FILE, expectedAttribution);
    console.log(`Wrote ${ATTRIBUTION_FILE} (${shipped.length} bundled packages).`);
  }

  if (errors.length > 0) {
    console.error('Disallowed or unknown licenses among BUNDLED (shipped) packages:');
    for (const entry of errors)
      console.error(
        `  - ${entry.name}@${entry.version ?? '?'} — ${entry.license === null ? 'no license metadata' : `disallowed license "${entry.license}"`}`,
      );
    console.error('Add the identifier to ALLOWED_LICENSES in scripts/license-policy.mjs only if it is truly permissible.');
    process.exitCode = 1;
    return;
  }

  if (!write) {
    const actual = await readAttribution();
    if (actual !== expectedAttribution) {
      console.error(`${ATTRIBUTION_FILE} is stale. Run "npm run licenses:write" and commit the result.`);
      process.exitCode = 1;
      return;
    }
  }

  console.log(`License check OK: ${shipped.length} bundled packages scanned (${shipped.map((entry) => entry.name).join(', ')}).`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
