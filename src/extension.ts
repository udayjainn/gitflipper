import * as vscode from 'vscode';
import simpleGit, { SimpleGit } from 'simple-git';
import { ProfileManager } from './profileManager';
import { ProfileResolver } from './profileResolver';
import { GitConfigWriter } from './gitConfigWriter';
import { SshKeyManager } from './sshKeyManager';
import { StatusBarController } from './statusBarController';
import { PreCommitGuard } from './preCommitGuard';
import { Onboarding } from './onboarding';
import { ResolvedProfile } from './types';
import {
  showProfileApplied,
  showSshKeyApplied,
  showNoProfileMatch,
  showFirstRunWelcome,
} from './notifications';

const ONBOARDED_KEY = 'gitSwitcher.onboarded';
const OVERRIDE_KEY = 'gitSwitcher.manualOverride';

let statusBar: StatusBarController;

interface FolderState {
  folder: vscode.WorkspaceFolder;
  git: SimpleGit;
  resolved?: ResolvedProfile;
}

export function activate(context: vscode.ExtensionContext) {
  const profileManager = new ProfileManager();
  const resolver = new ProfileResolver(profileManager);
  const configWriter = new GitConfigWriter();
  const sshManager = new SshKeyManager();
  const preCommitGuard = new PreCommitGuard();
  statusBar = new StatusBarController();

  sshManager.setEnvCollection(context.environmentVariableCollection);

  const folderStates = new Map<string, FolderState>();

  function getActiveFolder(): vscode.WorkspaceFolder | undefined {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      return vscode.workspace.getWorkspaceFolder(editor.document.uri);
    }
    return vscode.workspace.workspaceFolders?.[0];
  }

  async function initFolder(folder: vscode.WorkspaceFolder): Promise<FolderState | undefined> {
    const git = simpleGit(folder.uri.fsPath);
    const isRepo = await git.checkIsRepo();
    if (!isRepo) { return undefined; }
    return { folder, git };
  }

  async function resolveAndApplyFolder(state: FolderState): Promise<void> {
    const overrides = context.workspaceState.get<Record<string, string>>(OVERRIDE_KEY, {});
    const override = overrides[state.folder.uri.fsPath];
    state.resolved = await resolver.resolve(state.folder.uri.fsPath, state.git, override);

    if (!state.resolved) {
      showNoProfileMatch(state.folder.name);
      return;
    }

    const autoSwitch = vscode.workspace.getConfiguration('gitSwitcher').get<boolean>('autoSwitch', true);

    if (autoSwitch) {
      const current = await configWriter.getCurrentRepoIdentity(state.git);
      if (current.email && current.email !== state.resolved.profile.email) {
        await showMismatchWarning(state, current.email);
      }

      await configWriter.applyProfile(state.resolved.profile, state.git);

      if (state.resolved.profile.sshKeyPath) {
        await sshManager.applyKey(state.resolved.profile.sshKeyPath);
        showSshKeyApplied(state.resolved.profile.sshKeyPath);
      }

      await preCommitGuard.install(state.folder.uri.fsPath, state.resolved.profile);

      showProfileApplied(state.resolved.profile, state.folder.name);
    }
  }

  async function showMismatchWarning(state: FolderState, currentEmail: string): Promise<void> {
    if (!state.resolved || state.resolved.source === 'manual-override') { return; }

    const warnOnMismatch = vscode.workspace.getConfiguration('gitSwitcher').get<boolean>('warnOnMismatch', true);
    if (!warnOnMismatch) { return; }

    vscode.window.showWarningMessage(
      `Git Switcher: Switching identity in "${state.folder.name}" from "${currentEmail}" to "${state.resolved.profile.email}" (${state.resolved.profile.name}).`
    );
  }

  async function refreshAll(): Promise<void> {
    folderStates.clear();
    const folders = vscode.workspace.workspaceFolders || [];

    for (const folder of folders) {
      const state = await initFolder(folder);
      if (state) {
        folderStates.set(folder.uri.fsPath, state);
        await resolveAndApplyFolder(state);
      }
    }

    updateStatusBar();
  }

  function updateStatusBar(): void {
    const active = getActiveFolder();
    if (!active) {
      statusBar.hide();
      return;
    }

    const state = folderStates.get(active.uri.fsPath);
    if (!state) {
      statusBar.hide();
      return;
    }

    const multiRoot = (vscode.workspace.workspaceFolders?.length || 0) > 1;
    statusBar.update(state.resolved, multiRoot ? state.folder.name : undefined);

    if (state.resolved?.profile.sshKeyPath) {
      sshManager.applyKey(state.resolved.profile.sshKeyPath);
    } else {
      sshManager.clearEnv();
    }
  }

  // --- Commands ---

  context.subscriptions.push(
    vscode.commands.registerCommand('gitSwitcher.showActiveProfile', async () => {
      const active = getActiveFolder();
      if (!active) {
        vscode.window.showInformationMessage('No workspace open. Open a folder first (File > Open Folder).');
        return;
      }

      const state = folderStates.get(active.uri.fsPath);
      if (state?.resolved) {
        const { profile, source } = state.resolved;
        vscode.window.showInformationMessage(
          `Profile: ${profile.name} | Email: ${profile.email} | Name: ${profile.userName} | Source: ${source} | Folder: ${state.folder.name}`
        );
      } else {
        const git = simpleGit(active.uri.fsPath);
        const current = await configWriter.getCurrentRepoIdentity(git);
        vscode.window.showInformationMessage(
          `No profile matched for "${active.name}". Current repo identity: ${current.name || 'unset'} <${current.email || 'unset'}>. Use "Git Switcher: Create Profile" to set one up.`
        );
      }
    }),

    vscode.commands.registerCommand('gitSwitcher.switchProfile', async () => {
      const profiles = profileManager.getProfiles();
      if (profiles.length === 0) {
        const create = await vscode.window.showWarningMessage(
          'No profiles configured yet. Create one to get started.',
          'Create Profile',
        );
        if (create) {
          await vscode.commands.executeCommand('gitSwitcher.createProfile');
        }
        return;
      }

      const active = getActiveFolder();
      if (!active) {
        vscode.window.showInformationMessage('No workspace open. Open a folder first (File > Open Folder).');
        return;
      }

      const picked = await vscode.window.showQuickPick(
        profiles.map(p => ({
          label: p.name,
          description: p.email,
          detail: p.directories?.join(', ') || 'No directory rules',
        })),
        { placeHolder: `Select a Git profile for "${active.name}"` },
      );

      if (!picked) { return; }

      const overrides = context.workspaceState.get<Record<string, string>>(OVERRIDE_KEY, {});
      overrides[active.uri.fsPath] = picked.label;
      await context.workspaceState.update(OVERRIDE_KEY, overrides);

      const state = folderStates.get(active.uri.fsPath);
      if (state) {
        await resolveAndApplyFolder(state);
        updateStatusBar();
      }

      vscode.window.showInformationMessage(`Switched "${active.name}" to profile: ${picked.label}`);
    }),

    vscode.commands.registerCommand('gitSwitcher.editProfiles', async () => {
      await vscode.commands.executeCommand('workbench.action.openSettings', 'gitSwitcher.profiles');
    }),

    vscode.commands.registerCommand('gitSwitcher.createProfile', async () => {
      const profile = await profileManager.createProfileInteractive();
      if (profile) {
        await refreshAll();
      }
    }),

    vscode.commands.registerCommand('gitSwitcher.removeHooks', async () => {
      const folders = vscode.workspace.workspaceFolders || [];
      let removed = 0;
      for (const folder of folders) {
        try {
          await preCommitGuard.uninstall(folder.uri.fsPath);
          removed++;
        } catch {
          // skip non-git folders
        }
      }
      vscode.window.showInformationMessage(`Removed pre-commit hooks from ${removed} folder(s).`);
    }),

    vscode.commands.registerCommand('gitSwitcher.resetToAuto', async () => {
      const active = getActiveFolder();
      if (!active) { return; }

      const overrides = context.workspaceState.get<Record<string, string>>(OVERRIDE_KEY, {});
      delete overrides[active.uri.fsPath];
      await context.workspaceState.update(OVERRIDE_KEY, overrides);

      const state = folderStates.get(active.uri.fsPath);
      if (state) {
        await resolveAndApplyFolder(state);
        updateStatusBar();
      }

      vscode.window.showInformationMessage(`Reset "${active.name}" to automatic profile detection.`);
    }),

    vscode.commands.registerCommand('gitSwitcher.openWalkthrough', () => {
      vscode.commands.executeCommand(
        'workbench.action.openWalkthrough',
        'uday-jain.git-switcher#gitSwitcher.gettingStarted',
        false,
      );
    }),

    // --- Event Listeners ---

    vscode.window.onDidChangeActiveTextEditor(() => {
      updateStatusBar();
    }),

    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('gitSwitcher')) {
        refreshAll();
      }
    }),

    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      refreshAll();
    }),

    statusBar,
  );

  refreshAll();

  // First-run onboarding
  const onboarded = context.globalState.get<boolean>(ONBOARDED_KEY, false);
  if (!onboarded && profileManager.getProfiles().length === 0) {
    showFirstRunWelcome().then(async (action) => {
      if (action === 'Get Started') {
        vscode.commands.executeCommand('gitSwitcher.openWalkthrough');
        context.globalState.update(ONBOARDED_KEY, true);
      } else if (action === 'Create Profile') {
        await vscode.commands.executeCommand('gitSwitcher.createProfile');
        context.globalState.update(ONBOARDED_KEY, true);
      } else if (action === 'Later') {
        // Don't mark onboarded — show again next time
      } else {
        // Also try existing includeIf import
        const onboarding = new Onboarding(profileManager);
        const completed = await onboarding.run();
        if (completed) {
          context.globalState.update(ONBOARDED_KEY, true);
          refreshAll();
        }
      }
    });
  }
}

export function deactivate() {
  statusBar?.dispose();
}
