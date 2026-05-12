export interface GitProfile {
  name: string;
  email: string;
  userName: string;
  sshKeyPath?: string;
  directories?: string[];
}

export type SshStrategy = 'GIT_SSH_COMMAND' | 'ssh-agent';

export interface ResolvedProfile {
  profile: GitProfile;
  source: 'manual-override' | 'directory-match' | 'repo-local' | 'default';
}
