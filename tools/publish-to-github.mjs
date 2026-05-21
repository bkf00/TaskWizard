import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const owner = process.env.GITHUB_OWNER ?? "bkf00";
const repo = process.env.GITHUB_REPO ?? "TaskWizard";
const branch = process.env.GITHUB_BRANCH ?? "main";
const token = process.env.GITHUB_TOKEN;
const root = process.cwd();

if (!token) {
  console.error("Missing GITHUB_TOKEN environment variable.");
  console.error("Create a fine-grained GitHub token with Contents: Read and write for bkf00/TaskWizard.");
  process.exit(1);
}

const ignoreDirs = new Set([".git", "node_modules", ".next", ".turbo", "dist", "coverage", "data"]);
const ignoreFiles = new Set([".env", ".env.local"]);

async function github(method, url, body) {
  const response = await fetch(`https://api.github.com${url}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    throw new Error(`${method} ${url} failed: ${response.status} ${await response.text()}`);
  }

  return response.status === 204 ? null : response.json();
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(root, fullPath).replaceAll("\\", "/");

    if (entry.isDirectory()) {
      if (!ignoreDirs.has(entry.name)) {
        files.push(...(await walk(fullPath)));
      }
      continue;
    }

    if (!entry.isFile()) continue;
    if (ignoreFiles.has(entry.name)) continue;
    if (relativePath.startsWith("data/")) continue;

    files.push({ fullPath, relativePath });
  }

  return files;
}

async function getDefaultBranchSha() {
  try {
    const ref = await github("GET", `/repos/${owner}/${repo}/git/ref/heads/${branch}`);
    return { refExists: true, commitSha: ref.object.sha };
  } catch (error) {
    if (String(error.message).includes(" 404 ")) {
      return { refExists: false, commitSha: null };
    }
    throw error;
  }
}

async function getCommit(commitSha) {
  if (!commitSha) return null;
  return github("GET", `/repos/${owner}/${repo}/git/commits/${commitSha}`);
}

async function main() {
  const files = await walk(root);
  const fileHash = createHash("sha256");
  for (const file of files) {
    fileHash.update(file.relativePath);
    fileHash.update("\n");
  }

  console.log(`Publishing ${files.length} files to ${owner}/${repo}:${branch}`);
  console.log(`File manifest hash: ${fileHash.digest("hex")}`);

  const tree = [];
  for (const file of files) {
    const content = await readFile(file.fullPath, "utf8");
    const blob = await github("POST", `/repos/${owner}/${repo}/git/blobs`, {
      content,
      encoding: "utf-8"
    });
    tree.push({
      path: file.relativePath,
      mode: "100644",
      type: "blob",
      sha: blob.sha
    });
  }

  const current = await getDefaultBranchSha();
  const parentCommit = await getCommit(current.commitSha);
  const newTree = await github("POST", `/repos/${owner}/${repo}/git/trees`, {
    base_tree: parentCommit?.tree?.sha,
    tree
  });

  const commit = await github("POST", `/repos/${owner}/${repo}/git/commits`, {
    message: "chore: publish initial TaskWizard repository",
    tree: newTree.sha,
    parents: current.commitSha ? [current.commitSha] : []
  });

  if (current.refExists) {
    await github("PATCH", `/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
      sha: commit.sha,
      force: false
    });
  } else {
    await github("POST", `/repos/${owner}/${repo}/git/refs`, {
      ref: `refs/heads/${branch}`,
      sha: commit.sha
    });
  }

  console.log(`Published commit: ${commit.sha}`);
  console.log(`URL: https://github.com/${owner}/${repo}`);
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exit(1);
});

