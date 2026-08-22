import { system, world } from "@minecraft/server";
import { applyFogConfig } from "./player_config.js";
import { applyFogLayer } from "./paradise_fog_runtime.js";
import { getVisualBudget } from "./paradise_visual_budget.js";
import { DIMENSION_VISUAL_PROFILES } from "./paradise_dimension_visual_profiles.js";

const FOG_TAG = "paradise_dimension_atmosphere";
const nextParticleTick = new Map();

export function applyDimensionAtmosphere(player) {
  if (!player) return false;
  const profile = DIMENSION_VISUAL_PROFILES[player?.dimension?.id];
  const applied = applyFogLayer(player, profile?.fog, FOG_TAG);
  applyFogConfig(player);
  return applied;
}

function pulseAmbientParticles() {
  const now = system.currentTick;

  for (const player of world.getAllPlayers()) {
    const profile = DIMENSION_VISUAL_PROFILES[player?.dimension?.id];
    if (!profile) continue;

    const budget = getVisualBudget(player);
    if (budget.particleBurst <= 0) continue;

    const due = nextParticleTick.get(player.id) ?? 0;
    if (now < due) continue;
    nextParticleTick.set(player.id, now + budget.particlePulseTicks);

    const radiusMax = Math.max(4, budget.particleRadius * profile.radiusScale);
    for (let i = 0; i < budget.particleBurst; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 3 + Math.random() * Math.max(1, radiusMax - 3);
      const location = {
        x: player.location.x + Math.cos(angle) * radius,
        y: player.location.y + profile.ambientY + (Math.random() - 0.5) * profile.verticalSpread,
        z: player.location.z + Math.sin(angle) * radius,
      };

      try {
        player.dimension.spawnParticle(profile.particle, location);
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
