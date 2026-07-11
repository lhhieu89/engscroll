# EngScroll — Production Deploy Runbook

Stack: **Next.js 16 standalone** in Docker → host **Nginx** (TLS) → host **PostgreSQL**.
Domain **engscroll.com**, app listens on **127.0.0.1:3016**. Auto-deploy on push to `main`.

```
Internet ──443──▶ Nginx (host, TLS) ──▶ 127.0.0.1:3016 ──▶ engscroll-web (docker, host net)
                                                                     │
                                                          localhost:5432 ▶ PostgreSQL (host)
```

Everything is parameterized: change `APP_PORT` in `.env` and `UPSTREAM_PORT` for the
nginx script to move off 3016; change `DOMAIN`/`EMAIL` for the SSL script.

---

## One-time server setup (CentOS/Rocky/Alma 9)

1. **Install Docker + compose plugin**, then clone the repo:
   ```bash
   sudo mkdir -p /var/www && sudo chown "$USER" /var/www
   git clone git@github.com:lhhieu89/engscroll.git /var/www/engscroll
   cd /var/www/engscroll
   ```

2. **PostgreSQL** (host-installed). Create role + db:
   ```bash
   sudo -u postgres psql -c "CREATE USER engscroll WITH PASSWORD 'strong-pass';"
   sudo -u postgres psql -c "CREATE DATABASE engscroll OWNER engscroll;"
   # ensure pg_hba.conf allows 127.0.0.1 with scram-sha-256/md5 (TCP), then reload.
   ```

3. **Environment**:
   ```bash
   cp .env.production.example .env
   $EDITOR .env          # set DATABASE_URL, ADMIN_KEY, (optional) Google OAuth
   ```

4. **First build + migrate + seed + run**:
   ```bash
   COMPOSE="docker compose -f docker-compose.prod.yml"
   $COMPOSE build web
   $COMPOSE --profile tools build tools
   $COMPOSE --profile tools run --rm tools npm run db:migrate:deploy
   $COMPOSE --profile tools run --rm tools npm run seed:banks:deploy
   $COMPOSE up -d web
   curl -fsS http://127.0.0.1:3016/api/health        # → {"ok":true,"status":"live"}
   ```

5. **Nginx + SSL** (issues a Let's Encrypt cert, sets up auto-renew):
   ```bash
   DOMAIN=engscroll.com EMAIL=hieulh.biz@gmail.com sudo -E bash scripts/setup-nginx-ssl.sh
   ```
   Point `engscroll.com` + `www` A records at the server first. Test with `STAGING=1`
   to avoid rate limits, then re-run for the real cert.

---

## Auto-deploy (GitHub Actions)

`.github/workflows/deploy.yml` runs on every push to `main` (or manual dispatch).
It SSHes to the server, `git reset --hard origin/main`, rebuilds, migrates,
re-seeds content banks, and recreates the web container.

Set these **repo secrets** (Settings → Secrets → Actions), under a `production`
environment:

| Secret            | Value                                             |
| ----------------- | ------------------------------------------------- |
| `SSH_HOST`        | server IP / hostname                              |
| `SSH_USER`        | deploy user (must own `/var/www/engscroll`)       |
| `SSH_PRIVATE_KEY` | private key whose public key is in `authorized_keys` |
| `SSH_PORT`        | optional, defaults to 22                          |

Manual dispatch inputs: `no_cache` (rebuild without cache — default true so a
changed `NEXT_PUBLIC_SITE_URL` re-inlines), `skip_seed` (skip re-seeding for a
code-only deploy).

`.github/workflows/ci.yml` type-checks + builds every PR so a broken build never
reaches `main`.

---

## Operations

```bash
COMPOSE="docker compose -f docker-compose.prod.yml"
$COMPOSE ps                                             # status + health
$COMPOSE logs -f web                                    # tail logs
$COMPOSE --profile tools run --rm tools npm run db:migrate:deploy   # migrate only
$COMPOSE --profile tools run --rm tools npm run seed:banks:deploy   # re-seed content
$COMPOSE up -d --force-recreate web                     # restart web
```

**Troubleshooting**
- 502 / redirect loop → `curl -I http://127.0.0.1:3016/api/health`; if down, `$COMPOSE logs web`.
- Rebuild nginx conf → `FORCE_REGEN=1 DOMAIN=engscroll.com EMAIL=... sudo -E bash scripts/setup-nginx-ssl.sh`.
- Cloudflare Error 525 → cert must be RSA (the script forces `--key-type rsa`).
