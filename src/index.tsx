#!/usr/bin/env node
import "dotenv/config";
import React from "react";
import { render } from "ink";
import { App } from "./ui/App";

// ─── Validate required env vars ───────────────────────────────────────────────
const required = ["OPENAI_API_KEY"];
const missing = required.filter((k) => !process.env[k]);

if (missing.length > 0) {
  console.error(`\n❌ Missing required environment variables:\n`);
  missing.forEach((k) => console.error(`   ${k}`));
  console.error(`\nCopy .env.example → .env and fill in your keys.\n`);
  process.exit(1);
}

// Optional warning for tools that may degrade gracefully
const optional = [
  ["TAVILY_API_KEY", "web search will be unavailable"],
  ["YOUTUBE_API_KEY", "YouTube search will be unavailable"],
  ["OBSIDIAN_VAULT_PATH", "Obsidian notes search will be unavailable"],
];
for (const [key, msg] of optional) {
  if (!process.env[key]) {
    console.warn(`⚠  ${key} not set — ${msg}`);
  }
}

// ─── Launch the Ink terminal UI ───────────────────────────────────────────────
const { waitUntilExit } = render(<App />);

// Gracefully handle exit
waitUntilExit()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });