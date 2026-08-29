import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { test } from "node:test";

const definitionsUrl = new URL("../addon/Genshin X Craft RP/sounds/sound_definitions.json", import.meta.url);
const audioRootUrl = new URL("../addon/Genshin X Craft RP/sounds/", import.meta.url);

test("custom sound definitions resolve to shipped OGG files", async () => {
  const definitions = JSON.parse(await readFile(definitionsUrl, "utf8")).sound_definitions;
  const checkedNames = new Set();

  for (const [cueId, definition] of Object.entries(definitions)) {
    for (const sound of definition.sounds || []) {
      const name = typeof sound === "string" ? sound : sound.name;
      if (!name?.startsWith("sounds/paradise_horror/")) continue;
      const relativePath = name.slice("sounds/".length) + ".ogg";
      assert.equal(checkedNames.has(relativePath), false, `duplicate sound entry: ${relativePath}`);
      checkedNames.add(relativePath);
      await access(new URL(relativePath, audioRootUrl));
      assert.match(relativePath, /\.ogg$/);
    }
    assert.ok(cueId.length > 0);
  }

  assert.ok(checkedNames.size >= 20);
});
