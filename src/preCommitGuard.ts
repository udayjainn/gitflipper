import * as path from 'path';
import * as fs from 'fs';
import { GitProfile } from './types';

const HOOK_MARKER = '# git-switcher-pre-commit-guard';
const EXPECTED_FILE = 'git-switcher-expected';

const HOOK_SCRIPT = `#!/bin/sh
${HOOK_MARKER}
EXPECTED_FILE="$(git rev-parse --git-dir)/${EXPECTED_FILE}"
if [ ! -f "$EXPECTED_FILE" ]; then
  exit 0
fi

EXPECTED_EMAIL=$(head -1 "$EXPECTED_FILE")
EXPECTED_NAME=$(tail -1 "$EXPECTED_FILE")
CURRENT_EMAIL=$(git config user.email)
CURRENT_NAME=$(git config user.name)

if [ "$CURRENT_EMAIL" != "$EXPECTED_EMAIL" ]; then
  echo ""
  echo "  [Git Switcher] Identity mismatch!"
  echo "  Expected: $EXPECTED_NAME <$EXPECTED_EMAIL>"
  echo "  Current:  $CURRENT_NAME <$CURRENT_EMAIL>"
  echo ""
  echo "  Run 'Git Switcher: Switch Profile' in VS Code to fix."
  echo "  Or use --no-verify to bypass this check."
  echo ""
  exit 1
fi
`;

export class PreCommitGuard {
  async install(repoPath: string, profile: GitProfile): Promise<void> {
    const gitDir = path.join(repoPath, '.git');
    if (!fs.existsSync(gitDir)) { return; }

    await this.writeExpectedFile(gitDir, profile);
    await this.installHook(gitDir);
  }

  async uninstall(repoPath: string): Promise<void> {
    const gitDir = path.join(repoPath, '.git');
    if (!fs.existsSync(gitDir)) { return; }

    const expectedPath = path.join(gitDir, EXPECTED_FILE);
    if (fs.existsSync(expectedPath)) {
      fs.unlinkSync(expectedPath);
    }

    await this.removeHook(gitDir);
  }

  private async writeExpectedFile(gitDir: string, profile: GitProfile): Promise<void> {
    const expectedPath = path.join(gitDir, EXPECTED_FILE);
    fs.writeFileSync(expectedPath, `${profile.email}\n${profile.userName}`, 'utf-8');
  }

  private async installHook(gitDir: string): Promise<void> {
    const hooksDir = path.join(gitDir, 'hooks');
    if (!fs.existsSync(hooksDir)) {
      fs.mkdirSync(hooksDir, { recursive: true });
    }

    const hookPath = path.join(hooksDir, 'pre-commit');

    if (fs.existsSync(hookPath)) {
      const existing = fs.readFileSync(hookPath, 'utf-8');
      if (existing.includes(HOOK_MARKER)) {
        return;
      }
      // Append to existing hook
      fs.appendFileSync(hookPath, '\n' + HOOK_SCRIPT, 'utf-8');
    } else {
      fs.writeFileSync(hookPath, HOOK_SCRIPT, 'utf-8');
    }

    fs.chmodSync(hookPath, 0o755);
  }

  private async removeHook(gitDir: string): Promise<void> {
    const hookPath = path.join(gitDir, 'hooks', 'pre-commit');
    if (!fs.existsSync(hookPath)) { return; }

    const content = fs.readFileSync(hookPath, 'utf-8');
    if (!content.includes(HOOK_MARKER)) { return; }

    const lines = content.split('\n');
    const markerIdx = lines.findIndex(l => l.includes(HOOK_MARKER));
    if (markerIdx <= 0) {
      // Our hook is the only content — remove the file
      fs.unlinkSync(hookPath);
      return;
    }

    // Keep everything before our marker
    const kept = lines.slice(0, markerIdx - 1).join('\n').trimEnd();
    if (kept) {
      fs.writeFileSync(hookPath, kept + '\n', 'utf-8');
    } else {
      fs.unlinkSync(hookPath);
    }
  }
}
