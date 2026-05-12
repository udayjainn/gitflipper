import * as vscode from 'vscode';
import simpleGit from 'simple-git';
import { ProfileManager } from './profileManager';
import { ProfileResolver } from './profileResolver';
import { GitConfigWriter } from './gitConfigWriter';
import { StatusBarController } from './statusBarController';

const OVERRIDE_KEY = 'gitSwitcher.manualOverride';

let statusBar: StatusBarController;

export function activate(context: vscode.ExtensionContext) {
  const profileManager = new ProfileManager();
  const resolver = new ProfileResolver(profileManager);
  const configWriter = new GitConfigWriter();
  statusBar = new StatusBarController();

  async function refreshProfile() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      statusBar.hide();
      return;
    }

    const git = simpleGit(workspaceFolder.uri.fsPath);

    try {
      await git.checkIsRepo();
    } catch {
      statusBar.hide();
      return;
    }

    const override = context.workspaceState.get<string>(OVERRIDE_KEY);
    const resolved = await resolver.resolve(workspaceFolder.uri.fsPath, git, override);

    statusBar.update(resolved);

    if (!resolved) { return; }

    const autoSwitch = vscode.workspace.getConfiguration('gitSwitcher').get<boolean>('autoSwitch', true);
    if (autoSwitch) {
      await configWriter.applyProfile(resolved.profile, git);
    }

    const warnOnMismatch = vscode.workspace.getConfiguration('gitSwitcher').get<boolean>('warnOnMismatch', true);
    if (warnOnMismatch && resolved.source !== 'manual-override') {
      const current = await configWriter.getCurrentRepoIdentity(git);
      if (current.email && current.email !== resolved.profile.email) {
        const action = await vscode.window.showWarningMessage(
          `Git identity mismatch: repo has "${current.email}" but expected "${resolved.profile.email}" (${resolved.profile.name}).`,
          'Switch to Expected',
          'Keep Current',
        );
        if (action === 'Switch to Expected') {
          await configWriter.applyProfile(resolved.profile, git);
        }
      }
    }
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('gitSwitcher.showActiveProfile', async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showInformationMessage('No workspace open.');
        return;
      }
      const git = simpleGit(workspaceFolder.uri.fsPath);
      const current = await configWriter.getCurrentRepoIdentity(git);
      const override = context.workspaceState.get<string>(OVERRIDE_KEY);
      const resolved = await resolver.resolve(workspaceFolder.uri.fsPath, git, override);

      if (resolved) {
        vscode.window.showInformationMessage(
          `Active Profile: ${resolved.profile.name}\nEmail: ${resolved.profile.email}\nName: ${resolved.profile.userName}\nSource: ${resolved.source}`
        );
      } else {
        vscode.window.showInformationMessage(
          `No profile matched. Repo identity: ${current.name || 'unset'} <${current.email || 'unset'}>`
        );
      }
    }),

    vscode.commands.registerCommand('gitSwitcher.switchProfile', async () => {
      const profiles = profileManager.getProfiles();
      if (profiles.length === 0) {
        const create = await vscode.window.showWarningMessage(
          'No profiles configured. Create one now?',
          'Create Profile',
        );
        if (create) {
          await vscode.commands.executeCommand('gitSwitcher.createProfile');
        }
        return;
      }

      const picked = await vscode.window.showQuickPick(
        profiles.map(p => ({
          label: p.name,
          description: p.email,
          detail: p.directories?.join(', ') || 'No directory rules',
        })),
        { placeHolder: 'Select a Git profile' },
      );

      if (!picked) { return; }

      await context.workspaceState.update(OVERRIDE_KEY, picked.label);
      await refreshProfile();
      vscode.window.showInformationMessage(`Switched to profile: ${picked.label}`);
    }),

    vscode.commands.registerCommand('gitSwitcher.editProfiles', async () => {
      await vscode.commands.executeCommand('workbench.action.openSettings', 'gitSwitcher.profiles');
    }),

    vscode.commands.registerCommand('gitSwitcher.createProfile', async () => {
      const profile = await profileManager.createProfileInteractive();
      if (profile) {
        vscode.window.showInformationMessage(`Profile "${profile.name}" created.`);
        await refreshProfile();
      }
    }),

    vscode.commands.registerCommand('gitSwitcher.resetToAuto', async () => {
      await context.workspaceState.update(OVERRIDE_KEY, undefined);
      await refreshProfile();
      vscode.window.showInformationMessage('Reset to automatic profile detection.');
    }),

    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('gitSwitcher')) {
        refreshProfile();
      }
    }),

    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      refreshProfile();
    }),

    statusBar,
  );

  refreshProfile();
}

export function deactivate() {
  statusBar?.dispose();
}
