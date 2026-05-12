import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execFile);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SSH_IGNORE_FILES = new Set([
  'known_hosts', 'known_hosts.old', 'config', 'authorized_keys',
  'authorized_keys.jcorig', 'agent', 'environment',
]);

export function expandHomePath(p: string): string {
  if (p.startsWith('~/') || p === '~') {
    return path.join(os.homedir(), p.slice(1));
  }
  return p;
}

export function validateEmail(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) { return 'Email is required'; }
  if (!EMAIL_REGEX.test(trimmed)) { return 'Enter a valid email address (e.g., you@example.com)'; }
  return null;
}

export function validateProfileName(value: string, existingNames: string[]): string | null {
  const trimmed = value.trim();
  if (!trimmed) { return 'Profile name is required'; }
  if (existingNames.includes(trimmed)) {
    return `A profile named "${trimmed}" already exists — it will be overwritten`;
  }
  return null;
}

export function validateSshKeyPath(value: string): string | null {
  if (!value.trim()) { return null; }
  const expanded = expandHomePath(value.trim());
  if (!fs.existsSync(expanded)) {
    return `File not found: ${expanded}`;
  }
  if (expanded.endsWith('.pub')) {
    return 'This looks like a public key (.pub). Select the private key instead (the file without .pub)';
  }
  return null;
}

export function validateDirectoryPath(value: string): string | null {
  if (!value.trim()) { return null; }
  const expanded = expandHomePath(value.trim());
  if (!fs.existsSync(expanded)) {
    return `Directory not found: ${expanded}`;
  }
  if (!fs.statSync(expanded).isDirectory()) {
    return 'This path is a file, not a directory';
  }
  return null;
}

export interface SshKeyItem {
  label: string;
  description: string;
  keyPath: string;
}

export function scanSshKeys(): SshKeyItem[] {
  const sshDir = path.join(os.homedir(), '.ssh');
  if (!fs.existsSync(sshDir)) { return []; }

  try {
    const files = fs.readdirSync(sshDir);
    return files
      .filter(f => {
        if (f.startsWith('.') || f.endsWith('.pub') || SSH_IGNORE_FILES.has(f)) {
          return false;
        }
        const fullPath = path.join(sshDir, f);
        if (!fs.statSync(fullPath).isFile()) { return false; }
        try {
          const firstLine = fs.readFileSync(fullPath, 'utf-8').split('\n')[0];
          return firstLine.includes('BEGIN') || firstLine.includes('OPENSSH');
        } catch {
          return false;
        }
      })
      .map(f => ({
        label: f,
        description: path.join('~/.ssh', f),
        keyPath: path.join(sshDir, f),
      }));
  } catch {
    return [];
  }
}

export async function detectGitIdentity(): Promise<{ name?: string; email?: string }> {
  try {
    const { stdout: name } = await exec('git', ['config', '--global', 'user.name']);
    const { stdout: email } = await exec('git', ['config', '--global', 'user.email']);
    return {
      name: name.trim() || undefined,
      email: email.trim() || undefined,
    };
  } catch {
    return {};
  }
}
