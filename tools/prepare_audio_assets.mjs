#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULT_BUDGET_BYTES = 75 * 1024 * 1024;

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    args[key] = argv[index + 1];
    index += 1;
  }
  return args;
}

function requireArg(args, name) {
  if (!args[name]) throw new Error(`Missing required argument --${name}`);
  return args[name];
}

function profileFor(asset, manifest) {
  const profile = manifest.profiles?.[asset.profile];
  if (!profile) throw new Error(`Unknown audio profile: ${asset.profile}`);
  return profile;
}

export function getFfmpegArgs(input, output, profile) {
  return [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    input,
    "-map_metadata",
    "-1",
    "-vn",
    "-ac",
    String(profile.channels),
    "-ar",
    String(profile.sampleRate),
    "-c:a",
    "libvorbis",
    "-q:a",
    String(profile.quality),
    output,
  ];
}

export function validateManifestAsset(asset, manifest) {
  if (!asset || typeof asset !== "object") throw new Error("Audio manifest entry must be an object");
  for (const field of ["sourceArchive", "sourcePath", "targetPath", "cueId", "profile", "role", "licenseUrl", "credit"]) {
    if (!String(asset[field] || "").trim()) throw new Error(`Audio manifest entry is missing ${field}`);
  }
  if (!asset.targetPath.endsWith(".ogg")) throw new Error(`Audio target must be OGG: ${asset.targetPath}`);
  const profile = profileFor(asset, manifest);
  if (![1, 2].includes(Number(profile.channels))) throw new Error(`Unsupported channel count: ${profile.channels}`);
  if (Number(profile.sampleRate) !== 44100) throw new Error(`Audio sample rate must be 44100: ${asset.targetPath}`);
  if (profile.codec !== "vorbis") throw new Error(`Audio codec must be Vorbis: ${asset.targetPath}`);
  return profile;
}

function walkFiles(root) {
  const result = [];
  if (!fs.existsSync(root)) return result;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) result.push(...walkFiles(fullPath));
    else result.push(fullPath);
  }
  return result;
}

export function resolveSourcePath(sourceRoot, asset) {
  const direct = path.resolve(sourceRoot, asset.sourcePath);
  if (fs.existsSync(direct)) return direct;
  const normalizedTarget = asset.sourcePath.split(path.sep).join("/").toLowerCase();
  const matches = walkFiles(sourceRoot).filter((candidate) => {
    const relative = path.relative(sourceRoot, candidate).split(path.sep).join("/").toLowerCase();
    return relative === normalizedTarget || relative.endsWith(`/${normalizedTarget}`);
  });
  if (matches.length !== 1) {
    throw new Error(`Expected one source for ${asset.sourcePath}, found ${matches.length}`);
  }
  return matches[0];
}

function probe(filePath) {
  const raw = execFileSync("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "a:0",
    "-show_entries",
    "stream=codec_name,sample_rate,channels,duration",
    "-of",
    "json",
    filePath,
  ], { encoding: "utf8" });
  const stream = JSON.parse(raw).streams?.[0];
  if (!stream) throw new Error(`FFprobe found no audio stream: ${filePath}`);
  return {
    codec: stream.codec_name,
    sampleRate: Number(stream.sample_rate),
    channels: Number(stream.channels),
    durationSeconds: Number(stream.duration || 0),
  };
}

export function prepareAudioAssets({ manifestPath, sourceRoot, outputRoot, reportPath }) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const seenTargets = new Set();
  const seenCueIds = new Set();
  const entries = [];

  for (const asset of manifest.assets || []) {
    validateManifestAsset(asset, manifest);
    if (seenTargets.has(asset.targetPath)) throw new Error(`Duplicate target: ${asset.targetPath}`);
    if (seenCueIds.has(asset.cueId)) {
      // Variant entries intentionally share a cue ID; the target path remains the unique key.
    }
    seenTargets.add(asset.targetPath);
    seenCueIds.add(asset.cueId);

    const input = resolveSourcePath(sourceRoot, asset);
    const output = path.resolve(outputRoot, asset.targetPath);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    const profile = profileFor(asset, manifest);
    execFileSync("ffmpeg", getFfmpegArgs(input, output, profile), { stdio: "inherit" });
    const probeResult = probe(output);
    if (probeResult.codec !== "vorbis") throw new Error(`Output is not Vorbis: ${output}`);
    if (probeResult.sampleRate !== Number(profile.sampleRate)) throw new Error(`Wrong sample rate: ${output}`);
    if (probeResult.channels !== Number(profile.channels)) throw new Error(`Wrong channel count: ${output}`);
    entries.push({
      ...asset,
      inputBytes: fs.statSync(input).size,
      outputBytes: fs.statSync(output).size,
      durationSeconds: probeResult.durationSeconds,
      codec: probeResult.codec,
      sampleRate: probeResult.sampleRate,
      channels: probeResult.channels,
    });
  }

  const totalBytes = entries.reduce((sum, entry) => sum + entry.outputBytes, 0);
  const budgetBytes = Number(manifest.totalBudgetBytes || DEFAULT_BUDGET_BYTES);
  const report = {
    manifestPath,
    sourceRoot,
    outputRoot,
    budgetBytes,
    totalBytes,
    withinBudget: totalBytes <= budgetBytes,
    assets: entries,
  };
  fs.mkdirSync(path.dirname(path.resolve(reportPath)), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
  if (!report.withinBudget) throw new Error(`Audio budget exceeded: ${totalBytes} > ${budgetBytes}`);
  return report;
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  return prepareAudioAssets({
    manifestPath: requireArg(args, "manifest"),
    sourceRoot: requireArg(args, "source-root"),
    outputRoot: requireArg(args, "output-root"),
    reportPath: requireArg(args, "report"),
  });
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  try {
    main();
  } catch (error) {
    console.error(`Audio preparation failed: ${error.message}`);
    process.exitCode = 1;
  }
}
