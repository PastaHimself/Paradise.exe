import { system, world } from "@minecraft/server";
import { applyDimensionAtmosphere, clearDimensionAtmospherePlayer } from "./paradise_dimension_atmosphere.js";
import { syncPlayerAmbient, stopPlayerAmbient } from "./paradise_ambient_audio.js";
import { clearPlayerAudioState } from "./horror_audio.js";

function schedulePlayerRefresh(player) {
  if (!player) return;
  system.run(() => {
    try {
      applyDimensionAtmosphere(player);
      syncPlayerAmbient(player, { forceRestart: true });
    } catch (_error) {}
  });
}

world.afterEvents.playerDimensionChange.subscribe((event) => {
  schedulePlayerRefresh(event.player);
});

world.afterEvents.playerSpawn.subscribe((event) => {
  schedulePlayerRefresh(event.player);
});

world.afterEvents.playerLeave.subscribe((event) => {
  stopPlayerAmbient(event.playerId);
  clearPlayerAudioState(event.playerId);
  clearDimensionAtmospherePlayer(event.playerId);
});

system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    try {
      syncPlayerAmbient(player);
    } catch (_error) {}
  }
}, 20);
