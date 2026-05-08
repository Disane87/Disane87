#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";

const USER = "Disane87";
const TOP_N = 6;
const README_PATH = "README.md";
const START = "<!-- PROJECTS:START -->";
const END = "<!-- PROJECTS:END -->";

const EMOJI_BY_LANG = {
  TypeScript: "🟦",
  JavaScript: "🟨",
  Python: "🐍",
  Go: "🐹",
  Rust: "🦀",
  PHP: "🐘",
  Shell: "🐚",
  HTML: "🌐",
  CSS: "🎨",
  Vue: "💚",
  Dockerfile: "🐳",
  C: "🔵",
  "C++": "🔵",
  "C#": "🟪",
};

const token = process.env.GITHUB_TOKEN;
if (!token) {
  console.error("GITHUB_TOKEN missing");
  process.exit(1);
}

async function gh(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "disane-readme-updater",
    },
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

async function fetchAllRepos() {
  const repos = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await gh(
      `/users/${USER}/repos?per_page=100&page=${page}&sort=pushed&type=owner`,
    );
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  return repos;
}

function pickProjects(repos) {
  return repos
    .filter((r) => !r.fork && !r.archived && !r.private && !r.disabled)
    .filter((r) => r.name.toLowerCase() !== USER.toLowerCase())
    .filter((r) => r.description && r.description.trim().length > 0)
    .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at))
    .slice(0, TOP_N);
}

function renderProject(repo) {
  const emoji = EMOJI_BY_LANG[repo.language] ?? "📦";
  const lines = [
    `### [${emoji} ${repo.name}](${repo.html_url})`,
    repo.description.trim(),
  ];
  if (repo.language) lines.push(`- **Language:** ${repo.language}`);
  if (repo.topics && repo.topics.length > 0) {
    lines.push(`- **Topics:** ${repo.topics.slice(0, 6).join(", ")}`);
  }
  lines.push(
    `- ⭐ ${repo.stargazers_count} · 🍴 ${repo.forks_count} · last push ${repo.pushed_at.slice(0, 10)}`,
  );
  return lines.join("\n");
}

function buildBlock(projects) {
  const today = new Date().toISOString().slice(0, 10);
  const body = projects.map(renderProject).join("\n\n");
  return [
    START,
    "## 🛠️ My Recent Projects",
    "",
    `_Auto-updated daily — last refresh: ${today}_`,
    "",
    body,
    "",
    END,
  ].join("\n");
}

function replaceBlock(readme, block) {
  const startIdx = readme.indexOf(START);
  const endIdx = readme.indexOf(END);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error("Markers not found in README.md");
  }
  return readme.slice(0, startIdx) + block + readme.slice(endIdx + END.length);
}

const repos = await fetchAllRepos();
const projects = pickProjects(repos);
if (projects.length === 0) {
  console.error("No projects matched filters");
  process.exit(1);
}

const readme = readFileSync(README_PATH, "utf8");
const next = replaceBlock(readme, buildBlock(projects));

if (next === readme) {
  console.log("No changes.");
  process.exit(0);
}

writeFileSync(README_PATH, next);
console.log(`Updated README with ${projects.length} projects.`);
