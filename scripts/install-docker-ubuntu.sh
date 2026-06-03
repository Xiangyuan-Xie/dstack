#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
    echo "Please run this script with sudo:" >&2
    echo "  sudo bash scripts/install-docker-ubuntu.sh" >&2
    exit 1
fi

if [ ! -r /etc/os-release ]; then
    echo "Cannot read /etc/os-release" >&2
    exit 1
fi

. /etc/os-release
codename="${UBUNTU_CODENAME:-${VERSION_CODENAME:-}}"
if [ -z "$codename" ]; then
    echo "Cannot determine Ubuntu codename" >&2
    exit 1
fi

target_user="${SUDO_USER:-xxy}"
docker_apt_base="${DOCKER_APT_BASE:-https://download.docker.com/linux/ubuntu}"
docker_registry_mirror="${DOCKER_REGISTRY_MIRROR:-https://docker.m.daocloud.io}"

apt-get update
apt-get install -y ca-certificates curl

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

arch="$(dpkg --print-architecture)"
echo "deb [arch=${arch} signed-by=/etc/apt/keyrings/docker.asc] ${docker_apt_base} ${codename} stable" \
    > /etc/apt/sources.list.d/docker.list

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<EOF
{
  "registry-mirrors": [
    "${docker_registry_mirror}"
  ]
}
EOF

if command -v systemctl >/dev/null 2>&1; then
    systemctl enable --now docker || service docker start
    systemctl restart docker || service docker restart
else
    service docker start
    service docker restart
fi

usermod -aG docker "$target_user"

docker version
docker run --rm hello-world
