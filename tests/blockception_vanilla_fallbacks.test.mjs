import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { vanillaFallbackReason } from "../tools/blockception_vanilla_fallbacks.mjs";

describe("Blockception vanilla fallback allowlist", () => {
  it("ignores only exact vanilla animation references documented by the base pack", () => {
    assert.equal(
      vanillaFallbackReason({
        file: "addon/RP/entity/cat.entity.json",
        code: "resourcepack.anim_or_controller.missing",
        message: "Missing animation.animation.cat.baby_transform",
      }),
      "vanilla client animation animation.cat.baby_transform",
    );
    assert.equal(
      vanillaFallbackReason({
        file: "addon/RP/entity/sheep.entity.json",
        code: "resourcepack.anim_or_controller.missing",
        message: "Missing animation.sheep.setup.v2",
      }),
      "vanilla client animation animation.sheep.setup.v2",
    );
  });

  it("keeps unknown animations strict even inside a vanilla entity override", () => {
    assert.equal(
      vanillaFallbackReason({
        file: "addon/RP/entity/cat.entity.json",
        code: "resourcepack.anim_or_controller.missing",
        message: "Missing animation.paradise.custom_missing",
      }),
      null,
    );
    assert.equal(
      vanillaFallbackReason({
        file: "addon/RP/entity/paradise_custom.entity.json",
        code: "resourcepack.anim_or_controller.missing",
        message: "Missing animation.paradise.custom_missing",
      }),
      null,
    );
  });

  it("retains exact vanilla spawn-egg and terrain texture fallbacks", () => {
    assert.equal(
      vanillaFallbackReason({
        file: "addon/RP/entity/cat.entity.json",
        code: "behaviorpack.item.components.texture_not_found",
        message: 'Texture "spawn_egg_cat" was not found',
      }),
      "vanilla spawn-egg texture alias spawn_egg_cat",
    );
    assert.equal(
      vanillaFallbackReason({
        file: "addon/RP/textures/terrain_texture.json",
        code: "resourcepack.texture.missing",
        message: "Missing textures/blocks/cake",
      }),
      "vanilla terrain texture textures/blocks/cake",
    );
    assert.equal(
      vanillaFallbackReason({
        file: "addon/RP/entity/cat.entity.json",
        code: "behaviorpack.item.components.texture_not_found",
        message: 'Texture "paradise_custom_spawn_egg" was not found',
      }),
      null,
    );
  });

  it("requires exact terrain-reference boundaries on both sides", () => {
    const diagnostic = (message) => vanillaFallbackReason({
      file: "addon/RP/textures/terrain_texture.json",
      code: "resourcepack.texture.missing",
      message,
    });

    for (const message of [
      "textures/blocks/cake",
      "Missing textures/blocks/cake",
      'Missing ("textures/blocks/cake").',
    ]) {
      assert.equal(diagnostic(message), "vanilla terrain texture textures/blocks/cake");
    }

    for (const message of [
      "Missing mytextures/blocks/cake",
      "Missing 1textures/blocks/cake",
      "Missing _textures/blocks/cake",
      "Missing .textures/blocks/cake",
      "Missing -textures/blocks/cake",
      "Missing custom/textures/blocks/cake",
      "Missing custom\\textures/blocks/cake",
      "Missing custom:textures/blocks/cake",
      "Missing textures/blocks/cake_missing",
      "Missing textures/blocks/cake-extra",
      "Missing textures/blocks/cake.extra",
      "Missing textures/blocks/cake/extra",
      "Missing textures/blocks/cake\\extra",
      "Missing textures/blocks/cake:variant",
    ]) {
      assert.equal(diagnostic(message), null, message);
    }
  });

  it("recognizes exact vanilla animations without accepting prefixed or extended identifiers", () => {
    const cases = [
      ["camel.entity.json", "animation.camel.look_at_target"],
      ["cat.entity.json", "animation.cat.baby_transform"],
      ["fox.entity.json", "animation.fox.baby_transform"],
      ["sheep.entity.json", "animation.sheep.setup.v2"],
      ["sheep.entity.json", "animation.sheep.baby_transform"],
    ];

    for (const [fileName, reference] of cases) {
      const diagnostic = (message) => vanillaFallbackReason({
        file: `addon/RP/entity/${fileName}`,
        code: "resourcepack.anim_or_controller.missing",
        message,
      });

      assert.equal(diagnostic(reference), `vanilla client animation ${reference}`);
      assert.equal(diagnostic(`Missing (${reference}).`), `vanilla client animation ${reference}`);
    }

    const catDiagnostic = (message) => vanillaFallbackReason({
      file: "addon/RP/entity/cat.entity.json",
      code: "resourcepack.anim_or_controller.missing",
      message,
    });
    assert.equal(
      catDiagnostic("Missing animation.animation.cat.baby_transform"),
      "vanilla client animation animation.cat.baby_transform",
    );

    for (const message of [
      "Missing custom.animation.cat.baby_transform",
      "Missing custom/animation.cat.baby_transform",
      "Missing custom\\animation.cat.baby_transform",
      "Missing custom:animation.cat.baby_transform",
      "Missing xanimation.cat.baby_transform",
      "Missing animation.cat.baby_transform_custom",
      "Missing animation.cat.baby_transform/extra",
      "Missing animation.cat.baby_transform\\extra",
      "Missing animation.cat.baby_transform:custom",
    ]) {
      assert.equal(catDiagnostic(message), null, message);
    }
  });

  it("does not hide missing custom suffixes or the obsolete smoker texture path", () => {
    for (const texture of ["textures/blocks/cake_missing", "textures/blocks/smoker_front_on_1"]) {
      assert.equal(vanillaFallbackReason({
        file: "addon/RP/textures/terrain_texture.json",
        code: "resourcepack.texture.missing",
        message: `Missing ${texture}`,
      }), null);
    }
    assert.equal(vanillaFallbackReason({
      file: "addon/RP/entity/cat.entity.json",
      code: "resourcepack.anim_or_controller.missing",
      message: "Missing animation.cat.baby_transform_custom",
    }), null);
  });

  it("keeps the smoker atlas entry aligned with its existing vanilla texture and flipbook", () => {
    const root = new URL("../addon/RP/", import.meta.url);
    const terrain = JSON.parse(readFileSync(new URL("textures/terrain_texture.json", root), "utf8"));
    const texture = terrain.texture_data.smoker_front_on.textures;
    assert.equal(texture, "textures/blocks/smoker_front_on");
    assert.equal(existsSync(new URL(`${texture}.png`, root)), true);
    const flipbook = readFileSync(new URL("textures/flipbook_textures.json", root), "utf8");
    assert.match(flipbook, /"flipbook_texture":\s*"textures\/blocks\/smoker_front_on"\s*,\s*"atlas_tile":\s*"smoker_front_on"/);
  });
});
