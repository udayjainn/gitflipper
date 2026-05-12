import * as vscode from 'vscode';
import { GitProfile } from './types';
import {
  validateEmail,
  validateProfileName,
  validateSshKeyPath,
  validateDirectoryPath,
  scanSshKeys,
  detectGitIdentity,
  expandHomePath,
} from './validation';

const WIZARD_TITLE = 'Create Git Profile';

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
    const existingNames = this.getProfiles().map(p => p.name);
    const detected = await detectGitIdentity();

    const name = await vscode.window.showInputBox({
      title: `${WIZARD_TITLE} (Step 1 of 5)`,
      prompt: 'Give this profile a name — e.g., "Work" or "Personal"',
      placeHolder: 'Work',
      validateInput: v => validateProfileName(v, existingNames),
    });
    if (!name) { return undefined; }

    const userName = await vscode.window.showInputBox({
      title: `${WIZARD_TITLE} (Step 2 of 5)`,
      prompt: 'The name that will appear on your Git commits',
      placeHolder: 'Jane Doe',
      value: detected.name || '',
      validateInput: v => v.trim() ? null : 'Name is required — this shows on every commit you make',
    });
    if (userName === undefined) { return undefined; }

    const email = await vscode.window.showInputBox({
      title: `${WIZARD_TITLE} (Step 3 of 5)`,
      prompt: 'The email that will appear on your Git commits',
      placeHolder: 'you@example.com',
      value: detected.email || '',
      validateInput: validateEmail,
    });
    if (email === undefined) { return undefined; }

    const sshKeyPath = await this.pickSshKey();

    const directories = await this.pickDirectories();

    const summaryLines = [
      `Name: ${name.trim()}`,
      `Git user: ${userName.trim()} <${email.trim()}>`,
    ];
    if (sshKeyPath) { summaryLines.push(`SSH key: ${sshKeyPath}`); }
    if (directories && directories.length > 0) {
      summaryLines.push(`Auto-switch dirs: ${directories.join(', ')}`);
    }

    const confirm = await vscode.window.showInformationMessage(
      `Create profile "${name.trim()}"?\n\n${summaryLines.join('\n')}`,
      { modal: true },
      'Create',
    );
    if (confirm !== 'Create') { return undefined; }

    const profile: GitProfile = {
      name: name.trim(),
      userName: userName.trim(),
      email: email.trim(),
      sshKeyPath: sshKeyPath || undefined,
      directories: directories && directories.length > 0 ? directories : undefined,
    };

    await this.addProfile(profile);

    const hasDir = profile.directories && profile.directories.length > 0;
    const nextSteps = hasDir
      ? `Git Switcher will auto-apply this identity when you open projects in ${profile.directories!.join(', ')}.`
      : 'Tip: Add directory rules in settings so this profile activates automatically for certain folders.';

    vscode.window.showInformationMessage(
      `Profile "${profile.name}" created! ${nextSteps}`,
      'Edit in Settings',
    ).then(action => {
      if (action === 'Edit in Settings') {
        vscode.commands.executeCommand('workbench.action.openSettings', 'gitSwitcher.profiles');
      }
    });

    return profile;
  }

  private async pickSshKey(): Promise<string | undefined> {
    const sshKeys = scanSshKeys();

    const items: vscode.QuickPickItem[] = [];

    if (sshKeys.length > 0) {
      for (const key of sshKeys) {
        items.push({ label: key.label, description: key.description });
      }
      items.push({ label: '', kind: vscode.QuickPickItemKind.Separator });
    }

    items.push(
      { label: '$(folder-opened) Browse...', description: 'Select a key file from disk' },
      { label: '$(dash) Skip', description: "I don't need SSH key switching" },
    );

    const picked = await vscode.window.showQuickPick(items, {
      title: `${WIZARD_TITLE} (Step 4 of 5)`,
      placeHolder: 'Select an SSH private key (used to authenticate with Git remotes like GitHub)',
    });

    if (!picked || picked.label === '$(dash) Skip') {
      return undefined;
    }

    if (picked.label === '$(folder-opened) Browse...') {
      const uris = await vscode.window.showOpenDialog({
        title: 'Select SSH Private Key',
        canSelectMany: false,
        openLabel: 'Select Key',
      });
      if (uris && uris.length > 0) {
        const filePath = uris[0].fsPath;
        const error = validateSshKeyPath(filePath);
        if (error) {
          vscode.window.showWarningMessage(error);
          return undefined;
        }
        return filePath;
      }
      return undefined;
    }

    const matchedKey = sshKeys.find(k => k.label === picked.label);
    return matchedKey?.keyPath;
  }

  private async pickDirectories(): Promise<string[] | undefined> {
    const items: vscode.QuickPickItem[] = [];

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders) {
      for (const folder of workspaceFolders) {
        const dirPath = folder.uri.fsPath;
        items.push({
          label: `$(folder) ${folder.name}`,
          description: dirPath,
        });
      }
      items.push({ label: '', kind: vscode.QuickPickItemKind.Separator });
    }

    items.push(
      { label: '$(folder-opened) Browse...', description: 'Pick a folder from disk' },
      { label: '$(edit) Type a path...', description: 'Enter a directory path manually' },
      { label: '$(dash) Skip', description: "I'll set up directory rules later" },
    );

    const picked = await vscode.window.showQuickPick(items, {
      title: `${WIZARD_TITLE} (Step 5 of 5)`,
      placeHolder: 'Which folders should auto-activate this profile? (e.g., ~/work)',
    });

    if (!picked || picked.label === '$(dash) Skip') {
      return undefined;
    }

    if (picked.label === '$(folder-opened) Browse...') {
      const uris = await vscode.window.showOpenDialog({
        title: 'Select Directory for Auto-Switch',
        canSelectMany: true,
        canSelectFolders: true,
        canSelectFiles: false,
        openLabel: 'Select',
      });
      if (uris && uris.length > 0) {
        return uris.map(u => u.fsPath);
      }
      return undefined;
    }

    if (picked.label === '$(edit) Type a path...') {
      const dirInput = await vscode.window.showInputBox({
        title: `${WIZARD_TITLE} (Step 5 of 5)`,
        prompt: 'Enter directory paths separated by commas (e.g., ~/work, ~/company-repos)',
        placeHolder: '~/work, ~/projects/company',
        validateInput: v => {
          if (!v.trim()) { return null; }
          for (const d of v.split(',')) {
            const err = validateDirectoryPath(d.trim());
            if (err) { return err; }
          }
          return null;
        },
      });
      if (dirInput) {
        return dirInput.split(',').map(d => d.trim()).filter(Boolean);
      }
      return undefined;
    }

    if (picked.description) {
      return [picked.description];
    }

    return undefined;
  }
}
