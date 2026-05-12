import { SimpleGit } from 'simple-git';
import { GitProfile } from './types';

export class GitConfigWriter {
  async applyProfile(profile: GitProfile, git: SimpleGit): Promise<void> {
    await git.addConfig('user.name', profile.userName, false, 'local');
    await git.addConfig('user.email', profile.email, false, 'local');
  }

  async getCurrentRepoIdentity(git: SimpleGit): Promise<{ name?: string; email?: string }> {
    try {
      const name = await git.getConfig('user.name', 'local');
      const email = await git.getConfig('user.email', 'local');
      return { name: name.value || undefined, email: email.value || undefined };
    } catch {
      return {};
    }
  }
}
