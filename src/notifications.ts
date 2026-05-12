import * as vscode from 'vscode';
import { GitProfile } from './types';

const shownThisSession = new Set<string>();

function once(key: string, fn: () => void): void {
  if (shownThisSession.has(key)) { return; }
  shownThisSession.add(key);
  fn();
}

export function showProfileApplied(profile: GitProfile, folderName: string): void {
  once(`applied:${folderName}:${profile.name}`, () => {
    vscode.window.showInformationMessage(
      `Git identity set to ${profile.name} (${profile.email}) for "${folderName}".`
    );
  });
}

export function showSshKeyApplied(keyPath: string): void {
  once('ssh-key', () => {
    const shortPath = keyPath.replace(/^.*[/\\]/, '');
    vscode.window.showInformationMessage(
      `SSH key "${shortPath}" is now active for terminal Git operations.`
    );
  });
}

export async function showNoProfileMatch(folderName: string): Promise<void> {
  once(`no-match:${folderName}`, () => {
    vscode.window.showWarningMessage(
      `No Git Switcher profile matches "${folderName}". Commits will use whatever identity is in your Git config.`,
      'Create Profile',
      'Assign Profile',
    ).then(action => {
      if (action === 'Create Profile') {
        vscode.commands.executeCommand('gitSwitcher.createProfile');
      } else if (action === 'Assign Profile') {
        vscode.commands.executeCommand('gitSwitcher.switchProfile');
      }
    });
  });
}

export async function showFirstRunWelcome(): Promise<string | undefined> {
  return vscode.window.showInformationMessage(
    'Welcome to Git Switcher! Automatically switch your Git identity based on project folder.',
    'Get Started',
    'Create Profile',
    'Later',
  );
}

export function showPostImport(count: number, names: string[]): void {
  const nameList = names.join(', ');
  vscode.window.showInformationMessage(
    `Imported ${count} profile(s) from your .gitconfig: ${nameList}. These will auto-switch your Git identity when you open matching folders.`,
    'View in Settings',
    'Open Walkthrough',
  ).then(action => {
    if (action === 'View in Settings') {
      vscode.commands.executeCommand('workbench.action.openSettings', 'gitSwitcher.profiles');
    } else if (action === 'Open Walkthrough') {
      vscode.commands.executeCommand('gitSwitcher.openWalkthrough');
    }
  });
}
