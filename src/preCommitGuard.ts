import * as path from 'path';
import * as fs from 'fs';
import { GitProfile } from './types';

const HOOK_MARKER = '# git-switcher-pre-commit-guard';
const EXPECTED_FILE = 'git-switcher-expected';

function buildHookScript(): string {
  return [
    '#!/bin/sh',
    HOOK_MARKER,
    'EXPECTED_FILE="$(git rev-parse --git-dir)/' + EXPECTED_FILE + '"',
    'if [ ! -f "$EXPECTED_FILE" ]; then',
    '  exit 0',
    'fi',
    '',
    'EXPECTED_EMAIL=$(head -1 "$EXPECTED_FILE")',
    'EXPECTED_NAME=$(sed -n "2p" "$EXPECTED_FILE")',
    'CURRENT_EMAIL=$(git config user.email)',
    'CURRENT_NAME=$(git config user.name)',
    '',
    'if [ "$CURRENT_EMAIL" != "$EXPECTED_EMAIL" ]; then',
    '  echo ""',
    '  echo "  [Git Switcher] Identity mismatch!"',
    '  echo "  Expected: $EXPECTED_NAME <$EXPECTED_EMAIL>"',
    '  echo "  Current:  $CURRENT_NAME <$CURRENT_EMAIL>"',
    '  echo ""',
    '  echo "  Run \'Git Switcher: Switch Profile\' in VS Code to fix."',
    '  echo "  Or use --no-verify to bypass this check."',
    '  echo ""',
    '  exit 1',
    'fi',
    '',
  ].join('\n');
}

export class PreCommitGuard {
  async install(repoPath: string, profile: GitProfile): Promise<void> {
    const gitDir = path.join(repoPath, '.git');
    if (!fs.existsSync(gitDir) || !fs.statSync(gitDir).isDirectory()) { return; }

    this.writeExpectedFile(gitDir, profile);
    this.installHook(gitDir);
  }

  async uninstall(repoPath: string): Promise<void> {
    const gitDir = path.join(repoPath, '.git');
    if (!fs.existsSync(gitDir) || !fs.statSync(gitDir).isDirectory()) { return; }

    const expectedPath = path.join(gitDir, EXPECTED_FILE);
    if (fs.existsSync(expectedPath)) {
      fs.unlinkSync(expectedPath);
    }

    this.removeHook(gitDir);
  }

  private writeExpectedFile(gitDir: string, profile: GitProfile): void {
    const expectedPath = path.join(gitDir, EXPECTED_FILE);
    fs.writeFileSync(expectedPath, `${profile.email}\n${profile.userName}`, 'utf-8');
  }

  private installHook(gitDir: string): void {
    const hooksDir = path.join(gitDir, 'hooks');
    if (!fs.existsSync(hooksDir)) {
      fs.mkdirSync(hooksDir, { recursive: true });
    }

    const hookPath = path.join(hooksDir, 'pre-commit');
    const hookScript = buildHookScript();

    if (fs.existsSync(hookPath)) {
      const existing = fs.readFileSync(hookPath, 'utf-8');
      if (existing.includes(HOOK_MARKER)) {
        return;
      }
      fs.appendFileSync(hookPath, '\n' + hookScript, 'utf-8');
    } else {
      fs.writeFileSync(hookPath, hookScript, 'utf-8');
    }

    fs.chmodSync(hookPath, 0o755);
  }

  private removeHook(gitDir: string): void {
    const hookPath = path.join(gitDir, 'hooks', 'pre-commit');
    if (!fs.existsSync(hookPath)) { return; }

    const content = fs.readFileSync(hookPath, 'utf-8');
    if (!content.includes(HOOK_MARKER)) { return; }

    const markerStart = content.indexOf(HOOK_MARKER);
    const before = content.substring(0, markerStart).trimEnd();

    if (!before || before === '#!/bin/sh') {
      fs.unlinkSync(hookPath);
      return;
    }

    fs.writeFileSync(hookPath, before + '\n', 'utf-8');
  }
}
