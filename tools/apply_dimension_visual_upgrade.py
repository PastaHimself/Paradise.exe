#!/usr/bin/env python3
"""Apply the approved visual-only dimension changes deterministically.

This script is intentionally idempotent. It is used by GitHub Actions to make
large JavaScript edits without hand-replacing entire 30-80 KB files through the
Contents API.
"""

from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "addon" / "Genshin X Craft BP" / "scripts"


def replace_once(path: Path, old: str, new: str) -> bool:
    text = path.read_text(encoding="utf-8")
    if new in text:
        return False
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"Expected exactly one match in {path}: {old[:80]!r}; found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    return True


def regex_replace_once(path: Path, pattern: str, replacement: str) -> bool:
    text = path.read_text(encoding="utf-8")
    if replacement in text:
        return False
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.DOTALL)
    if count != 1:
        raise RuntimeError(f"Expected exactly one regex match in {path}: {pattern!r}; found {count}")
    path.write_text(updated, encoding="utf-8")
    return True


def patch_yellow_halls() -> None:
    path = SCRIPTS / "yellow_halls.js"
    replace_once(
        path,
        "const PROXIMITY_CHECK_TICKS = 5;\nconst WEATHER_REFRESH_TICKS = 20 * 60 * 5;",
        "const PROXIMITY_CHECK_TICKS = 5;\n"
        "const WEATHER_REFRESH_TICKS = 20 * 60 * 5;\n"
        "const FLICKER_MIN_GAP_TICKS = 80;\n"
        "const FLICKER_MAX_GAP_TICKS = 260;\n"
        "const FLICKER_BURST_MIN_TICKS = 3;\n"
        "const FLICKER_BURST_MAX_TICKS = 10;",
    )
    replace_once(
        path,
        "  flickerOn: false,\n  flickeredLights: new Map(),",
        "  flickerOn: false,\n"
        "  nextFlickerTick: FLICKER_MIN_GAP_TICKS,\n"
        "  flickerRestoreTick: 0,\n"
        "  flickeredLights: new Map(),",
    )
    replace_once(path, "if (cellRng() < 0.75) {", "if (cellRng() < 0.62) {")

    replacement = '''function restoreFlickeredLights(dimension) {
  for (const [posKey, originalPermutation] of state.flickeredLights.entries()) {
    const [x, y, z] = posKey.split(":").map(Number);
    const position = { x, y, z };
    try {
      if (typeof dimension.isChunkLoaded === "function" && !dimension.isChunkLoaded(position)) {
        continue;
      }
      const block = dimension.getBlock(position);
      if (block && setBlockPermutationSafe(block, originalPermutation)) {
        state.flickeredLights.delete(posKey);
      }
    } catch (_error) {}
  }
  state.flickerOn = false;
}

function flickerLightsNearPlayer(dimension, player) {
  const now = system.currentTick;

  // A light from an earlier burst may have been in an unloaded chunk when its
  // restore window elapsed. Retry loaded pending entries without discarding the
  // positions that are still unavailable.
  if (!state.flickerOn && state.flickeredLights.size > 0) {
    restoreFlickeredLights(dimension);
  }

  if (state.flickerOn) {
    if (now < state.flickerRestoreTick) return;
    restoreFlickeredLights(dimension);
    state.nextFlickerTick = now + randomInt(FLICKER_MIN_GAP_TICKS, FLICKER_MAX_GAP_TICKS);
    return;
  }

  if (now < state.nextFlickerTick) return;

  const px = Math.floor(player.location.x);
  const pz = Math.floor(player.location.z);
  const targetCount = randomInt(1, 3);
  let disabled = 0;

  for (let attempt = 0; attempt < 18 && disabled < targetCount; attempt++) {
    const position = {
      x: px + randomInt(-12, 12),
      y: CEILING_Y,
      z: pz + randomInt(-12, 12),
    };
    try {
      if (typeof dimension.isChunkLoaded === "function" && !dimension.isChunkLoaded(position)) {
        continue;
      }
      const block = dimension.getBlock(position);
      if (!block || block.typeId !== BLOCK.seaLantern) continue;
      const posKey = `${position.x}:${position.y}:${position.z}`;
      if (state.flickeredLights.has(posKey)) continue;
      state.flickeredLights.set(posKey, block.permutation);
      setBlockPermutationSafe(block, BLOCK.air);
      disabled++;
    } catch (_error) {}
  }

  if (disabled > 0) {
    state.flickerOn = true;
    state.flickerRestoreTick = now + randomInt(FLICKER_BURST_MIN_TICKS, FLICKER_BURST_MAX_TICKS);
  } else {
    state.nextFlickerTick = now + randomInt(20, 60);
  }
}

function handleEscapeProximity'''
    regex_replace_once(
        path,
        r"function restoreFlickeredLights\(dimension\) \{.*?\n\}\n\nfunction flickerLightsNearPlayer\(dimension, player\) \{.*?\n\}\n\nfunction handleEscapeProximity|function flickerLightsNearPlayer\(dimension, player\) \{.*?\n\}\n\nfunction handleEscapeProximity",
        replacement,
    )

    first_no_player_patch = (
        "  if (!players.length) {\n"
        "    if (state.flickerOn) {\n"
        "      restoreFlickeredLights(dimension);\n"
        "      state.nextFlickerTick = system.currentTick + randomInt(FLICKER_MIN_GAP_TICKS, FLICKER_MAX_GAP_TICKS);\n"
        "    }\n"
        "    if (system.currentTick >= state.nextWeatherRefreshTick) {"
    )
    replace_once(
        path,
        "  if (!players.length) {\n    if (system.currentTick >= state.nextWeatherRefreshTick) {",
        first_no_player_patch,
    )
    replace_once(
        path,
        first_no_player_patch,
        "  if (!players.length) {\n"
        "    if (state.flickerOn || state.flickeredLights.size > 0) {\n"
        "      restoreFlickeredLights(dimension);\n"
        "      state.nextFlickerTick = system.currentTick + randomInt(FLICKER_MIN_GAP_TICKS, FLICKER_MAX_GAP_TICKS);\n"
        "    }\n"
        "    if (system.currentTick >= state.nextWeatherRefreshTick) {",
    )


