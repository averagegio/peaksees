# Phone workflow: Termius (git + deploy) + browser (site + editor)

You use **three different apps** on your phone. They are not the same thing.

| What you want | App on phone | URL / tool |
|---------------|--------------|------------|
| Run commands, git, deploy | **Termius** (green terminal) | SSH to your PC |
| See the website while developing | **Safari / Chrome** | `http://YOUR-PC-IP:3000` |
| Edit code with a file tree (like VS Code) | **Safari / Chrome** | `https://YOUR-PC-IP:8443` |

**Termius will never show an editor.** If you only want git + deploy, skip section 4 entirely and use **Cursor on your PC** for editing.

Replace `YOUR-PC-IP` with your Wi‑Fi IPv4 from Windows `ipconfig` (example: `192.168.12.132`). Phone and PC must be on the **same Wi‑Fi**.

Repo folder (same on PC and WSL): `/mnt/c/Users/Owner/peaksees` = `C:\Users\Owner\peaksees`

---

## 1. Termius host (recap)

| Field | Value |
|--------|--------|
| Address | PC Wi‑Fi IPv4 (`ipconfig` on Windows) |
| Port | `2222` (WSL SSH port forward) |
| User | `owner` |
| Key | Your Termius-generated SSH key |

**Startup snippet — leave empty (recommended)**

The snippet is the usual bottleneck: `tmux attach` on connect often leaves the phone with **no prompt**, **nano**, or a **dead session** before you can type anything.

| Snippet | Use when |
|---------|----------|
| **(empty)** | Default — connect always works; run commands yourself |
| `cd /mnt/c/Users/Owner/peaksees` | Optional — only auto-`cd` into the repo |
| ~~`tmux attach …`~~ | **Avoid** in the snippet — run tmux manually after connect |

**After you connect** (paste once per session if snippet is empty):

```bash
cd /mnt/c/Users/Owner/peaksees
tm peaksees
```

(`tm` is defined in `~/.bashrc`; it attaches or creates the `peaksees` tmux session.)

---

## 2. Git + deploy from the phone (simple)

**One command** (after `cd` to repo if needed):

```bash
bash scripts/phone-push.sh "fix: describe your change"
```

Or with default message:

```bash
bash scripts/phone-push.sh
```

That runs `git add -A`, `git commit`, `git pull --rebase origin main`, then `git push origin main`. Vercel deploys from `main` like always.

If push says **rejected (fetch first)**, someone merged a PR on GitHub while you had local commits — run `git pull --rebase origin main` then `git push origin main` (or run `phone-push.sh` again after the script update).

**First time in WSL:** configure git if prompted:

```bash
git config --global user.email "you@example.com"
git config --global user.name "Your Name"
```

