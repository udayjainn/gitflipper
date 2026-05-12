import * as vscode from 'vscode';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { SshStrategy } from './types';

const exec = promisify(execFile);

export class SshKeyManager {
  async applyKey(keyPath: string): Promise<void> {
    const strategy = vscode.workspace
      .getConfiguration('gitSwitcher')
      .get<SshStrategy>('sshStrategy', 'GIT_SSH_COMMAND');

    if (strategy === 'GIT_SSH_COMMAND') {
      await this.applyViaEnv(keyPath);
    } else {
      await this.applyViaAgent(keyPath);
    }
  }

  private async applyViaEnv(keyPath: string): Promise<void> {
    const expandedPath = this.expandHome(keyPath);
    const sshCmd = `ssh -i "${expandedPath}" -o IdentitiesOnly=yes`;

    // Set on the process so simple-git and child processes pick it up at runtime
    // without writing user-specific paths to any settings file
    process.env['GIT_SSH_COMMAND'] = sshCmd;
  }

  private async applyViaAgent(keyPath: string): Promise<void> {
    const expandedPath = this.expandHome(keyPath);

    try {
      // Remove all current keys from agent
      await exec('ssh-add', ['-D']).catch(() => {});
      // Add the desired key
      await exec('ssh-add', [expandedPath]);
    } catch (err: any) {
      vscode.window.showErrorMessage(
        `Failed to add SSH key to agent: ${err.message}. Is ssh-agent running?`
      );
    }
  }

  async listAgentKeys(): Promise<string[]> {
    try {
      const { stdout } = await exec('ssh-add', ['-l']);
      return stdout.split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  private expandHome(p: string): string {
    if (p.startsWith('~/') || p === '~') {
      return (process.env.HOME || '') + p.slice(1);
    }
    return p;
  }
}