def patch_catacombs() -> None:
    path = SCRIPTS / "catacombs.js"
    replace_once(path, "const FLICKER_ACTIVE_DISTANCE = 72;", "const FLICKER_ACTIVE_DISTANCE = 56;")
    replace_once(path, "const MAX_FLICKER_LIGHT_NODES = 32;", "const MAX_FLICKER_LIGHT_NODES = 48;")
    replace_once(path, "    onTicksMin: options.onTicksMin ?? 20,", "    onTicksMin: options.onTicksMin ?? 140,")
    replace_once(path, "    onTicksMax: options.onTicksMax ?? 120,", "    onTicksMax: options.onTicksMax ?? 420,")
    replace_once(path, "    offTicksMax: options.offTicksMax ?? 10,", "    offTicksMax: options.offTicksMax ?? 12,")
    replace_once(path, "    burstChance: options.burstChance ?? 0.25,", "    burstChance: options.burstChance ?? 0.18,")


def patch_flat_flower() -> None:
    path = SCRIPTS / "flat_flower.js"
    replace_once(path, "const FLOWER_DENSITY = 0.82;", "const FLOWER_DENSITY = 0.76;")
    replace_once(path, "const MAX_LIGHT_ANCHORS_PER_PATCH = 16;", "const MAX_LIGHT_ANCHORS_PER_PATCH = 8;")


def patch_burning_highway() -> None:
    path = SCRIPTS / "burning_highway.js"
    replace_once(
        path,
        "const ROAD_BLOCK_WEIGHTS = [\n"
        "  { type: BLOCK.netherrack, weight: 70 },\n"
        "  { type: BLOCK.blackstone, weight: 22 },\n"
        "  { type: BLOCK.obsidian, weight: 8 },\n"
        "];",
        "const ROAD_BLOCK_WEIGHTS = [\n"
        "  { type: BLOCK.netherrack, weight: 18 },\n"
        "  { type: BLOCK.blackstone, weight: 46 },\n"
        "  { type: BLOCK.crackedPolishedBlackstoneBricks, weight: 28 },\n"
        "  { type: BLOCK.obsidian, weight: 8 },\n"
        "];",
    )


def patch_endless_staircase() -> None:
    path = SCRIPTS / "endless_staircase.js"
    replace_once(
        path,
        '  stair: "minecraft:stone_brick_stairs",',
        '  stair: "minecraft:deepslate_brick_stairs",',
    )


def patch_heaven() -> None:
    path = SCRIPTS / "heaven.js"
    replace_once(
        path,
        "  dim.fillBlocks(\n"
        "    new BlockVolume({ x: ox, y: FLOOR_Y, z: oz }, { x: ox + 15, y: FLOOR_Y, z: oz + 15 }),\n"
        '    "minecraft:white_concrete",\n'
        "  );",
        "  dim.fillBlocks(\n"
        "    new BlockVolume({ x: ox, y: FLOOR_Y, z: oz }, { x: ox + 15, y: FLOOR_Y, z: oz + 15 }),\n"
        '    "minecraft:light_gray_concrete",\n'
        "  );",
    )


def patch_library() -> None:
    path = SCRIPTS / "library.js"
    replace_once(
        path,
        '    fillSafe(dim, { x: ox + lx, y: CEILING_Y, z: oz + lz }, { x: ox + lx, y: CEILING_Y, z: oz + lz }, "minecraft:sea_lantern");',
        '    fillSafe(dim, { x: ox + lx, y: CEILING_Y, z: oz + lz }, { x: ox + lx, y: CEILING_Y, z: oz + lz }, "minecraft:glowstone");',
    )


def main() -> None:
    patch_yellow_halls()
    patch_catacombs()
    patch_flat_flower()
    patch_burning_highway()
    patch_endless_staircase()
    patch_heaven()
    patch_library()
    print("Dimension visual upgrade patches are applied.")


if __name__ == "__main__":
    main()
