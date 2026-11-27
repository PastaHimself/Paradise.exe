import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { DIMENSION_VISUAL_PROFILES } from "../addon/BP/scripts/paradise_dimension_visual_profiles.js";
import { spawnParticleForPlayer } from "../addon/BP/scripts/paradise_particle_dispatch.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("player-scoped dimension particles", () => {
  it("dispatches only to the selected player's client, even when dimensions are shared", () => {
    const sharedDimensionCalls = [];
    const playerACalls = [];
    const playerBCalls = [];
    const sharedDimension = {
      spawnParticle(particleId, location) {
        sharedDimensionCalls.push({ particleId, location });
      },
    };
    const playerA = {
      dimension: sharedDimension,
      spawnParticle(particleId, location) {
        playerACalls.push({ particleId, location });
      },
    };
    const playerB = {
      dimension: sharedDimension,
      spawnParticle(particleId, location) {
        playerBCalls.push({ particleId, location });
      },
    };
    const locationA = { x: -33, y: 66, z: 12 };
    const locationB = { x: 65, y: 67, z: -1 };

    assert.equal(spawnParticleForPlayer(playerA, "paradise:dust_mote", locationA), true);
    assert.equal(spawnParticleForPlayer(playerB, "paradise:ash_fleck", locationB), true);

    assert.deepEqual(playerACalls, [{ particleId: "paradise:dust_mote", location: locationA }]);
    assert.deepEqual(playerBCalls, [{ particleId: "paradise:ash_fleck", location: locationB }]);
    assert.deepEqual(sharedDimensionCalls, []);
  });

  it("rejects missing players and missing spawnParticle capabilities", () => {
    assert.equal(spawnParticleForPlayer(undefined, "paradise:dust_mote", { x: 0, y: 64, z: 0 }), false);
    assert.equal(spawnParticleForPlayer({}, "paradise:dust_mote", { x: 0, y: 64, z: 0 }), false);
    assert.equal(spawnParticleForPlayer({ spawnParticle() {} }, "", { x: 0, y: 64, z: 0 }), false);
  });

  it("resolves every profile particle ID to a matching RP definition and texture", () => {
    const particleIds = new Set(Object.values(DIMENSION_VISUAL_PROFILES).map((profile) => profile.particle));
    for (const particleId of particleIds) {
      const [namespace, name] = particleId.split(":");
      const definitionPath = path.join(ROOT, "addon/RP/particles", `${namespace}_${name}.json`);
      assert.equal(existsSync(definitionPath), true, `missing particle definition for ${particleId}`);
      const definition = JSON.parse(readFileSync(definitionPath, "utf8"));
      assert.equal(definition.particle_effect.description.identifier, particleId);
      const texture = definition.particle_effect.description.basic_render_parameters.texture;
      assert.equal(existsSync(path.join(ROOT, "addon/RP", `${texture}.png`)), true, `missing texture for ${particleId}`);
    }
  });
});
