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

    if (!state.resolved) { return; }

    // Check mismatch before applying so the warning shows the original repo identity
    await checkMismatch(state);

    const autoSwitch = vscode.workspace.getConfiguration('gitSwitcher').get<boolean>('autoSwitch', true);
    if (autoSwitch) {
      await configWriter.applyProfile(state.resolved.profile, state.git);

      if (state.resolved.profile.sshKeyPath) {
        await sshManager.applyKey(state.resolved.profile.sshKeyPath);
      }

      await preCommitGuard.install(state.folder.uri.fsPath, state.resolved.profile);
    }
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
  }

  async function checkMismatch(state: FolderState): Promise<void> {
    if (!state.resolved || state.resolved.source === 'manual-override') { return; }

    const warnOnMismatch = vscode.workspace.getConfiguration('gitSwitcher').get<boolean>('warnOnMismatch', true);
    if (!warnOnMismatch) { return; }

    const current = await configWriter.getCurrentRepoIdentity(state.git);
    if (current.email && current.email !== state.resolved.profile.email) {
      const action = await vscode.window.showWarningMessage(
        `Git identity mismatch in "${state.folder.name}": repo has "${current.email}" but expected "${state.resolved.profile.email}" (${state.resolved.profile.name}).`,
        'Switch to Expected',
        'Keep Current',
      );
      if (action === 'Switch to Expected') {
        await configWriter.applyProfile(state.resolved.profile, state.git);
      }
    }
  }

  // --- Commands ---

  context.subscriptions.push(
    vscode.commands.registerCommand('gitSwitcher.showActiveProfile', async () => {
      const active = getActiveFolder();
      if (!active) {
        vscode.window.showInformationMessage('No workspace open.');
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

      const active = getActiveFolder();
      if (!active) {
        vscode.window.showInformationMessage('No workspace open.');
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
        vscode.window.showInformationMessage(`Profile "${profile.name}" created.`);
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
    const onboarding = new Onboarding(profileManager);
    onboarding.run().then(() => {
      context.globalState.update(ONBOARDED_KEY, true);
      refreshAll();
    });
  }
}

export function deactivate() {
  statusBar?.dispose();
}
