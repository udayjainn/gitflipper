import * as vscode from 'vscode';
import { GitProfile } from './types';

export class ProfileManager {
  getProfiles(): GitProfile[] {
    return vscode.workspace.getConfiguration('gitSwitcher').get<GitProfile[]>('profiles', []);
  }

  getDefaultProfileName(): string {
    return vscode.workspace.getConfiguration('gitSwitcher').get<string>('defaultProfile', '');
  }

  getDefaultProfile(): GitProfile | undefined {
    const name = this.getDefaultProfileName();
    if (!name) { return undefined; }
    return this.getProfiles().find(p => p.name === name);
  }

  findByName(name: string): GitProfile | undefined {
    return this.getProfiles().find(p => p.name === name);
  }

  async addProfile(profile: GitProfile): Promise<void> {
    const profiles = this.getProfiles();
    const existing = profiles.findIndex(p => p.name === profile.name);
    if (existing >= 0) {
      profiles[existing] = profile;
    } else {
      profiles.push(profile);
    }
    await vscode.workspace.getConfiguration('gitSwitcher').update('profiles', profiles, vscode.ConfigurationTarget.Global);
  }

  async removeProfile(name: string): Promise<void> {
    const profiles = this.getProfiles().filter(p => p.name !== name);
    await vscode.workspace.getConfiguration('gitSwitcher').update('profiles', profiles, vscode.ConfigurationTarget.Global);
  }

  async createProfileInteractive(): Promise<GitProfile | undefined> {
    const name = await vscode.window.showInputBox({
      prompt: 'Profile name (e.g., Work, Personal)',
      placeHolder: 'Work',
      validateInput: v => v.trim() ? null : 'Name is required',
    });
    if (!name) { return undefined; }

    const userName = await vscode.window.showInputBox({
      prompt: 'Git user name',
      placeHolder: 'Uday Jain',
      validateInput: v => v.trim() ? null : 'User name is required',
    });
    if (!userName) { return undefined; }

    const email = await vscode.window.showInputBox({
      prompt: 'Git email',
      placeHolder: 'you@example.com',
      validateInput: v => v.includes('@') ? null : 'Enter a valid email',
    });
    if (!email) { return undefined; }

    const sshKeyPath = await vscode.window.showInputBox({
      prompt: 'SSH key path (optional)',
      placeHolder: '~/.ssh/id_ed25519',
    });

    const dirInput = await vscode.window.showInputBox({
      prompt: 'Directories for auto-switch (comma-separated, optional)',
      placeHolder: '~/work, ~/projects/company',
    });

    const directories = dirInput
      ? dirInput.split(',').map(d => d.trim()).filter(Boolean)
      : undefined;

    const profile: GitProfile = {
      name: name.trim(),
      userName: userName.trim(),
      email: email.trim(),
      sshKeyPath: sshKeyPath?.trim() || undefined,
      directories,
    };

    await this.addProfile(profile);
    return profile;
  }
}
