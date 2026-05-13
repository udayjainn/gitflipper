hw`## Why Git Identities Matter

When you commit code with Git, every commit records **your name and email**. If you use one computer for both work and personal projects, it's easy to accidentally commit with the wrong identity.

**Common problems this causes:**

- Your personal email shows up in your company's commit history
- Your work email appears on your open-source contributions
- Pushing fails because the wrong SSH key is used for authentication

**How GitFlipper helps:**

You create **profiles** — each one stores a name, email, and optionally an SSH key. Then you tell GitFlipper which folders belong to which profile. When you open a project, it automatically sets the right identity.

No more manual `git config` commands. No more wrong-email commits.
