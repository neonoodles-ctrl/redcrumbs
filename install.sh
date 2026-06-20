#!/usr/bin/env bash
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="/home/hermesprime/Documents/ObsidianVaults/HermesVault/.obsidian/plugins/redcrumbs"
COMMUNITY="/home/hermesprime/Documents/ObsidianVaults/HermesVault/.obsidian/community-plugins.json"
PLUGIN_ID="redcrumbs"

echo "Building RedCrumbs from $SRC..."
cd "$SRC"
npm install
npm run build

echo "Installing to $DEST..."
mkdir -p "$DEST"
cp main.js manifest.json styles.css "$DEST/"

python3 - <<PY "$COMMUNITY" "$PLUGIN_ID"
import json, os, sys

path, plugin_id = sys.argv[1], sys.argv[2]
plugins = []

if os.path.exists(path):
    with open(path) as f:
        plugins = json.load(f)

if plugin_id not in plugins:
    plugins.append(plugin_id)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(plugins, f, indent=2)
    print(f"Enabled {plugin_id} in community-plugins.json")
else:
    print(f"{plugin_id} already enabled in community-plugins.json")
PY

echo "Done. Reload plugins in Obsidian (or restart)."
