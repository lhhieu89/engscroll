#!/usr/bin/env bash
#
# setup-nginx-ssl.sh — Install Nginx + Let's Encrypt SSL for EngScroll on
# CentOS Stream 9 / Rocky 9 / Alma 9. Idempotent: safe to re-run.
#
# Usage (on the server, with sudo):
#   DOMAIN=engscroll.com EMAIL=hieulh.biz@gmail.com sudo -E bash scripts/setup-nginx-ssl.sh
#
# Env vars:
#   DOMAIN          (default: engscroll.com)
#   ALT_DOMAIN      (default: www.<DOMAIN>)
#   UPSTREAM_PORT   (default: 3016 — must match docker-compose.prod.yml APP_PORT)
#   EMAIL           (required — prompted if unset)
#   STAGING=1       run certbot with --staging (fake cert, avoids rate limits)
#   FORCE_REGEN=1   rebuild the nginx conf from the template (drops SSL block;
#                   certbot re-adds it)
#   KEY_TYPE        cert key type (default: rsa — ECDSA chains to ISRG Root X2
#                   which Cloudflare origin-pull may reject → Error 525)

set -euo pipefail

DOMAIN="${DOMAIN:-engscroll.com}"
ALT_DOMAIN="${ALT_DOMAIN:-www.${DOMAIN}}"
UPSTREAM_PORT="${UPSTREAM_PORT:-3016}"
CONF_NAME="engscroll"
CONF_PATH="/etc/nginx/conf.d/${CONF_NAME}.conf"
WEBROOT="/var/www/letsencrypt"

