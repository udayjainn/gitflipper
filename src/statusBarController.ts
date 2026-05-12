import * as vscode from 'vscode';
import { ResolvedProfile } from './types';

const SOURCE_LABELS: Record<string, string> = {
  'manual-override': 'Manually selected',
  'directory-match': 'Auto-detected from directory rules',
  'repo-local': 'Matched from repo-local Git config',
  'default': 'Using default profile (no directory match)',
};

export class StatusBarController {
  private item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.command = 'gitSwitcher.switchProfile';
  }

  update(resolved: ResolvedProfile | undefined, folderName?: string): void {
    const prefix = folderName ? `[${folderName}] ` : '';

    if (!resolved) {
      this.item.text = `$(alert) ${prefix}Git: No Profile`;
      this.item.tooltip = this.buildNoProfileTooltip(folderName);
      this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      this.item.show();
      return;
    }

    const { profile, source } = resolved;
    const icon = source === 'manual-override' ? '$(pencil)'
      : source === 'directory-match' ? '$(check)'
      : source === 'default' ? '$(info)'
      : '$(git-commit)';

    this.item.text = `${icon} ${prefix}Git: ${profile.name} (${profile.email})`;
    this.item.tooltip = this.buildTooltip(profile.name, profile.email, profile.userName, source, profile.sshKeyPath);
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

  private buildTooltip(name: string, email: string, userName: string, source: string, sshKey?: string): vscode.MarkdownString {
    const md = new vscode.MarkdownString('', true);
    md.isTrusted = true;

    md.appendMarkdown(`**Git Switcher — ${name}**\n\n`);
    md.appendMarkdown(`| | |\n|---|---|\n`);
    md.appendMarkdown(`| Name | ${userName} |\n`);
    md.appendMarkdown(`| Email | ${email} |\n`);
    if (sshKey) {
      const shortKey = sshKey.replace(/^.*[/\\]/, '');
      md.appendMarkdown(`| SSH Key | ${shortKey} |\n`);
    }
    md.appendMarkdown(`| Source | ${SOURCE_LABELS[source] || source} |\n`);
    md.appendMarkdown(`\n---\n`);
    md.appendMarkdown(`[Switch Profile](command:gitSwitcher.switchProfile) · `);
    md.appendMarkdown(`[Reset to Auto](command:gitSwitcher.resetToAuto) · `);
    md.appendMarkdown(`[Edit Profiles](command:gitSwitcher.editProfiles)`);

    return md;
  }

  private buildNoProfileTooltip(folderName?: string): vscode.MarkdownString {
    const md = new vscode.MarkdownString('', true);
    md.isTrusted = true;

    const folder = folderName ? ` for "${folderName}"` : '';
    md.appendMarkdown(`**Git Switcher — No Profile${folder}**\n\n`);
    md.appendMarkdown(`No profile is configured for this workspace. `);
    md.appendMarkdown(`Commits will use whatever identity is in your Git config.\n\n`);
    md.appendMarkdown(`---\n`);
    md.appendMarkdown(`[Create Profile](command:gitSwitcher.createProfile) · `);
    md.appendMarkdown(`[Assign Profile](command:gitSwitcher.switchProfile)`);

    return md;
  }
}
