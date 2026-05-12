## Set Up Directory Rules

Directory rules are what make Git Switcher automatic. You map folders to profiles, and the extension handles the rest.

**Example setup:**

| Folder | Profile | Identity |
|--------|---------|----------|
| `~/work/` | Work | jane@company.com |
| `~/personal/` | Personal | jane@gmail.com |

Any project opened under `~/work/` will automatically use your Work identity. Any project under `~/personal/` will use your Personal identity.

**How to add directory rules:**

- During profile creation (Step 5 of the wizard)
- Or in Settings: search for `gitSwitcher.profiles` and edit the `directories` array

**Tips:**
- Use parent directories — `~/work/` will match `~/work/project-a/`, `~/work/project-b/`, etc.
- If a folder matches multiple profiles, the most specific (longest) path wins
- Folders without a match will use your default profile, if you've set one
