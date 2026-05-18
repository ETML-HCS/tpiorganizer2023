#!/usr/bin/env bash

set -Eeuo pipefail

# Répertoire du script
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PAUSE_ON_ERROR=1

# -----------------------------
# Arguments
# -----------------------------
for arg in "$@"; do
    case "$arg" in
        --no-pause)
            PAUSE_ON_ERROR=0
            ;;
    esac
done

# -----------------------------
# Gestion erreurs
# -----------------------------
die() {
    local msg="$1"
    local code="${2:-1}"

    echo
    echo "[ERROR] $msg"

    if [[ "$PAUSE_ON_ERROR" -eq 1 ]]; then
        read -rp "Appuie sur Entrée pour quitter..."
    fi

    exit "$code"
}

# -----------------------------
# Vérifications
# -----------------------------
[[ -f "$ROOT/package.json" ]] \
    || die "package.json introuvable dans : $ROOT"

command -v node >/dev/null 2>&1 \
    || die "Node.js introuvable"

command -v npm >/dev/null 2>&1 \
    || die "npm introuvable"

# -----------------------------
# Installation dépendances
# -----------------------------
if [[ ! -d "$ROOT/node_modules" ]]; then
    echo "[INFO] Installation des dépendances..."
    npm install || die "Échec installation npm"
fi

# -----------------------------
# Build production
# -----------------------------
echo
echo "[INFO] Build production..."
echo

npm run build || die "Échec du build"

# -----------------------------
# Démarrage production
# -----------------------------
echo
echo "[INFO] Démarrage application..."
echo

npm run start || die "Échec du démarrage"

echo
echo "[OK] Application arrêtée."
echo

exit 0
