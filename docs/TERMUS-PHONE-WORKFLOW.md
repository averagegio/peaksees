# Phone workflow: Termius (git + deploy) + browser (site + editor)

You use **three different apps** on your phone. They are not the same thing.

| What you want | App on phone | URL / tool |
|---------------|--------------|------------|
| Run commands, git, deploy | **Termius** (green terminal) | SSH to your PC |
| See the website while developing | **Safari / Chrome** | `http://YOUR-PC-IP:3000` |
| Edit code with a file tree (like VS Code) | **Safari / Chrome** | `https://YOUR-PC-IP:8443` |

**Termius will never show an editor.** If you only want git + deploy, skip section 4 entirely and use **Cursor on your PC** for editing.

Replace `YOUR-PC-IP` with:

| Where you are | Use this address in Termius / browser |
|---------------|----------------------------------------|
| **Same Wi‑Fi as the PC** | Wi‑Fi IPv4 from Windows `ipconfig` (e.g. `192.168.12.132`) |
| **Anywhere else** (cellular, coffee shop, etc.) | PC **Tailscale** IP (e.g. `100.64.x.x`) — see **§6** |

Repo folder (same on PC and WSL): `/mnt/c/Users/Owner/peaksees` = `C:\Users\Owner\peaksees`

---

## 1. Termius host (recap)

| Field | Value |
|--------|--------|
| Address | PC Wi‑Fi IPv4 (`ipconfig`) **or** Tailscale IP (§6) when away from home |
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

**On your phone:**

- **Same Wi‑Fi:** `http://<PC-LAN-IP>:3000` (e.g. `http://192.168.12.132:3000`)
- **Anywhere (Tailscale):** `http://<TAILSCALE-IP>:3000` (e.g. `http://100.64.1.2:3000`) — see §6

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

## 6. Remote access from anywhere (Tailscale)

**Termius does not create remote access by itself** — it only connects to an IP you give it. On home Wi‑Fi, that IP is `192.168.x.x`. From cellular or another network, you need a **private tunnel** to your PC. **Tailscale** is the simplest option (free for personal use).

```text
  [Phone on LTE / any Wi‑Fi]
           |
      Tailscale VPN (encrypted)
           |
  [Windows PC — must be awake]
     :2222  portproxy → WSL :22  (Termius / git)
     :3000  npm run dev:lan      (site preview)
     :8443  code-server          (editor, optional)
```

### One-time setup

1. **PC (Windows)** — install [Tailscale for Windows](https://tailscale.com/download/windows), sign in.
2. **Phone** — install Tailscale from the App Store / Play Store, sign in with the **same account**.
3. **Find the PC’s Tailscale IP** — on Windows (PowerShell):

   ```powershell
   tailscale ip -4
   ```

   Or open the [Tailscale admin console](https://login.tailscale.com/admin/machines) and copy the **100.x.x.x** address for your PC.

4. **Termius** — duplicate your existing host (or edit it) and set:
   - **Address:** `100.x.x.x` (Tailscale IP, **not** `192.168.x.x`)
   - **Port:** `2222` (unchanged)
   - **User / key:** unchanged

   Tip: keep **two hosts** in Termius — `peaksees (home)` with LAN IP and `peaksees (remote)` with Tailscale IP.

5. **Firewall + portproxy** — still required after reboot (same as home Wi‑Fi):

   ```powershell
   cd C:\Users\Owner\peaksees
   powershell -ExecutionPolicy Bypass -File .\scripts\fix-wsl-termius-ssh.ps1
   ```

6. **WSL SSH** — still required before Termius connects:

   ```bash
   sudo service ssh start
   ```

### Using it day to day (away from home)

| Step | Where |
|------|--------|
| PC powered on, not asleep | Windows |
| Tailscale running on PC + phone | Both show “Connected” in the Tailscale app |
| WSL + SSH up | `wsl -e bash -lc "sudo service ssh start"` or open Ubuntu once |
| Termius | Connect to **Tailscale IP**, port **2222** |
| Site preview | `http://100.x.x.x:3000` (replace with your Tailscale IP) |
| Editor (optional) | `https://100.x.x.x:8443` |

You do **not** need to be on the same Wi‑Fi. You **do** need the PC on at home (or wherever it lives).

### Optional: MagicDNS hostname

In the Tailscale admin console, enable **MagicDNS**. Your PC may get a name like `your-pc.your-tailnet.ts.net`. Use that in Termius instead of memorizing `100.x.x.x`.

### What Tailscale does *not* fix

- **PC off or asleep** — nothing connects until it wakes up.
- **WSL stopped** — run Ubuntu / `wsl` once, start `ssh`.
- **Dev server not running** — Termius works, but `:3000` preview needs `npm run dev:lan` on the PC.
- **Router port forwarding** — not needed; Tailscale avoids exposing SSH to the public internet.

### Remote troubleshooting

| Symptom | Fix |
|---------|-----|
| Termius timeout on Tailscale IP | PC asleep? Tailscale disconnected on PC? Run `fix-wsl-termius-ssh.ps1` again. |
| Termius works, `:3000` does not | Start `npm run dev:lan` on PC; allow port **3000** in Windows Firewall if prompted. |
| Works on LAN IP but not Tailscale IP | Use Tailscale IP in Termius; confirm phone Tailscale app is connected (not “Stopped”). |

---

## 7. Daily rhythm (minimal)

| Step | Where |
|------|--------|
| Start dev server | PC: `npm run dev:lan` |
| Code / review | Phone browser: `https://IP:8443` (code-server) |
| Quick terminal / git | Termius → tmux → `bash scripts/phone-push.sh "msg"` |
| Check site | Phone browser: `http://IP:3000` (local) or https://www.peaksees.com (prod) |

---

## 8. Nothing works — cold reset (do in order)

Do these **on the PC first**, then the phone. Skip a step only if you know it already passes.

1. **Network** — **Home Wi‑Fi:** phone and PC on same Wi‑Fi. **Remote:** Tailscale connected on both (§6); use **100.x.x.x**, not `192.168.x.x`. PC not asleep.
2. **PC address** — **LAN:** `ipconfig` → Wi‑Fi IPv4 (e.g. `192.168.x.x`). **Remote:** `tailscale ip -4` on Windows. Termius **Host** must match (not `172.17…` WSL-only IP).
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
- **Works at home, fails on cellular** — you need Tailscale (§6). LAN IP (`192.168.x.x`) is not reachable off your home network.
- **Tailscale connected but Termius still times out** — PC may be asleep; re-run `fix-wsl-termius-ssh.ps1`; `sudo service ssh start` in WSL; confirm Termius host uses **Tailscale IP** and port **2222**.
- **code-server UI looks stale until hard refresh / “clear cache”** — normal for a heavy web app over HTTPS on a LAN IP. The browser caches JS/CSS aggressively. Use a hard refresh on the `:8443` tab, or Command Palette → **Developer: Reload Window**. If the file tree is out of date after edits elsewhere, right‑click the folder → **Refresh Explorer**. That is separate from the app preview: open **`http://IP:3000`** in another tab for the live site; don’t rely on Simple Browser for hot reload unless you refresh it.
