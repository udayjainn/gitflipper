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
    const validEntries = entries.filter(e => e.email && e.userName);
    if (validEntries.length === 0) {
      await this.offerCreateProfile();
      return;
    }

    const labels = validEntries
      .map(e => `${this.suggestName(e)}: ${e.userName} <${e.email}>`)
      .join(', ');

    const action = await vscode.window.showInformationMessage(
      `Git Switcher found ${validEntries.length} identity rule(s) in .gitconfig: ${labels}. Import as profiles?`,
      'Import All',
      'Skip',
    );

    if (action !== 'Import All') {
      if (action === 'Skip') {
        await this.offerCreateProfile();
      }
      return;
    }

    let imported = 0;
    for (const entry of validEntries) {
      const suggestedName = this.suggestName(entry);
      const profile: GitProfile = {
        name: suggestedName,
        email: entry.email!,
        userName: entry.userName!,
        directories: [this.expandHome(entry.condition)],
      };

      await this.profileManager.addProfile(profile);
      imported++;
    }

    if (imported > 0) {
      vscode.window.showInformationMessage(`Imported ${imported} profile(s): ${validEntries.map(e => this.suggestName(e)).join(', ')}.`);
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
