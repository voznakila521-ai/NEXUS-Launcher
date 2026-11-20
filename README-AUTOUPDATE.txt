NEXUS Launcher 0.4.0

Development:
  npm install
  npm run start

Build Windows installer (.exe):
  npm install
  npm run dist:win

Output: release/NEXUS Launcher Setup 0.4.0.exe

AUTO-UPDATE SETUP REQUIRED:
1) Create a public GitHub repository for releases.
2) In package.json, replace YOUR_GITHUB_USERNAME with the repository owner.
   Ensure repo name is NEXUS-Launcher or update the repo field.
3) Bump package.json version for every release (e.g. 0.4.0 -> 0.4.1).
4) Build with: npm run dist:win
5) Publish the generated installer and latest.yml as a GitHub Release.
   electron-builder is configured to publish using GitHub if you set GH_TOKEN.

Updater behavior: app checks for updates on startup; user must approve download.
After download, user must approve installation/restart. NSIS installer replaces
the installed app. It does not delete userData (builds, mods, saves, logs).
Do not distribute unsigned or untrusted update files.
