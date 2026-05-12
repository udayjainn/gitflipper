import * as os from 'os';
import * as path from 'path';
import { SimpleGit } from 'simple-git';
import { GitProfile, ResolvedProfile } from './types';
import { ProfileManager } from './profileManager';

export class ProfileResolver {
  constructor(private profileManager: ProfileManager) {}

  async resolve(workspacePath: string, git: SimpleGit, manualOverride?: string): Promise<ResolvedProfile | undefined> {
    if (manualOverride) {
      const profile = this.profileManager.findByName(manualOverride);
      if (profile) {
        return { profile, source: 'manual-override' };
      }
    }

    const dirMatch = this.resolveByDirectory(workspacePath);
    if (dirMatch) {
      return { profile: dirMatch, source: 'directory-match' };
    }

    const repoLocal = await this.resolveFromRepoConfig(git);
    if (repoLocal) {
      return { profile: repoLocal, source: 'repo-local' };
    }

    const defaultProfile = this.profileManager.getDefaultProfile();
    if (defaultProfile) {
      return { profile: defaultProfile, source: 'default' };
    }

    return undefined;
  }

  private resolveByDirectory(workspacePath: string): GitProfile | undefined {
    const normalized = this.normalizePath(this.expandHome(workspacePath));
    const profiles = this.profileManager.getProfiles();

    let bestMatch: GitProfile | undefined;
    let bestLength = 0;

    for (const profile of profiles) {
      if (!profile.directories) { continue; }
      for (const dir of profile.directories) {
        const expandedDir = this.normalizePath(this.expandHome(dir));
        if (normalized.startsWith(expandedDir) && expandedDir.length > bestLength) {
          bestMatch = profile;
          bestLength = expandedDir.length;
        }
      }
    }

    return bestMatch;
  }

  private async resolveFromRepoConfig(git: SimpleGit): Promise<GitProfile | undefined> {
    try {
      const email = await git.getConfig('user.email', 'local');
      const name = await git.getConfig('user.name', 'local');
      if (email.value && name.value) {
        const profiles = this.profileManager.getProfiles();
        return profiles.find(p => p.email === email.value);
      }
    } catch {
      // no local config set
    }
    return undefined;
  }

  private expandHome(p: string): string {
    if (p.startsWith('~/') || p === '~') {
      return path.join(os.homedir(), p.slice(1));
    }
    return p;
  }

  private normalizePath(p: string): string {
    const resolved = path.resolve(p);
    return resolved.endsWith('/') ? resolved : resolved + '/';
  }
}
