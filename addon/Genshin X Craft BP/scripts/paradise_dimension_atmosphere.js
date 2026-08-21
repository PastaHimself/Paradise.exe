import { system, world } from "@minecraft/server";
import { applyFogConfig } from "./player_config.js";
import { applyFogLayer } from "./paradise_fog_runtime.js";
import { getVisualBudget } from "./paradise_visual_budget.js";

const FOG_TAG = "paradise_dimension_atmosphere";
const ATMOSPHERE = Object.freeze({
  "paradise:yellow_halls": { fog: "paradise:yellow_halls_fog", particle: "paradise:dust_mote", y: 1.2 },
  "paradise:flat_flower": { fog: "paradise:flat_flower_fog", particle: "paradise:pollen_mote", y: 1.0 },
  "paradise:endless_staircase": { fog: "paradise:endless_staircase_fog", particle: "paradise:dust_mote", y: 1.8 },
  "paradise:burning_highway": { fog: "paradise:burning_highway_fog", particle: "paradise:ash_fleck", y: 2.0 },
  "catacombs:catacomb_mazes": { fog: "paradise:catacombs_fog", particle: "paradise:dust_mote", y: 1.1 },
  "heaven:the_heaven": { fog: "paradise:heaven_fog", particle: "paradise:celestial_mote", y: 2.2 },
  "library:the_library": { fog: "paradise:library_fog", particle: "paradise:dust_mote", y: 1.5 },
});

const nextParticleTick = new Map();

export function applyDimensionAtmosphere(player) {
  if (!player) return false;
  const config = ATMOSPHERE[player?.dimension?.id];
  const applied = applyFogLayer(player, config?.fog, FOG_TAG);

  // Re-apply the user's clear-fog preference after the dimension layer so it
  // remains the highest-precedence override when fog is disabled.
  applyFogConfig(player);
  return applied;
}

function pulseAmbientParticles() {
  const now = system.currentTick;
  for (const player of world.getAllPlayers()) {
    const config = ATMOSPHERE[player?.dimension?.id];
    if (!config) continue;
    const budget = getVisualBudget(player);
    if (budget.particleBurst <= 0) continue;
    const due = nextParticleTick.get(player.id) ?? 0;
    if (now < due) continue;
    nextParticleTick.set(player.id, now + budget.particlePulseTicks);

    for (let i = 0; i < budget.particleBurst; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 3 + Math.random() * Math.max(1, budget.particleRadius - 3);
      const location = {
        x: player.location.x + Math.cos(angle) * radius,
        y: player.location.y + config.y + (Math.random() - 0.5) * 2.5,
        z: player.location.z + Math.sin(angle) * radius,
      };
      try {
        player.dimension.spawnParticle(config.particle, location);
      } catch (_error) {}
    }
  }
}

world.afterEvents.playerDimensionChange.subscribe((event) => {
  system.run(() => applyDimensionAtmosphere(event.player));
});

world.afterEvents.playerSpawn.subscribe((event) => {
  system.run(() => applyDimensionAtmosphere(event.player));
});

world.afterEvents.playerLeave.subscribe((event) => {
  nextParticleTick.delete(event.playerId);
});

system.runInterval(pulseAmbientParticles, 10);
