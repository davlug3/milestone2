import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Usage: node scripts/download-jilp-photos.mjs [destination]
// Set RCLONE_REMOTE, RCLONE_PATH or JILP_DRIVE_FOLDER_ID to override defaults.
// Authenticate first with rclone config (Google Drive remote named gdrive).
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('Usage: node scripts/download-jilp-photos.mjs [destination]');
  console.log('Default destination: assets/jilp-old-pics.local (gitignored)');
  console.log('Optional env: RCLONE_REMOTE, RCLONE_PATH, JILP_DRIVE_FOLDER_ID');
  process.exit(0);
}
if (args.length > 1 || args.some(arg => arg.startsWith('-'))) {
  console.error('Expected at most one destination argument. Use --help.');
  process.exit(1);
}
const fallback = join(homedir(), '.local', 'bin', 'rclone');
const rclone = process.env.RCLONE_PATH || (existsSync(fallback) ? fallback : 'rclone');
const remote = (process.env.RCLONE_REMOTE || 'gdrive').replace(/:$/, '');
const folderId = process.env.JILP_DRIVE_FOLDER_ID;
const source = folderId ? remote + ':' : remote + ':JILP Old pics - Categorized';
const rootOptions = folderId ? ['--drive-root-folder-id', folderId] : [];
const destination = args[0] ? resolve(args[0]) :
  fileURLToPath(new URL('../assets/jilp-old-pics.local/', import.meta.url));

function run(command, extra) {
  const result = spawnSync(rclone, [command, ...extra], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('rclone ' + command + ' failed (' + (result.status ?? result.signal) + ')');
}

try {
  mkdirSync(destination, { recursive: true });
  // Copy, never sync: unrelated local files and all Drive originals are preserved.
  run('copy', [source, destination, ...rootOptions, '--create-empty-src-dirs',
    '--transfers', '8', '--checkers', '12', '--progress']);
  // Compare remote and local files; extra local files are allowed.
  run('check', [source, destination, ...rootOptions, '--one-way']);
  console.log('Verified download:', destination);
} catch (error) {
  console.error(error.message);
  console.error('Install rclone and authenticate the Google Drive remote with rclone config.');
  process.exitCode = 1;
}
