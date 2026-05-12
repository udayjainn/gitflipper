# Git Switcher

A VS Code extension that automatically switches your Git identity (name, email, SSH key) based on your workspace directory. Stop committing to your work repo with your personal email, or vice versa.

## The Problem

If you use one machine for both work and personal projects, you've probably:

- Accidentally committed to a work repo as `personaluser@gmail.com`
- Pushed to a personal repo with your corporate SSH key and had it rejected
- Manually edited `.gitconfig` every time you switched contexts
- Had your personal email show up in your company's commit history

Git Switcher eliminates all of this. You configure your profiles once, map them to directories, and the extension handles the rest automatically.

## Features

### Automatic Identity Switching

Define directory rules per profile. When you open a workspace, Git Switcher detects which directory you're in and applies the correct Git identity to the repo's local config.

```
~/work/         -> Work profile  (you@company.com)
~/personal/     -> Personal profile (you@gmail.com)
```

### Status Bar Indicator

Always know which identity is active. The status bar shows:

| Icon | Meaning |
|------|---------|
| $(check) | Profile auto-detected from directory rules |
| $(pencil) | Manual override is active |
| $(info) | Using default profile (no directory match) |
| $(alert) | No profile configured for this workspace |

In multi-root workspaces, the status bar also shows which folder it refers to.

### Pre-Commit Identity Guard

A git `pre-commit` hook is automatically installed that blocks commits when your identity doesn't match the expected profile. You'll see a clear error message:

```
[Git Switcher] Identity mismatch!
Expected: Uday Jain <uday.jain@flexspring.com>
Current:  udayjainn <udayjain00@gmail.com>

Run 'Git Switcher: Switch Profile' in VS Code to fix.
Or use --no-verify to bypass this check.
```

### SSH Key Coordination

Each profile can specify an SSH key. When the profile activates, the extension ensures the correct key is used for Git operations. Two strategies are supported:

- **`GIT_SSH_COMMAND`** (default) — Sets an environment variable in VS Code's integrated terminal. Safe, scoped to VS Code, no side effects.
- **`ssh-agent`** — Adds/removes keys from your system's SSH agent. Works system-wide but affects all terminal sessions.

### Multi-Root Workspace Support

Each folder in a multi-root workspace resolves its profile independently. You can have `~/work/api` using your Work profile and `~/personal/blog` using your Personal profile, open in the same VS Code window. The status bar updates as you switch between files.

### First-Run Onboarding

On first activation, Git Switcher:

1. Scans your `~/.gitconfig` for existing `includeIf` directives
2. Offers to import them as profiles automatically
3. If none are found, walks you through creating your first profile

## Installation

### From Source

```bash
git clone https://github.com/udayjainn/git-switcher.git
cd git-switcher
npm install
npm run compile
```

Then in VS Code, press `F5` to launch the Extension Development Host, or run:

```bash
code --extensionDevelopmentPath=/path/to/git-switcher
```

### Package as VSIX

```bash
npx vsce package
code --install-extension git-switcher-0.1.0.vsix
```

## Configuration

All configuration lives in VS Code settings under the `gitSwitcher` namespace.

### Profiles

Add profiles in your VS Code `settings.json`:

```jsonc
{
  "gitSwitcher.profiles": [
    {
      "name": "Work",
      "email": "you@company.com",
      "userName": "Your Name",
      "sshKeyPath": "~/.ssh/id_ed25519_work",
      "directories": [
        "~/work",
        "~/company-repos"
      ]
    },
    {
      "name": "Personal",
      "email": "you@gmail.com",
      "userName": "yourgithubusername",
      "sshKeyPath": "~/.ssh/id_ed25519_personal",
      "directories": [
        "~/personal",
        "~/oss"
      ]
    }
  ]
}
```

### Profile Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Display name for the profile (e.g., "Work", "Personal") |
| `email` | Yes | Git user email |
| `userName` | Yes | Git user name |
| `sshKeyPath` | No | Path to SSH private key |
| `directories` | No | Array of directory paths for auto-matching |

### Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `gitSwitcher.profiles` | `[]` | Array of Git identity profiles |
| `gitSwitcher.defaultProfile` | `""` | Fallback profile name when no directory rule matches |
| `gitSwitcher.autoSwitch` | `true` | Automatically apply the matching profile on workspace open |
| `gitSwitcher.warnOnMismatch` | `true` | Show a warning when repo identity differs from expected profile |
| `gitSwitcher.sshStrategy` | `GIT_SSH_COMMAND` | SSH key switching strategy (`GIT_SSH_COMMAND` or `ssh-agent`) |

