#!/usr/bin/env bash
# Idempotent bootstrap for Amazon Linux 2023. Run on the instance.
set -euo pipefail

if [[ "$(id -u)" -eq 0 ]]; then
  echo "Run as ec2-user, not root."
  exit 1
fi

echo "==> Swap (4G) so Node + MySQL fit on a small instance"
if ! sudo swapon --show | grep -q '/swapfile'; then
  sudo dd if=/dev/zero of=/swapfile bs=1M count=4096 status=progress
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile swap swap defaults 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

echo "==> Packages"
sudo dnf install -y git tar xz unzip docker psmisc

echo "==> Docker"
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER" || true

ARCH="$(uname -m)"
case "$ARCH" in
  x86_64) COMPOSE_ARCH=x86_64; NODE_ARCH=x64 ;;
  aarch64) COMPOSE_ARCH=aarch64; NODE_ARCH=arm64 ;;
  *) echo "Unsupported arch $ARCH"; exit 1 ;;
esac

PLUGIN_DIR=/usr/local/lib/docker/cli-plugins
if [[ ! -x "$PLUGIN_DIR/docker-compose" ]]; then
  sudo mkdir -p "$PLUGIN_DIR"
  sudo curl -fsSL "https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-${COMPOSE_ARCH}" \
    -o "$PLUGIN_DIR/docker-compose"
  sudo chmod +x "$PLUGIN_DIR/docker-compose"
fi

echo "==> Node 22"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v)" != v22* ]]; then
  NODE_VER=22.14.0
  curl -fsSL "https://nodejs.org/dist/v${NODE_VER}/node-v${NODE_VER}-linux-${NODE_ARCH}.tar.xz" \
    | sudo tar -xJ -C /usr/local --strip-components=1
fi

echo "==> pnpm"
if ! command -v pnpm >/dev/null 2>&1; then
  sudo corepack enable
  sudo corepack prepare pnpm@9.15.4 --activate
fi

echo "Setup done. node=$(node -v) pnpm=$(pnpm -v) docker=$(docker --version)"
echo "If this was the first Docker install, log out and back in (or reboot) so docker works without sudo."
