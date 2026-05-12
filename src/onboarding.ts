import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { GitProfile } from './types';
import { ProfileManager } from './profileManager';

interface IncludeIfEntry {
  condition: string;
  configPath: string;
  userName?: string;
  email?: string;
}

export class Onboarding {
  constructor(private profileManager: ProfileManager) {}

  async run(): Promise<void> {
    const entries = this.parseIncludeIfs();

    if (entries.length > 0) {
      await this.offerImport(entries);
    } else {
      await this.offerCreateProfile();
    }
  }

  private parseIncludeIfs(): IncludeIfEntry[] {
    const gitconfigPath = path.join(os.homedir(), '.gitconfig');
    if (!fs.existsSync(gitconfigPath)) { return []; }

    const content = fs.readFileSync(gitconfigPath, 'utf-8');
    const entries: IncludeIfEntry[] = [];

    const includeIfRegex = /\[includeIf\s+"gitdir:([^"]+)"\]\s*\n\s*path\s*=\s*(.+)/g;
    let match;

    while ((match = includeIfRegex.exec(content)) !== null) {
      const condition = match[1].trim();
      const configPath = this.expandHome(match[2].trim());

      const entry: IncludeIfEntry = { condition, configPath };

      if (fs.existsSync(configPath)) {
        const included = fs.readFileSync(configPath, 'utf-8');
        const emailMatch = included.match(/email\s*=\s*(.+)/);
        const nameMatch = included.match(/name\s*=\s*(.+)/);
        if (emailMatch) { entry.email = emailMatch[1].trim(); }
        if (nameMatch) { entry.userName = nameMatch[1].trim(); }
      }

      entries.push(entry);
    }

    return entries;
  }

  private async offerImport(entries: IncludeIfEntry[]): Promise<void> {
    const descriptions = entries
      .map(e => `  ${e.condition} → ${e.userName || '?'} <${e.email || '?'}>`)
      .join('\n');

    const action = await vscode.window.showInformationMessage(
      `Git Switcher found ${entries.length} existing includeIf rule(s) in your .gitconfig:\n${descriptions}\n\nImport them as profiles?`,
      'Import All',
      'Skip',
    );

    if (action !== 'Import All') {
      await this.offerCreateProfile();
      return;
    }

    let imported = 0;
    for (const entry of entries) {
      if (!entry.email || !entry.userName) { continue; }

      const name = await vscode.window.showInputBox({
        prompt: `Profile name for ${entry.email} (${entry.condition})`,
        value: this.suggestName(entry),
      });
      if (!name) { continue; }

      const profile: GitProfile = {
        name,
        email: entry.email,
        userName: entry.userName,
        directories: [this.expandHome(entry.condition)],
      };

      await this.profileManager.addProfile(profile);
      imported++;
    }

    if (imported > 0) {
      vscode.window.showInformationMessage(`Imported ${imported} profile(s) from .gitconfig.`);
    }
  }

  private async offerCreateProfile(): Promise<void> {
    const action = await vscode.window.showInformationMessage(
      'Welcome to Git Switcher! No profiles configured yet. Create your first profile?',
      'Create Profile',
      'Later',
    );

    if (action === 'Create Profile') {
      await vscode.commands.executeCommand('gitSwitcher.createProfile');
    }
  }

  private suggestName(entry: IncludeIfEntry): string {
    const dir = entry.condition.replace(/\/$/, '');
    const base = path.basename(dir);
    if (base.toLowerCase().includes('work') || base.toLowerCase().includes('company')) {
      return 'Work';
    }
    if (base.toLowerCase().includes('personal') || base.toLowerCase().includes('home')) {
      return 'Personal';
    }
    return base.charAt(0).toUpperCase() + base.slice(1);
  }

  private expandHome(p: string): string {
    if (p.startsWith('~/') || p === '~') {
      return path.join(os.homedir(), p.slice(1));
    }
    return p;
  }
}