## Commands

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and type "Git Switcher":

| Command | Description |
|---------|-------------|
| `Git Switcher: Show Active Profile` | Display the current identity, source, and matched profile |
| `Git Switcher: Switch Profile` | Pick a profile from a quick-pick list to override the auto-detected one |
| `Git Switcher: Edit Profiles` | Open VS Code settings filtered to `gitSwitcher.profiles` |
| `Git Switcher: Create Profile` | Step-by-step walkthrough to create a new profile |
| `Git Switcher: Reset to Auto` | Remove the manual override and revert to directory-based detection |
| `Git Switcher: Remove Pre-Commit Hooks` | Remove all pre-commit hooks installed by Git Switcher |

## How It Works

### Profile Resolution Order

When a workspace opens, Git Switcher resolves the active profile using this priority:

1. **Manual override** — If you used "Switch Profile" for this workspace, that choice is remembered
2. **Directory matching** — Longest-prefix match against the `directories` configured in each profile
3. **Repo-local config** — If the repo already has a local `user.email` that matches a profile
4. **Default profile** — The profile named in `gitSwitcher.defaultProfile`

If nothing matches, the status bar shows "No Profile" with a warning indicator.

### What It Modifies

- **Repo-local git config** — Sets `user.name` and `user.email` via `git config --local`. This is standard Git behavior and only affects the specific repo.
- **VS Code terminal environment** — Sets `GIT_SSH_COMMAND` so the integrated terminal uses the correct SSH key.
- **Pre-commit hook** — Installs a lightweight shell script in `.git/hooks/pre-commit`. If a hook already exists, it appends rather than overwrites.

### What It Does NOT Modify

- Your global `~/.gitconfig` is never touched
- Your `~/.ssh/config` is never modified
- No data is sent over the network
- No telemetry of any kind

## Project Structure

```
git-switcher/
├── src/
│   ├── extension.ts           # Entry point, command registration, lifecycle
│   ├── types.ts               # GitProfile, ResolvedProfile, SshStrategy
│   ├── profileManager.ts      # CRUD on profiles + interactive create wizard
│   ├── profileResolver.ts     # Resolution chain: override -> directory -> repo -> default
│   ├── gitConfigWriter.ts     # Writes user.name/email to repo-local .git/config
│   ├── sshKeyManager.ts       # GIT_SSH_COMMAND and ssh-agent strategies
│   ├── statusBarController.ts # Status bar rendering with folder-aware display
│   ├── preCommitGuard.ts      # Installs/manages pre-commit identity check hook
│   └── onboarding.ts          # First-run includeIf import and profile wizard
├── package.json               # Extension manifest, settings schema, commands
└── tsconfig.json
```

## Platform Support

| Platform | Status | Notes |
|----------|--------|-------|
| Linux | Full support | — |
| macOS | Full support | Keychain integration for SSH passphrases works out of the box |
| Windows | Full support | Uses `%USERPROFILE%` paths, works with OpenSSH |

## Typical Setup Example

A developer with work (Bitbucket) and personal (GitHub) repos on the same machine:

**1. Generate SSH keys for each identity:**

```bash
ssh-keygen -t ed25519 -C "you@company.com" -f ~/.ssh/id_work
ssh-keygen -t ed25519 -C "you@gmail.com" -f ~/.ssh/id_personal
```

**2. Configure `~/.ssh/config`:**

```
Host bitbucket.org
  IdentityFile ~/.ssh/id_work

Host github.com
  IdentityFile ~/.ssh/id_personal
```

**3. Add profiles in VS Code settings:**

```jsonc
{
  "gitSwitcher.profiles": [
    {
      "name": "Work",
      "email": "you@company.com",
      "userName": "Your Name",
      "sshKeyPath": "~/.ssh/id_work",
      "directories": ["~/work"]
    },
    {
      "name": "Personal",
      "email": "you@gmail.com",
      "userName": "yourgithub",
      "sshKeyPath": "~/.ssh/id_personal",
      "directories": ["~/personal"]
    }
  ],
  "gitSwitcher.defaultProfile": "Personal"
}
```

**4. Done.** Open any repo under `~/work/` and Git Switcher applies your Work identity. Open anything under `~/personal/` and it switches to Personal. The status bar always shows which identity is active.

## Contributing

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Run `npm run compile` to verify the build
5. Open a PR

## License

ISC
