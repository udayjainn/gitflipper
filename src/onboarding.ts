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

  /** Returns true if the user completed onboarding, false if dismissed. */
  async run(): Promise<boolean> {
    const entries = this.parseIncludeIfs();

    if (entries.length > 0) {
      return await this.offerImport(entries);
    } else {
      return await this.offerCreateProfile();
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

  private async offerImport(entries: IncludeIfEntry[]): Promise<boolean> {
    const validEntries = entries.filter(e => e.email && e.userName);
    if (validEntries.length === 0) {
      return await this.offerCreateProfile();
    }

    const labels = validEntries
      .map(e => `${this.suggestName(e)}: ${e.userName} <${e.email}>`)
      .join(', ');

    const action = await vscode.window.showInformationMessage(
      `Git Switcher found ${validEntries.length} identity rule(s) in .gitconfig: ${labels}. Import as profiles?`,
      'Import All',
      'Skip',
    );

    if (!action) { return false; }

    if (action === 'Skip') {
      return await this.offerCreateProfile();
    }

    const usedNames = new Set<string>();
    let imported = 0;

    for (const entry of validEntries) {
      let name = this.suggestName(entry);
      while (usedNames.has(name)) {
        name = `${name} (${entry.email})`;
      }
      usedNames.add(name);

      const profile: GitProfile = {
        name,
        email: entry.email!,
        userName: entry.userName!,
        directories: [this.expandHome(entry.condition)],
      };

      await this.profileManager.addProfile(profile);
      imported++;
    }

    if (imported > 0) {
      vscode.window.showInformationMessage(`Imported ${imported} profile(s).`);
    }
    return true;
  }

  private async offerCreateProfile(): Promise<boolean> {
    const action = await vscode.window.showInformationMessage(
      'Welcome to Git Switcher! No profiles configured yet. Create your first profile?',
      'Create Profile',
      'Later',
    );

    if (action === 'Create Profile') {
      await vscode.commands.executeCommand('gitSwitcher.createProfile');
      return true;
    }

    return false;
  }

  private suggestName(entry: IncludeIfEntry): string {
    const dir = entry.condition.replace(/\/$/, '');
    const base = path.basename(dir);
    const lower = base.toLowerCase();
    if (lower.includes('work') || lower.includes('company') || lower.includes('corp')) {
      return 'Work';
    }
    if (lower.includes('personal') || lower.includes('home')) {
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
