import * as vscode from 'vscode';
import { SimpleGit } from 'simple-git';
import { GitProfile, SshStrategy } from './types';

export class GitConfigWriter {
  async applyProfile(profile: GitProfile, git: SimpleGit): Promise<void> {
    await git.addConfig('user.name', profile.userName, false, 'local');
    await git.addConfig('user.email', profile.email, false, 'local');

    if (profile.sshKeyPath) {
      await this.applySshKey(profile.sshKeyPath);
    }
  }

  private async applySshKey(keyPath: string): Promise<void> {
    const strategy = vscode.workspace
      .getConfiguration('gitSwitcher')
      .get<SshStrategy>('sshStrategy', 'GIT_SSH_COMMAND');

    if (strategy === 'GIT_SSH_COMMAND') {
      const expandedPath = keyPath.replace(/^~/, process.env.HOME || '');
      const sshCmd = `ssh -i ${expandedPath} -o IdentitiesOnly=yes`;

      const terminalEnv = vscode.workspace.getConfiguration('terminal.integrated.env');
      const platform = process.platform === 'darwin' ? 'osx'
        : process.platform === 'win32' ? 'windows'
        : 'linux';

      const current = terminalEnv.get<Record<string, string>>(platform, {});
      await terminalEnv.update(platform, {
        ...current,
        GIT_SSH_COMMAND: sshCmd,
      }, vscode.ConfigurationTarget.Workspace);
    }
  }

  async getCurrentRepoIdentity(git: SimpleGit): Promise<{ name?: string; email?: string }> {
    try {
      const name = await git.getConfig('user.name', 'local');
      const email = await git.getConfig('user.email', 'local');
      return { name: name.value || undefined, email: email.value || undefined };
    } catch {
      return {};
    }
  }
}
