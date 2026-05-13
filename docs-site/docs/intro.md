---
sidebar_position: 1
slug: /
title: ▶️ Project Onboarding
---

# DiscountMate Onboarding Guide

Welcome to the **DiscountMate** project. This guide is designed to get you from a fresh install to a running development environment in the shortest time possible.

:::important 📺 MANDATORY WATCH: Onboarding Video
Please watch the full onboarding walkthrough before attempting the manual steps. This covers the logic behind our architecture.
<div className="video-container" style={{position: 'relative', width: '100%', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '8px', border: '2px solid #2e8555'}}>
  <iframe 
    src="https://deakin.au.panopto.com/Panopto/Pages/Embed.aspx?id=5dad0415-0685-46b6-9e4b-b3f900c6421b&autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=true&interactivity=all" 
    style={{
      position: 'absolute', 
      top: 0, 
      left: 0, 
      width: '100%', 
      height: '100%', 
      border: 'none'
    }} 
    allowFullScreen 
    allow="autoplay; fullscreen" 
  >
  </iframe>
</div>
:::


:::tip If the embed does not load
Open the video directly (select **High Quality**):

https://deakin.au.panopto.com/Panopto/Pages/Viewer.aspx?id=5dad0415-0685-46b6-9e4b-b3f900c6421b
:::

-------
_______________________

:::note macOS note 🍏
If any macOS commands below fail due to permissions or version conflicts, please contact the **senior leadership team** so we can update the onboarding steps for your setup.
:::

## 1. Environment Prerequisites

### 🟦🟦 Windows (PowerShell)

Open **PowerShell as Administrator**.

#### VSCode
```powershell
winget install --id Microsoft.VisualStudioCode -e
code --version
```

#### Python (v3.10)
```powershell
winget install --id Python.Python.3.10 -e
python --version
```

#### Git
```powershell
winget install --id Git.Git -e
git --version
```

#### Node.js
Download the Windows Installer (.msi):
https://nodejs.org/en/download

Verify:
```powershell
node --version
npm --version
```

---

### 🍏 macOS (Terminal)

Open **Terminal**.

#### Homebrew (only if you don’t already have it)
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

#### VSCode
```bash
brew install --cask visual-studio-code
code --version
```

#### Python (v3.10)
```bash
brew install python@3.10
python3.10 --version
```

#### Git
```bash
brew install git
git --version
```

#### Node.js
```bash
brew install node
node --version
npm --version
```

---

## 2. Project Initialization

### Create your workspace folder
Create a dedicated folder used **only** for DiscountMate development.

### Configure Git identity (Windows or macOS)
```bash
git config --global user.name "First Name Last Name"
git config --global user.email "your.deakin.email@example.com"
```

### Clone the repository

**🟦🟦 Windows example**
```powershell
cd "C:\Path\To\Your\Workspace"
git clone https://github.com/DataBytes-Organisation/DiscountMate_new.git
cd DiscountMate_new
```

**🍏 macOS example**
```bash
cd /Users/yourname/Path/To/Workspace
git clone https://github.com/DataBytes-Organisation/DiscountMate_new.git
cd DiscountMate_new
```

### Staying in sync (Upstream)

Add upstream once:
```bash
git remote add upstream https://github.com/DataBytes-Organisation/DiscountMate_new.git
```

Sync later:
```bash
git checkout main
git fetch upstream
git merge upstream/main
git push origin main
```

---

## 3. Python Virtual Environment (VENV)

**Use this if you prefer to work in virtual environments to isolate installs and dependencies**

### 🟦🟦 Windows (PowerShell)
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

In VSCode:
- `Ctrl + Shift + P` → **Python: Select Interpreter**
- Choose: `.venv\Scripts\python.exe`

### 🍏 macOS (Terminal)
```bash
python3.10 -m venv .venv
source .venv/bin/activate
```

In VSCode:
- `Cmd + Shift + P` → **Python: Select Interpreter**
- Choose: `.venv/bin/python`

### VSCode auto-activation (Windows)

Create `.vscode/settings.json`:
```json
{
  "python.defaultInterpreterPath": ".venv\\Scripts\\python.exe",
  "python.terminal.activateEnvironment": true
}
```

### VSCode auto-activation (macOS)

Create `.vscode/settings.json`:
```json
{
  "python.defaultInterpreterPath": ".venv/bin/python",
  "python.terminal.activateEnvironment": true
}
```

### Git exclusion (recommended)

**🟦🟦 Windows (PowerShell)**
```powershell
if (!(Test-Path ".git\info")) { New-Item -ItemType Directory ".git\info" | Out-Null }
Add-Content ".git\info\exclude" ".venv/"
Add-Content ".git\info\exclude" ".vscode/"
```

**🍏 macOS (Terminal)**
```bash
mkdir -p .git/info
echo ".venv/" >> .git/info/exclude
echo ".vscode/" >> .git/info/exclude
```

---

## 4. Running the Application

### Backend (Node.js)
```bash
cd Backend
npm install
npm start
```

:::tip Troubleshooting
If you encounter a router error, add `signupLimiter: limiter` to `user.controller.js` in `Backend/src` (as per the onboarding video).
:::

### Frontend (React / Expo)
Open a **second** terminal:
```bash
cd Frontend
npm install
npx expo start
```

Open in browser:
http://localhost:8081

---

## 5. Database Access (MongoDB)

Access is granted by the **Academic Mentor**. Once invited, you’ll receive:
- Username
- Password

Create a `.env` file inside `Backend/` (do **not** commit it to GitHub).

---