if [[ $EUID -eq 0 ]]; then SUDO=""; else SUDO="sudo"; fi

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
info() { printf '\033[34m▸\033[0m %s\n' "$*"; }
ok()   { printf '\033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '\033[33m!\033[0m %s\n' "$*"; }
die()  { printf '\033[31m✗\033[0m %s\n' "$*" >&2; exit 1; }

command -v dnf >/dev/null 2>&1 || die "This script targets CentOS/RHEL/Rocky/Alma (needs dnf)."

if [[ -z "${EMAIL:-}" ]]; then
  read -rp "Email for Let's Encrypt (expiry warnings): " EMAIL
fi
[[ -n "$EMAIL" ]] || die "EMAIL is required to register with Let's Encrypt."

bold "[setup-nginx-ssl] domain=$DOMAIN alt=$ALT_DOMAIN upstream=127.0.0.1:$UPSTREAM_PORT"

# --- EPEL + CRB (certbot isn't in base repos) -------------------------------
info "Enabling EPEL + CodeReady Builder…"
$SUDO dnf -y install dnf-plugins-core >/dev/null
if ! $SUDO dnf -y install epel-release >/dev/null 2>&1; then
  RHEL_VER="$(rpm -E %rhel 2>/dev/null || echo 9)"
  $SUDO dnf -y install "https://dl.fedoraproject.org/pub/epel/epel-release-latest-${RHEL_VER}.noarch.rpm" >/dev/null
fi
$SUDO dnf config-manager --set-enabled crb 2>/dev/null \
  || $SUDO dnf config-manager --set-enabled powertools 2>/dev/null || true
ok "EPEL enabled."

# --- Install nginx + certbot ------------------------------------------------
info "Installing nginx, certbot, firewalld…"
if ! $SUDO dnf -y install nginx certbot python3-certbot-nginx firewalld \
     policycoreutils-python-utils >/dev/null; then
  warn "dnf certbot failed — trying snap…"
  if command -v snap >/dev/null 2>&1; then
    $SUDO snap install --classic certbot
    $SUDO ln -sf /snap/bin/certbot /usr/bin/certbot
    $SUDO dnf -y install nginx firewalld policycoreutils-python-utils >/dev/null
  else
    die "certbot install failed. Enable EPEL manually or install snapd."
  fi
fi
$SUDO systemctl enable --now nginx firewalld >/dev/null
ok "Nginx + firewalld running."

# --- Firewall ---------------------------------------------------------------
info "Opening ports 80/443…"
$SUDO firewall-cmd --permanent --add-service=http >/dev/null
$SUDO firewall-cmd --permanent --add-service=https >/dev/null
$SUDO firewall-cmd --reload >/dev/null
ok "HTTP/HTTPS allowed."

# --- SELinux: allow nginx → 127.0.0.1:UPSTREAM_PORT -------------------------
if command -v getenforce >/dev/null 2>&1 && [[ "$(getenforce)" != "Disabled" ]]; then
  info "SELinux active — enabling httpd_can_network_connect…"
  $SUDO setsebool -P httpd_can_network_connect 1 || warn "Could not set boolean (already on?)"
  ok "nginx may connect to the upstream."
fi

# --- ACME webroot -----------------------------------------------------------
$SUDO mkdir -p "$WEBROOT"
$SUDO chown -R nginx:nginx "$WEBROOT" 2>/dev/null || true

# --- Render template → /etc/nginx/conf.d/engscroll.conf ---------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE="${SCRIPT_DIR}/../nginx/engscroll.conf.template"
[[ -f "$TEMPLATE" ]] || die "Template not found at $TEMPLATE"

if [[ "${FORCE_REGEN:-0}" = "1" && -f "$CONF_PATH" ]]; then
  warn "FORCE_REGEN=1 — removing old $CONF_PATH and re-rendering."
  $SUDO rm -f "$CONF_PATH"
fi

if [[ -f "$CONF_PATH" ]] && grep -q 'ssl_certificate' "$CONF_PATH"; then
  warn "$CONF_PATH already has ssl_certificate — keeping it. Use FORCE_REGEN=1 to rebuild."
else
  info "Rendering $CONF_PATH from template…"
  $SUDO sed \
    -e "s|__DOMAIN__|$DOMAIN|g" \
    -e "s|__ALT_DOMAIN__|$ALT_DOMAIN|g" \
    -e "s|__UPSTREAM_PORT__|$UPSTREAM_PORT|g" \
    "$TEMPLATE" | $SUDO tee "$CONF_PATH" >/dev/null
  ok "Wrote $CONF_PATH."
fi

info "Testing + reloading Nginx…"
$SUDO nginx -t
$SUDO systemctl reload nginx
ok "Nginx reloaded."

# --- Let's Encrypt account (handle multi-account servers) -------------------
ACME_SERVER_DIR="acme-v02.api.letsencrypt.org/directory"
[[ "${STAGING:-0}" = "1" ]] && ACME_SERVER_DIR="acme-staging-v02.api.letsencrypt.org/directory"
ACCOUNTS_DIR="/etc/letsencrypt/accounts/${ACME_SERVER_DIR}"

find_account_by_email() {
  local email="$1" dir
  [[ -d "$ACCOUNTS_DIR" ]] || return 1
  while IFS= read -r dir; do
    if $SUDO grep -q "\"mailto:${email}\"" "$dir/regr.json" 2>/dev/null; then
      basename "$dir"; return 0
    fi
  done < <($SUDO find "$ACCOUNTS_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null)
  return 1
}
first_existing_account() {
  $SUDO find "$ACCOUNTS_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null \
    | head -n 1 | xargs -r -I{} basename {}
}

info "Finding Let's Encrypt account for $EMAIL…"
ACCOUNT_ID="$(find_account_by_email "$EMAIL" || true)"
if [[ -z "$ACCOUNT_ID" ]]; then
  REG_ARGS=(register --email "$EMAIL" --no-eff-email --agree-tos --non-interactive)
  [[ "${STAGING:-0}" = "1" ]] && REG_ARGS+=(--staging)
  if $SUDO certbot "${REG_ARGS[@]}" >/dev/null 2>&1; then
    ACCOUNT_ID="$(find_account_by_email "$EMAIL" || true)"
  else
    ACCOUNT_ID="$(first_existing_account)"
    [[ -n "$ACCOUNT_ID" ]] && warn "Falling back to existing account $ACCOUNT_ID"
  fi
fi
[[ -n "${ACCOUNT_ID:-}" ]] && ok "Using account $ACCOUNT_ID" || warn "No account pinned — certbot will create one."

# --- Issue SSL --------------------------------------------------------------
# Force an RSA key. Newer certbot defaults to ECDSA, which chains to the newer
# ISRG Root X2 — Cloudflare's origin-pull trust store may not accept it yet, so
# a proxied zone on "Full (strict)" fails the handshake with Error 525. RSA
# chains to the universally trusted ISRG Root X1. Override with KEY_TYPE=ecdsa.
CERTBOT_ARGS=(--nginx -d "$DOMAIN" -d "$ALT_DOMAIN" --non-interactive --agree-tos
  --email "$EMAIL" --no-eff-email --redirect --keep-until-expiring
  --key-type "${KEY_TYPE:-rsa}")
[[ -n "${ACCOUNT_ID:-}" ]] && CERTBOT_ARGS+=(--account "$ACCOUNT_ID")
[[ "${STAGING:-0}" = "1" ]] && CERTBOT_ARGS+=(--staging) && warn "STAGING mode (untrusted cert)."

info "Issuing SSL via Let's Encrypt…"
$SUDO certbot "${CERTBOT_ARGS[@]}"
ok "SSL issued."

# --- Auto-renew -------------------------------------------------------------
if systemctl list-unit-files | grep -q '^certbot-renew\.timer'; then
  $SUDO systemctl enable --now certbot-renew.timer >/dev/null
  ok "certbot-renew.timer enabled."
elif systemctl list-unit-files | grep -q '^certbot\.timer'; then
  $SUDO systemctl enable --now certbot.timer >/dev/null
  ok "certbot.timer enabled."
else
  CRON_LINE="0 3 * * * /usr/bin/certbot renew --quiet --post-hook 'systemctl reload nginx'"
  ( $SUDO crontab -l 2>/dev/null | grep -v 'certbot renew' ; echo "$CRON_LINE" ) | $SUDO crontab -
  ok "cron renew added (3am daily)."
fi

bold ""
bold "✅ Done. Visit:"
echo "   https://$DOMAIN"
echo "   https://$ALT_DOMAIN"
echo
echo "If you hit a redirect loop or 502:"
echo "  1. Is the app up?   cd /var/www/engscroll && docker compose -f docker-compose.prod.yml ps"
echo "  2. Direct backend:  curl -I http://127.0.0.1:$UPSTREAM_PORT/api/health"
echo "  3. Rebuild config:  FORCE_REGEN=1 DOMAIN=$DOMAIN EMAIL=$EMAIL sudo -E bash scripts/setup-nginx-ssl.sh"
