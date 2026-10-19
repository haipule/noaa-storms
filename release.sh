#!/bin/bash
set -e

# ------------------------------------------------------------
# release.sh
#
# Purpose:
# - checks the JavaScript sources
# - shows the Git status
# - increments the npm/package.json version
# - creates a Git tag automatically
# - pushes the commit and tags to GitHub
#
# Usage:
#   ./release.sh patch
#   ./release.sh minor
#   ./release.sh major
#
# Example:
#   ./release.sh patch
# ------------------------------------------------------------

VERSION_TYPE="$1"

if [ -z "$VERSION_TYPE" ]; then
  echo "Error: version type is missing."
  echo "Usage: ./release.sh patch | minor | major"
  exit 1
fi

if [[ "$VERSION_TYPE" != "patch" && "$VERSION_TYPE" != "minor" && "$VERSION_TYPE" != "major" ]]; then
  echo "Error: invalid version type: $VERSION_TYPE"
  echo "Allowed values: patch, minor, major"
  exit 1
fi

echo "1) Checking JavaScript sources..."
npm run check

echo
echo "2) Current Git status:"
git status

echo
read -p "Commit all changes and increment the '$VERSION_TYPE' version now? (y/N): " CONFIRM

if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
  echo "Cancelled."
  exit 0
fi

echo
echo "3) Staging all changes..."
git add .

echo
read -p "Enter commit message: " COMMIT_MSG

if [ -z "$COMMIT_MSG" ]; then
  COMMIT_MSG="Update project files"
fi

echo
echo "4) Creating commit..."
git commit -m "$COMMIT_MSG"

echo
echo "5) Incrementing version with npm version $VERSION_TYPE..."
npm version "$VERSION_TYPE"

echo
echo "6) Pushing changes to GitHub..."
git push

echo
echo "7) Pushing tags to GitHub..."
git push --tags

echo
echo "Done."
echo "New version:"
node -p "require('./package.json').version"
