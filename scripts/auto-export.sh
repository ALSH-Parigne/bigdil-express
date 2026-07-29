#!/bin/bash
# Export automatique vers Google Drive, en boucle.
#
# À lancer dans le Terminal le jour de l'événement (voir README, section
# "Export automatique"). Exporte les nouvelles vidéos/photos toutes les
# 10 minutes, tant que la fenêtre reste ouverte. Ctrl+C pour arrêter.
#
# Pourquoi une boucle et pas une tâche de fond (launchd) : macOS interdit aux
# tâches de fond de lire le dossier Documents sans accorder manuellement
# "Accès complet au disque" dans les Réglages Système. Lancée depuis le
# Terminal, la boucle hérite des permissions du Terminal — rien à configurer.
#
# Usage : npm run auto-export
#         INTERVAL=300 npm run auto-export        (toutes les 5 minutes)
#         DELETE_AFTER=1 npm run auto-export      (libère Supabase au passage)

set -u

INTERVAL="${INTERVAL:-600}"
EXTRA_ARGS=()
[ "${DELETE_AFTER:-0}" = "1" ] && EXTRA_ARGS+=(--delete-after)

cd "$(dirname "$0")/.." || exit 1

echo "Export automatique vers Google Drive"
echo "  intervalle : toutes les ${INTERVAL}s"
if [ ${#EXTRA_ARGS[@]} -gt 0 ]; then
  echo "  mode       : les fichiers exportés sont supprimés de Supabase"
else
  echo "  mode       : copie seule (les fichiers restent visibles dans /admin)"
fi
echo "  Ctrl+C pour arrêter."
echo

while true; do
  echo "──────── $(date '+%H:%M:%S') ────────"
  node scripts/export-to-drive.mjs "${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}"
  echo
  sleep "$INTERVAL"
done
