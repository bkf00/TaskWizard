#!/usr/bin/env bash
set -euo pipefail

repo_url="${REPO_URL:-https://github.com/bkf00/TaskWizard.git}"

ensure_command() {
  local name="$1"
  local install_hint="$2"

  if command -v "${name}" >/dev/null 2>&1; then
    return 0
  fi

  echo "${name} not found. ${install_hint}" >&2
  return 1
}

ensure_command git "Install Git: https://git-scm.com/downloads"
ensure_command gh "Install GitHub CLI: https://cli.github.com/"

if [ ! -d .git ]; then
  git init
fi

git branch -M main

if [ -n "${GITHUB_TOKEN:-}" ]; then
  github_token="${GITHUB_TOKEN}"
  unset GITHUB_TOKEN

  echo "${github_token}" | gh auth login --with-token
  gh auth setup-git
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  git remote add origin "${repo_url}"
else
  git remote set-url origin "${repo_url}"
fi

git remote -v

