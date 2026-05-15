#!/bin/bash
set -e

# ------------------------------------------------------------
# release.sh
#
# Zweck:
# - prüft die index.js
# - zeigt Git-Status
# - erhöht die npm/package.json Version
# - erstellt automatisch einen Git-Tag
# - lädt Commit und Tags zu GitHub hoch
#
# Nutzung:
#   ./release.sh patch
#   ./release.sh minor
#   ./release.sh major
#
# Beispiel:
#   ./release.sh patch
# ------------------------------------------------------------

VERSION_TYPE="$1"

if [ -z "$VERSION_TYPE" ]; then
  echo "Fehler: Versionstyp fehlt."
  echo "Nutze: ./release.sh patch | minor | major"
  exit 1
fi

if [[ "$VERSION_TYPE" != "patch" && "$VERSION_TYPE" != "minor" && "$VERSION_TYPE" != "major" ]]; then
  echo "Fehler: Ungültiger Versionstyp: $VERSION_TYPE"
  echo "Erlaubt: patch, minor, major"
  exit 1
fi

echo "1) Prüfe index.js..."
npm run check

echo
echo "2) Aktueller Git-Status:"
git status

echo
read -p "Änderungen jetzt committen und Version '$VERSION_TYPE' erhöhen? (j/N): " CONFIRM

if [[ "$CONFIRM" != "j" && "$CONFIRM" != "J" ]]; then
  echo "Abgebrochen."
  exit 0
fi

echo
echo "3) Alle Änderungen vormerken..."
git add .

echo
read -p "Commit-Text eingeben: " COMMIT_MSG

if [ -z "$COMMIT_MSG" ]; then
  COMMIT_MSG="Update project files"
fi

echo
echo "4) Commit erstellen..."
git commit -m "$COMMIT_MSG"

echo
echo "5) Version erhöhen mit npm version $VERSION_TYPE..."
npm version "$VERSION_TYPE"

echo
echo "6) Änderungen zu GitHub hochladen..."
git push

echo
echo "7) Tags zu GitHub hochladen..."
git push --tags

echo
echo "Fertig."
echo "Neue Version:"
node -p "require('./package.json').version"
