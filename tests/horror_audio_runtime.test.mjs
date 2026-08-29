import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const audioSourceUrl = new URL("../addon/Genshin X Craft BP/scripts/horror_audio.js", import.meta.url);

test("positional cues can be private to one player and can be cleaned up", async () => {
  const source = await readFile(audioSourceUrl, "utf8");
  assert.match(source, /export function clearPlayerAudioState/);
  assert.match(source, /playerOrDimension\?\.dimension && typeof playerOrDimension\.playSound === "function"/);
  assert.match(source, /return playForOnePlayer\(playerOrDimension, soundId/);
  assert.match(source, /dimension\.playSound\(soundId, safeLocation\(location\)/);
});
