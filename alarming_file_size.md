# alarming_file_size.md

## Detecting and Removing Large Files from Your Git Repository

Large files in a git repository can cause performance issues, slow down pushes and pulls, and may even prevent you from pushing to remote repositories (e.g., GitHub's 100MB file limit). This guide explains how to detect, remove, and prevent large files in your git project.

---

### 1. Detecting Large Files

To find files over 30MB in your project directory:

```bash
find . -type f -size +30M -exec ls -lh {} \;
```

To check if any large files are tracked by git:

```bash
git ls-files | xargs -I{} du -h {} | sort -rh | head -20
```

---

### 2. Removing Large Files from Git Tracking

If a large file is tracked by git, remove it from the index (but keep it locally):

```bash
git rm --cached path/to/largefile
```

Commit the change:

```bash
git commit -m "Remove large file from tracking"
```

---

### 3. Removing Large Files from Git History

If a large file was previously committed, you must remove it from the entire git history:

```bash
git filter-branch --force --index-filter 'git rm --cached --ignore-unmatch path/to/largefile' --prune-empty --tag-name-filter cat -- --all
```

After running the above, clean up your repository:

```bash
rm -rf .git/refs/original/
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

Then force-push to your remote:

```bash
git push --force origin main
```

> **Note:** This rewrites history. All collaborators must re-clone or reset their local repositories.

---

### 4. Preventing Large Files from Being Tracked

Update your `.gitignore` to exclude large or binary files:

```gitignore
# Large assets
*.rar
*.zip
*.7z
*.tar
*.gz
*.bz2
*.xz
*.iso
*.img
*.vmdk
*.vhd
*.vhdx
*.qcow2
*.raw
*.bin
*.dat
*.dump
*.bak
*.backup
*.swp
*.swo
*~

# Dependencies
node_modules/
**/node_modules/
```

---

### 5. Best Practices

- Never commit large binaries or archives to git. Use a file sharing service or Git LFS if needed.
- Regularly check your repository for large files.
- Use `.gitignore` to prevent accidental commits of large or unnecessary files.
- Communicate with your team before rewriting git history.

---

**References:**
- [GitHub: Removing files from a repository's history](https://docs.github.com/en/github/authenticating-to-github/removing-sensitive-data-from-a-repository)
- [git filter-branch documentation](https://git-scm.com/docs/git-filter-branch)
- [BFG Repo-Cleaner (alternative tool)](https://rtyley.github.io/bfg-repo-cleaner/) 