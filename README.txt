NEXUS Launcher v0.3.0
Electron + npm Minecraft launcher

========================================
Requirements
========================================
- Windows 10/11 (or Linux/macOS with Node)
- Node.js 22.12 or newer (with npm)
- Internet (for npm and Minecraft / Java downloads)

========================================
Install
========================================
1. Extract this ZIP to any folder.
2. Run install.bat  (or in terminal: npm install)
3. Run start.bat    (or: npm start)

========================================
Features
========================================
* Builds tab
  - Create build: name, Minecraft version, loader (Vanilla / Fabric / Forge / NeoForge / Quilt), RAM
  - Each build has its own folder (mods, logs, config, saves...)
  - Separate logs only for that build

* Buttons
  - Play  - offline launch with selected nickname and build RAM
  - Details - full info, mods, logs, RAM settings, delete

* Profile
  - Offline nickname (3-16 chars: a-z, 0-9, _)

* Auto-install
  - Click "Install / verify files" and the launcher (via @loontail/minecraft-kit):
    - downloads the needed Minecraft version
    - installs the selected loader
    - installs the matching Java runtime
  - User does not need to download anything extra

========================================
Notes
========================================
* Offline mode works for singleplayer, LAN and offline-mode servers.
  Online-mode servers need a Microsoft account.
* If install or launch fails - open the Logs tab of that build.
* Data is stored in %APPDATA%/NEXUS (Windows) / Electron userData.

Progress bar visual transition: 1ms linear. Progress values come from actual installer events; display refresh is limited by Electron/OS rendering and incoming progress events.
