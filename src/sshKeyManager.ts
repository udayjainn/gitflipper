import * as vscode from 'vscode';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { SshStrategy } from './types';
import { expandHomePath } from './validation';

const exec = promisify(execFile);

export class SshKeyManager {
  private envCollection: vscode.EnvironmentVariableCollection | undefined;

  setEnvCollection(collection: vscode.EnvironmentVariableCollection): void {
    this.envCollection = collection;
  }

  async applyKey(keyPath: string): Promise<void> {
    const strategy = vscode.workspace
      .getConfiguration('gitFlip')
      .get<SshStrategy>('sshStrategy', 'GIT_SSH_COMMAND');

    if (strategy === 'GIT_SSH_COMMAND') {
      this.applyViaEnv(keyPath);
    } else {
      await this.applyViaAgent(keyPath);
    }
  }

  private applyViaEnv(keyPath: string): void {
    const expandedPath = expandHomePath(keyPath);
    const sshCmd = `ssh -i "${expandedPath}" -o IdentitiesOnly=yes`;

    if (this.envCollection) {
      this.envCollection.replace('GIT_SSH_COMMAND', sshCmd);
    }
  }

  private async applyViaAgent(keyPath: string): Promise<void> {
    const expandedPath = expandHomePath(keyPath);

    try {
      await exec('ssh-add', ['-D']).catch(() => {});
      await exec('ssh-add', [expandedPath]);
    } catch (err: any) {
      vscode.window.showErrorMessage(
        `Failed to add SSH key to agent: ${err.message}. Is ssh-agent running?`
      );
    }
  }

  clearEnv(): void {
    if (this.envCollection) {
      this.envCollection.delete('GIT_SSH_COMMAND');
    }
  }
}