**GitHub auth in WSL:** use a [Personal Access Token](https://github.com/settings/tokens) over HTTPS, or add an SSH key to GitHub and use `git remote -v` (SSH URL).

**GitHub CLI (`gh`) in WSL** (for `gh pr create` from Termius):

```bash
# One-time on PC in Ubuntu (installs to ~/.local/bin, no apt/sudo):
bash /mnt/c/Users/Owner/peaksees/scripts/setup-gh-wsl.sh
```

Then from the repo (feature branch, not `main`):

```bash
cd /mnt/c/Users/Owner/peaksees
git checkout -b my-feature    # or push an existing branch
git push -u origin HEAD
export PATH="$HOME/.local/bin:$PATH"
gh pr create --base main --head my-feature --fill-first
```

---

## 3. See the local site on your phone

**On the PC (Windows is easiest):** in PowerShell or Cursor terminal:

```powershell
cd C:\Users\Owner\peaksees
npm run dev:lan
```

**On your phone (same Wi‑Fi):** Safari/Chrome →

```text
http://<PC-LAN-IP>:3000
```

Example: `http://192.168.12.132:3000`

If Windows Firewall blocks it once, allow **Node** / **port 3000** inbound on **Private** (or **Any**) for that network.

**Database:** By default, local dev should use **SQLite** (`data/peaksees.db`) so phone/PC preview does not change production. Keep `POSTGRES_URL` commented out in `.env.local`. Sign up or log in with a **local-only** account on `http://IP:3000` (not your live-site password unless you created that user locally). To preview real prod data again, uncomment `POSTGRES_URL` from `.env.local` (from `npx vercel env pull`) and restart `npm run dev:lan`.

---

## 4. Editor in your phone’s browser (optional)

### What this is (plain English)

- **Cursor** = desktop app on your PC only. It does **not** open on your phone.
- **code-server** = VS Code–style editor that runs on your PC (inside WSL) and you open it in **Safari/Chrome** like a website.
- You edit the **same peaksees files** Cursor uses. Nothing is copied to the phone.

```text
  [Your phone browser]  --Wi-Fi-->  [Your Windows PC]
                                        |
                    https://IP:8443 ----+---- code-server (editor)
                    http://IP:3000  -----+---- npm run dev:lan (website)
                    Termius :2222     -----+---- WSL terminal (git)
```

### Part A — Install once (Ubuntu / WSL)

Open **Ubuntu** on your PC (or Termius), then run:

```bash
bash /mnt/c/Users/Owner/peaksees/scripts/setup-code-server-wsl.sh
```

It installs code-server and asks you for a **browser login password** (pick something you’ll remember).

### Part B — Start the editor (every time you want to code on phone)

In Ubuntu or Termius:

```bash
cd /mnt/c/Users/Owner/peaksees
tmux attach -t editor 2>/dev/null || tmux new -s editor
code-server /mnt/c/Users/Owner/peaksees
```

Leave this running. You should see a line like `HTTP server listening on http://0.0.0.0:8443`.

- Detach tmux: **Ctrl+B**, then **D** (editor keeps running).
- Stop editor: in that tmux window, **Ctrl+C**.

### Part C — Let your phone reach port 8443 (Windows, once per reboot)

**Right‑click PowerShell → Run as administrator:**

```powershell
cd C:\Users\Owner\peaksees
powershell -ExecutionPolicy Bypass -File .\scripts\fix-wsl-termius-ssh.ps1
```

That script opens **2222** (Termius) and **8443** (editor) through the firewall.

### Part D — Open on your phone

1. Same Wi‑Fi as the PC.
2. Safari or Chrome → type (use your real IP):

   ```text
   https://192.168.12.132:8443
   ```

3. Browser warns about security → **Advanced → Proceed** (normal for local dev; not a public HTTPS cert).
4. Log in with the password you set in Part A.
5. You should see a **file explorer on the left** and code in the middle — that’s the editor.

### What you should see vs what’s wrong

| You see | Meaning |
|---------|---------|
| File tree + `app/`, `package.json` | Working |
| Login page only | Enter Part A password |
| “Can’t connect” / timeout | Part C not run, or code-server not running (Part B) |
| Termius black screen with `^X Exit` | That’s **nano**, not the editor — `Ctrl+X`, then `N` |

### Easier alternative

Skip code-server. Use **Cursor on your PC** to edit, and use the phone only for:

- Termius → `bash scripts/phone-push.sh "message"` to deploy  
- Browser → `http://YOUR-PC-IP:3000` to preview  

---

## 5. Open firewall ports on Windows (Termius + editor)

**PowerShell as Administrator** (run again after PC reboot if phone can’t connect):

```powershell
cd C:\Users\Owner\peaksees
powershell -ExecutionPolicy Bypass -File .\scripts\fix-wsl-termius-ssh.ps1
```

---

## 6. Daily rhythm (minimal)

| Step | Where |
|------|--------|
| Start dev server | PC: `npm run dev:lan` |
| Code / review | Phone browser: `https://IP:8443` (code-server) |
| Quick terminal / git | Termius → tmux → `bash scripts/phone-push.sh "msg"` |
| Check site | Phone browser: `http://IP:3000` (local) or https://www.peaksees.com (prod) |

---

## 7. Nothing works — cold reset (do in order)

Do these **on the PC first**, then the phone. Skip a step only if you know it already passes.

1. **Same network** — Phone Wi‑Fi = PC Wi‑Fi. PC not asleep. No VPN on phone blocking LAN.
2. **PC IPv4** — Windows: `ipconfig` → note **Wi‑Fi** IPv4 (e.g. `192.168.x.x`). That is Termius **Host** (not `172.17…`).
3. **WSL running** — Windows: open **Ubuntu** or run `wsl -e bash -lc "echo ok"` — must print `ok`.
4. **SSH in WSL** — In Ubuntu: `sudo service ssh start` (enter password if asked). Then: `ss -tlnp | grep ':22'` — you should see something listening on `:22`.
5. **Port forward + firewall** — Windows **PowerShell as Administrator**:
   ```powershell
   cd C:\Users\Owner\peaksees
   powershell -ExecutionPolicy Bypass -File .\scripts\fix-wsl-termius-ssh.ps1
   ```
   Check output: **WSL IP** and **portproxy** `2222 →` that same IP `:22`.
6. **Wi‑Fi profile** — Windows: that Wi‑Fi network = **Private** (not Public), or inbound rules may still block.
7. **Termius** — **Clear the host “startup snippet”** temporarily (rule out bad snippet). Host = step 2 IP, **Port 2222**, user `owner`, your key. Connect.
8. **Sanity in shell** — After login, run **one line**: `echo ok && pwd` — must print `ok` and a path. If you see nothing, the session isn’t executing lines (keyboard/Return) or SSH isn’t really up — repeat 4–5.
9. **Repo** — `cd /mnt/c/Users/Owner/peaksees && ls package.json` — must list the file.
10. **tmux** — `tmux attach -t peaksees` or `tmux new -s peaksees` — then your usual commands.

**Still broken?** Note the **first** thing that fails (e.g. “Termius timeout”, “auth failed”, `echo ok` no output, `ss` no `:22`) — that single symptom decides the next fix.

---

## Troubleshooting

- **Login works on peaksees.com but not on `http://IP:3000`** — Local SQLite has separate accounts: sign up on local or uncomment `POSTGRES_URL` to use prod DB (not recommended for everyday dev). Set `DEV_LAN_HOST` to your PC IP and restart `npm run dev:lan`. If sign-in does nothing or URL becomes `/login?`, Next.js was blocking client JS from the LAN IP; `allowedDevOrigins` in `next.config.ts` fixes that.
- **nano “save as different name”** — you’re inside nano; `Ctrl+X`, then `N` to quit without saving, or finish save with `Y` + Enter.
- **Termius won’t connect / no output / stuck in nano** — **clear the startup snippet** (empty). Connect, then `cd /mnt/c/Users/Owner/peaksees` and `tm peaksees`. Do not put `tmux attach` in the snippet.
- **`echo ok` with no output** — auto-tmux in `~/.bashrc` often steals the terminal on phone SSH. On the PC in Ubuntu run `bash /mnt/c/Users/Owner/peaksees/scripts/fix-wsl-termius-shell.sh`, clear Termius **Startup Snippet**, reconnect, then `echo ok`. Use `tm peaksees` manually when you want tmux.
- **`Cannot find module '../lightningcss.linux-x64-gnu.node'`** (or similar under `./app/globals.css`) — `node_modules` was installed with **Windows** Node, but you are running **`npm run dev` from WSL** (Linux). Tailwind 4 pulls in `lightningcss`, which ships a **native binary per OS**. Fix: in Termius/WSL, from the repo root run `npm install` again (or `rm -rf node_modules && npm install`) so Linux installs `lightningcss-linux-x64-gnu`. If you switch back to **Cursor on Windows** for dev, run `npm install` there too so the Windows binding is present. Avoid mixing installs on the same `/mnt/c/...` tree without reinstalling when you change which Node you use.
- **8443 refused** — code-server not running, wrong `bind-addr`, or missing portproxy / firewall rule.
- **code-server UI looks stale until hard refresh / “clear cache”** — normal for a heavy web app over HTTPS on a LAN IP. The browser caches JS/CSS aggressively. Use a hard refresh on the `:8443` tab, or Command Palette → **Developer: Reload Window**. If the file tree is out of date after edits elsewhere, right‑click the folder → **Refresh Explorer**. That is separate from the app preview: open **`http://IP:3000`** in another tab for the live site; don’t rely on Simple Browser for hot reload unless you refresh it.
