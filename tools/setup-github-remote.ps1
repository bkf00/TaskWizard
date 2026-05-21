param(
  [string]$RepoUrl = "https://github.com/bkf00/TaskWizard.git"
)

$ErrorActionPreference = "Stop"

function Ensure-Command {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,
    [Parameter(Mandatory = $true)]
    [string]$InstallHint
  )

  if (Get-Command $Name -ErrorAction SilentlyContinue) {
    return
  }

  throw "$Name was not found in PATH. $InstallHint"
}

Ensure-Command -Name "git" -InstallHint "Install Git for Windows: https://git-scm.com/download/win"
Ensure-Command -Name "gh" -InstallHint "Install GitHub CLI: https://cli.github.com/"

if (-not (Test-Path -LiteralPath ".git")) {
  git init
}

git branch -M main

if ($env:GITHUB_TOKEN) {
  $githubToken = $env:GITHUB_TOKEN
  Remove-Item Env:GITHUB_TOKEN

  $githubToken | gh auth login --with-token
  gh auth setup-git
}

$originExists = $true
try {
  git remote get-url origin | Out-Null
} catch {
  $originExists = $false
}

if ($originExists) {
  git remote set-url origin $RepoUrl
} else {
  git remote add origin $RepoUrl
}

git remote -v

