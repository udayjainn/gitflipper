## Verify It Works

Once you've created profiles, here's how to confirm everything is set up correctly.

**Check the status bar:**

Look at the bottom-left of VS Code. You should see something like:

`✓ Git: Work (you@company.com)`

The icon tells you how the profile was selected:
- **✓** — Auto-detected from your directory rules
- **✏️** — You manually picked this profile
- **ℹ** — Using the default profile (no directory match)
- **⚠** — No profile matched — you should set one up

**Test with a commit:**

1. Make a small change in a repo
2. Commit it
3. Run `git log --format="%an <%ae>" -1` in the terminal to verify the name and email

**Quick commands:**
- `GitFlipper: Show Active Profile` — see full details about the current identity
- `GitFlipper: Switch Profile` — manually override the auto-detected profile
- `GitFlipper: Reset to Auto` — go back to automatic detection
