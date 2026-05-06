---
title: "How To: Docusaurus Guide"
sidebar_label: "How To: Docusaurus Guide"
sidebar_position: 3
---

# Docusauras Walkthrough Guide

## Creating new sub sections

Most the of sub teams already have general subfolders available. These have been setup and for most of the time you will just add new markdown files within your relevant team.

However if you wish to create another section beyond what is already built out then do the following:
- Navigate to the `docs-site\docs\ directory`.
- Right click and add new folder
- Add the `_category_.json` for into that folder and fill out the relevant details as this determines the side bar formatting

Alternatively copy in full one of the exiting folder and delete out anything you don’t need keeping the `\img\` folder and the `_category_.json` folder.

![New Section](img\newsections.png "adding new folder")

## Creating Markdowns 
Once here right click 'add new file' and then add your .md or .mdx files. Alternatively navigate here and copy the template.

`docs-site\docs\Templates & Examples\documarkdown_copy_paste_template.md`

If you need more complex features then check out the .mdx format. There is a cheat sheet embedded within that document and added here again. MDX allows embedding react components directly within markdown. 

[Docusaurus MD and MDX Cheat Sheet](https://docs.flashbots.net/cheatsheet)

## Editing Markdowns

It's recommended that you copy the markdown template from templates folder. once copied to your relevant section change the name and the meta details at the top of the file. 
Start writing and utilising any of the pre-filled formatting. Once done delete anything you've not used and clean the document up. Alternatively, have two windows open and copy relevant markdown styling formats over to your markdown as needed.

![New Section](img\markdownformat.png "editing markdowns")

## Running Docusaurus Locally

### First-Time Setup

If this is your **first time** running the docs site on your machine, you need to install the dependencies before anything else.

1. **Open a terminal** (PowerShell or Command Prompt) and navigate to the `docs-site` folder:
   ```powershell
   cd docs-site
   ```

2. **Install dependencies** — this only needs to be done once (or after pulling major changes):
   ```powershell
   npm install
   ```

3. **Start the local dev server:**
   ```powershell
   npm start
   ```

Your browser should automatically open at `http://localhost:3000`. The dev server hot-reloads as you save changes — no need to restart it.

---

### Returning User (Already Set Up)

If you've run the site before on this machine, all you need to do is:

```powershell
cd docs-site
npm start
```

That's it. No build step required for local previewing.

---

## Testing before submission (Pre-Flight Check)

:::caution Run a production build before pushing

The local dev server (`npm start`) is forgiving and will not catch all errors. The GitHub Action **will fail** if there is a single broken link — always verify with a production build first.

:::

**Step 1: Stop your dev server** (`Ctrl + C` in the terminal).

**Step 2: Run the production build:**
```powershell
cd docs-site
npm run build
```

**Step 3: Check the result:**
- ✅ If it completes and says **"Success"** — you are safe to push.
- ❌ If it throws a red error about a **"Broken Link"** — fix that link in your Markdown files before pushing.

:::tip Re-start the dev server after fixing

After fixing any broken links, you can run `npm start` again to continue editing. Run `npm run build` one more time before your final push to confirm everything passes.

:::


