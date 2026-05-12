import * as vscode from 'vscode';
import { ResolvedProfile } from './types';

export class StatusBarController {
  private item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.command = 'gitSwitcher.switchProfile';
  }

  update(resolved: ResolvedProfile | undefined): void {
    if (!resolved) {
      this.item.text = '$(alert) Git: No Profile';
      this.item.tooltip = 'No Git Switcher profile configured for this workspace. Click to select one.';
      this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      this.item.show();
      return;
    }

    const { profile, source } = resolved;
    const icon = source === 'manual-override' ? '$(pencil)'
      : source === 'directory-match' ? '$(check)'
      : source === 'default' ? '$(info)'
      : '$(git-commit)';

    this.item.text = `${icon} Git: ${profile.name} (${profile.email})`;
    this.item.tooltip = `Profile: ${profile.name}\nSource: ${source}\nClick to switch`;
    this.item.backgroundColor = source === 'manual-override'
      ? new vscode.ThemeColor('statusBarItem.warningBackground')
      : undefined;
    this.item.show();
  }

  hide(): void {
    this.item.hide();
  }

  dispose(): void {
    this.item.dispose();
  }
}
