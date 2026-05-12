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

### Getting Started Walkthrough

New to Git Switcher? Run **Git Switcher: Getting Started** from the Command Palette to open an interactive 4-step walkthrough:

1. **Why Git Identities Matter** — plain English explanation, no Git expertise required
2. **Create Your First Profile** — guided wizard with auto-detection
3. **Set Up Directory Rules** — learn how auto-switching works
4. **Verify It Works** — check the status bar and test with a commit

### Guided Profile Creation

The **Create Profile** wizard walks you through 5 steps with helpful defaults:

| Step | What it does |
|------|-------------|
| 1. Profile name | Give it a label like "Work" or "Personal" |
| 2. Git name | Pre-filled from your global Git config |
| 3. Git email | Pre-filled from your global Git config, validated |
| 4. SSH key | Auto-detects keys from `~/.ssh/` — pick from a list, browse, or skip |
| 5. Directories | Select your current workspace, browse, type a path, or skip |

After all steps, you see a summary confirmation. Once created, the extension tells you what was configured and what to do next.

### Automatic Identity Switching

Define directory rules per profile. When you open a workspace, Git Switcher detects which directory you're in and applies the correct Git identity to the repo's local config.

```
~/work/         -> Work profile  (you@company.com)
~/personal/     -> Personal profile (you@gmail.com)
```

### Smart Notifications

Git Switcher keeps you informed without being noisy:

- **Profile applied** — confirms which identity was set when you open a project
- **SSH key active** — tells you which key is being used for terminal Git operations
- **No profile match** — warns you with buttons to create or assign a profile
- **Identity mismatch** — alerts when switching from a different identity

Each notification shows at most once per session to avoid spam.

### Status Bar Indicator

Always know which identity is active. Click the status bar item to switch profiles.

| Icon | Meaning |
|------|---------|
| :white_check_mark: | Profile auto-detected from directory rules |
| :pencil2: | Manual override is active |
| :information_source: | Using default profile (no directory match) |
| :warning: | No profile configured for this workspace |

**Hover for details:** The tooltip shows your full profile info (name, email, SSH key, how it was selected) and includes clickable links to Switch Profile, Reset to Auto, and Edit Profiles.

In multi-root workspaces, the status bar also shows which folder it refers to.

### Pre-Commit Identity Guard

A git `pre-commit` hook is automatically installed that blocks commits when your identity doesn't match the expected profile:

```
========================================
  Commit blocked by Git Switcher
========================================

  Your current Git identity does not match
  the profile configured for this repository.

  Expected identity:
    Your Name <you@company.com>

  Your current identity:
    yourgithub <you@gmail.com>

  How to fix this:
    1. In VS Code, press Ctrl+Shift+P (or Cmd+Shift+P on Mac)
    2. Type: Git Switcher: Switch Profile
    3. Select the correct profile

  To bypass this check (not recommended):
    git commit --no-verify
```

### SSH Key Coordination

Each profile can specify an SSH key. When the profile activates, the extension ensures the correct key is used for Git operations. Two strategies are supported:

- **`GIT_SSH_COMMAND`** (default) — Sets an environment variable in VS Code's integrated terminal. Safe, scoped to VS Code, no side effects.
- **`ssh-agent`** — Adds/removes keys from your system's SSH agent. Works system-wide but affects all terminal sessions.

### Multi-Root Workspace Support

Each folder in a multi-root workspace resolves its profile independently. You can have `~/work/api` using your Work profile and `~/personal/blog` using your Personal profile, open in the same VS Code window. The status bar and SSH key update as you switch between files.

### First-Run Onboarding

On first activation, Git Switcher:

1. Shows a welcome notification with options to **Get Started** (walkthrough), **Create Profile**, or dismiss
2. Scans your `~/.gitconfig` for existing `includeIf` directives
3. Offers to import them as profiles automatically with a clear explanation
4. If none are found, guides you through creating your first profile

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

All configuration lives in VS Code settings under the `gitSwitcher` namespace. Every setting includes rich descriptions with examples — open Settings and search for `gitSwitcher` to explore.

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

Or use the **Git Switcher: Create Profile** command for a guided wizard that auto-detects your Git config and SSH keys.

### Profile Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Display name for the profile (e.g., "Work", "Personal") |
| `email` | Yes | Git user email — this appears on every commit |
| `userName` | Yes | Git user name — this appears on every commit |
| `sshKeyPath` | No | Path to SSH **private** key (the file without `.pub`) |
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
| `Git Switcher: Getting Started` | Open the interactive walkthrough (great for new users) |
| `Git Switcher: Create Profile` | Guided 5-step wizard to create a new profile |
| `Git Switcher: Show Active Profile` | Display the current identity, source, and matched profile |
| `Git Switcher: Switch Profile` | Pick a profile from a quick-pick list to override the auto-detected one |
| `Git Switcher: Edit Profiles` | Open VS Code settings filtered to `gitSwitcher.profiles` |
| `Git Switcher: Reset to Auto` | Remove the manual override and revert to directory-based detection |
| `Git Switcher: Remove Pre-Commit Hooks` | Remove all pre-commit hooks installed by Git Switcher |

## How It Works

### Profile Resolution Order

When a workspace opens, Git Switcher resolves the active profile using this priority:

1. **Manual override** — If you used "Switch Profile" for this workspace, that choice is remembered
2. **Directory matching** — Longest-prefix match against the `directories` configured in each profile
3. **Repo-local config** — If the repo already has a local `user.email` that matches a profile
4. **Default profile** — The profile named in `gitSwitcher.defaultProfile`

If nothing matches, the status bar shows "No Profile" with a warning, and a notification offers to create or assign one.

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
│   ├── validation.ts          # Shared validation, path expansion, SSH key scanning
│   ├── notifications.ts       # Centralized user-facing messages with session dedup
│   ├── profileManager.ts      # CRUD on profiles + guided create wizard
│   ├── profileResolver.ts     # Resolution chain: override -> directory -> repo -> default
│   ├── gitConfigWriter.ts     # Writes user.name/email to repo-local .git/config
│   ├── sshKeyManager.ts       # GIT_SSH_COMMAND and ssh-agent strategies
│   ├── statusBarController.ts # Status bar with rich MarkdownString tooltips
│   ├── preCommitGuard.ts      # Pre-commit identity check hook
│   └── onboarding.ts          # First-run includeIf import and walkthrough
├── media/
│   └── walkthrough/           # Getting Started walkthrough content
│       ├── understand.md
│       ├── create-profile.md
│       ├── directory-rules.md
│       └── verify.md
├── package.json               # Extension manifest, settings schema, walkthroughs
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

**3. Add profiles in VS Code settings (or use the Create Profile wizard):**

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
