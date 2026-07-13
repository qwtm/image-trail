#!/usr/bin/env node

// Runs after `changeset version` (see the changeset:version script): all committed version
// artifacts must follow the package.json version that Changesets bumped.

import { readFile, writeFile } from 'node:fs/promises';
import { validateChromeExtensionVersion } from './check-version-policy.mjs';

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const manifestText = await readFile('extension/manifest.json', 'utf8');
const manifest = JSON.parse(manifestText);
const packageLockText = await readFile('package-lock.json', 'utf8');
const packageLock = JSON.parse(packageLockText);
const versionErrors = validateChromeExtensionVersion(pkg.version);

if (versionErrors.length > 0) {
  console.error(`Refusing to copy invalid Chrome extension version "${String(pkg.version)}":`);
  for (const error of versionErrors) console.error(`  - ${error}`);
  process.exit(1);
}

if (packageLock.name !== pkg.name || packageLock.packages?.['']?.name !== pkg.name) {
  console.error('Refusing to update package-lock.json because its root package does not match package.json.');
  process.exit(1);
}

let updatedManifestText = manifestText;
if (manifest.version !== pkg.version) {
  updatedManifestText = manifestText.replace(`"version": "${manifest.version}"`, `"version": "${pkg.version}"`);
  if (JSON.parse(updatedManifestText).version !== pkg.version) {
    console.error(`Could not rewrite the version field in extension/manifest.json (${manifest.version} -> ${pkg.version}).`);
    process.exit(1);
  }
}

const previousLockVersion = packageLock.version;
const previousLockRootVersion = packageLock.packages[''].version;
packageLock.version = pkg.version;
packageLock.packages[''].version = pkg.version;
const updatedPackageLockText = `${JSON.stringify(packageLock, null, 2)}\n`;

if (updatedManifestText === manifestText) {
  console.log(`extension/manifest.json already at ${pkg.version}.`);
} else {
  await writeFile('extension/manifest.json', updatedManifestText);
  console.log(`extension/manifest.json version: ${manifest.version} -> ${pkg.version}.`);
}

if (updatedPackageLockText === packageLockText) {
  console.log(`package-lock.json already at ${pkg.version}.`);
} else {
  await writeFile('package-lock.json', updatedPackageLockText);
  console.log(
    `package-lock.json versions: ${String(previousLockVersion)}/${String(previousLockRootVersion)} -> ${pkg.version}/${pkg.version}.`,
  );
}
