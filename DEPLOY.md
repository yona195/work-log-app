# Deploying the Work Log app — from zero

This guide takes you from nothing to a live, password-protected site running on
**your own free accounts**. No custom domain and no credit card required.

**What you'll end up with:** a URL like `https://work-log-xxxx.onrender.com`
that shows a login screen, backed by a free hosted database.

**Time:** ~15 minutes. **You need:** a GitHub account.

The setup is one small web service on **Render** (free) that stores its data in
**Turso** (free hosted SQLite). Both have free tiers that are plenty for this.

---

## Step 1 — Get your own copy of the code

1. Sign in to GitHub.
2. Go to the repository: `https://github.com/yona195/work-log-app`
   - If you can't see it, ask the owner to make it public or add you as a
     collaborator.
3. Click **Fork** (top-right) → **Create fork**. You now have your own copy at
   `https://github.com/<your-username>/work-log-app`.

Everything below deploys from *your* fork, under *your* accounts.

---

## Step 2 — Create the database (Turso)

1. Go to **https://turso.tech** and sign up (GitHub login is easiest).
2. Install the CLI (one line):
   - macOS / Linux: `curl -sSfL https://get.tur.so/install.sh | bash`
   - Windows: use WSL, or see https://docs.turso.tech/cli/installation
3. In a terminal:
   ```bash
   turso auth login          # opens the browser, approve it
   turso db create work-log   # creates the database
   ```
4. Get the two secrets you'll need — **copy both somewhere safe**:
   ```bash
   turso db show work-log --url        # -> this is DATABASE_URL  (starts with libsql://)
   turso db tokens create work-log      # -> this is DATABASE_AUTH_TOKEN (a long string)
   ```

> No CLI? You can also create the database and a token from the Turso web
> dashboard — the two values are the same.

---

## Step 3 — Deploy on Render

1. Go to **https://render.com** and sign in **with GitHub** (the account that
   owns your fork).
2. Click **New +** → **Blueprint**.
3. Select your fork **`<your-username>/work-log-app`**. Render reads the
   included `render.yaml` automatically and proposes a web service named
   `work-log`.
4. Before creating, set these **environment variables**:

   | Key                   | Value                                                    |
   | --------------------- | -------------------------------------------------------- |
   | `DATABASE_URL`        | the `libsql://…` URL from Step 2                          |
   | `DATABASE_AUTH_TOKEN` | the token from Step 2                                     |
   | `APP_PASSWORD`        | any password you choose — this is the app login password |

   (`SESSION_SECRET` is generated automatically by the blueprint. `NODE_ENV` is
   already set.)

5. Click **Apply / Create**. Render installs, builds, and starts the app
   (~2–3 minutes). When it's done you get a public URL:
   **`https://work-log-xxxx.onrender.com`**.

---

## Step 4 — Log in

Open the Render URL. You'll see the login screen. Enter the `APP_PASSWORD` you
chose. To sign out, use **התנתקות** (Logout) at the bottom of the sidebar.

That's it — it's live. Share the URL and the password with whoever needs access.

---

## Step 5 (optional) — Import existing data from Google Sheets

If you have data in the old Google Sheets version, load it once:

```bash
# clone your fork locally, then:
cd server
npm install
DATABASE_URL="libsql://…" DATABASE_AUTH_TOKEN="…" \
SHEETS_API_URL="https://script.google.com/macros/s/…/exec" \
npm run import:sheets
```

The data lands in the same Turso database the live site uses, so it shows up
immediately.

---

## Good to know

- **Free-tier sleep:** Render's free plan puts the app to sleep after ~15 min
  of no traffic, so the first visit after a pause takes ~30 seconds to wake up.
  Your data is safe in Turso the whole time. Upgrading Render (~$7/mo) removes
  the delay.
- **Change the password:** Render dashboard → your service → **Environment** →
  edit `APP_PASSWORD` → save (it redeploys). Everyone is logged out and uses the
  new password.
- **Backups:** `turso db shell work-log .dump > backup.sql` saves a full copy.
- **Updates:** push changes to your fork's `main` branch and Render redeploys
  automatically.
