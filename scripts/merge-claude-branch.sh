#!/usr/bin/env bash
set -euo pipefail

BRANCH="${1:-}"

if [ -z "$BRANCH" ]; then
  echo "Usage: ./scripts/merge-claude-branch.sh claude/branch-name"
  exit 1
fi

echo "Switching to site-truth-lock..."
git checkout site-truth-lock
git pull origin site-truth-lock

echo "Merging $BRANCH..."
if ! git merge "$BRANCH"; then
  echo ""
  echo "Merge conflict detected."

  if git status --short | grep -q "UU package.json"; then
    echo "Resolving package.json test-script conflict by combining both test chains..."

    node <<'NODE'
const { execSync } = require('child_process')
const fs = require('fs')

const ours = JSON.parse(execSync('git show :2:package.json', { encoding: 'utf8' }))
const theirs = JSON.parse(execSync('git show :3:package.json', { encoding: 'utf8' }))

const oursTests = ours.scripts.test.split(' && ').map(s => s.trim()).filter(Boolean)
const theirsTests = theirs.scripts.test.split(' && ').map(s => s.trim()).filter(Boolean)

const mergedTests = Array.from(new Set([...oursTests, ...theirsTests]))

const merged = {
  ...ours,
  scripts: {
    ...ours.scripts,
    test: mergedTests.join(' && '),
  },
}

fs.writeFileSync('package.json', JSON.stringify(merged, null, 2) + '\n')
NODE

    git add package.json
    git commit -m "merge ${BRANCH} into site-truth-lock"
  else
    echo "Non-package.json conflict. Resolve manually, then commit."
    exit 1
  fi
fi

echo "Running checks..."
npm test
npm run build

echo "Pushing site-truth-lock..."
git push origin site-truth-lock

echo "Done. Now merge site-truth-lock into main on GitHub."
