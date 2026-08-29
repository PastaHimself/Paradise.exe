import test from "node:test";
import assert from "node:assert/strict";
import { getFfmpegArgs, validateManifestAsset } from "../tools/prepare_audio_assets.mjs";

const manifest = {
  profiles: {
    positional: { channels: 1, sampleRate: 44100, codec: "vorbis", quality: 3 },
    ambience: { channels: 2, sampleRate: 44100, codec: "vorbis", quality: 4 }
  }
};

const baseAsset = {
  sourceArchive: "sounds.zip",
  sourcePath: "source.wav",
  targetPath: "paradise_horror/test.ogg",
  cueId: "paradise.test",
  profile: "positional",
  role: "test",
  licenseUrl: "https://example.com/license",
  credit: "Test"
};

test("builds the mono compressed OGG profile", () => {
  const args = getFfmpegArgs("input.wav", "output.ogg", manifest.profiles.positional);
  assert.deepEqual(args.slice(-9), ["-ac", "1", "-ar", "44100", "-c:a", "libvorbis", "-q:a", "3", "output.ogg"]);
  assert.ok(args.includes("-map_metadata"));
});

test("builds the stereo ambience profile", () => {
  const args = getFfmpegArgs("input.wav", "output.ogg", manifest.profiles.ambience);
  assert.deepEqual(args.slice(-9), ["-ac", "2", "-ar", "44100", "-c:a", "libvorbis", "-q:a", "4", "output.ogg"]);
});

test("rejects non-OGG output targets", () => {
  assert.throws(() => validateManifestAsset({ ...baseAsset, targetPath: "test.wav" }, manifest), /OGG/);
});

test("accepts a traceable manifest entry", () => {
  assert.equal(validateManifestAsset(baseAsset, manifest).channels, 1);
});
