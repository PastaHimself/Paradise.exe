import {
  CommandPermissionLevel,
  CustomCommandStatus,
  system,
  world,
} from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import { applyFogLayer } from "./paradise_fog_runtime.js";

const CONFIG_COMMAND_ID = "p:config";
const CONFIG_TITLE = "Paradise.jar Config";
const SAVE_MESSAGE = "Paradise config saved.";
const SPAWN_CONFIG_HINT_MESSAGE = "To open config do /p:config.";

const FOG_PROPERTY_KEY = "paradise:config_fog_enabled";
const VHS_PROPERTY_KEY = "paradise:config_vhs_enabled";

const FOG_DISABLED_TAG = "paradise_config_fog_disabled";
const VHS_DISABLED_TAG = "paradise_config_vhs_disabled";
const VHS_OFF_TOKEN = "PARADISE_VHS_OFF";

const CLEAR_FOG_ID = "paradise:clear_fog";
const FOG_OVERRIDE_TAG = "paradise_config_fog_override";

const vhsPreferenceListeners = new Set();

function isPlayer(value) {
  try {
    return !!value && value.typeId === "minecraft:player";
  } catch (_error) {
    return false;
  }
}

function safeHasTag(player, tag) {
  try {
    return !!player && typeof player.hasTag === "function" && player.hasTag(tag);
  } catch (_error) {
    return false;
  }
}

function safeAddTag(player, tag) {
  try {
    if (player && typeof player.addTag === "function" && !safeHasTag(player, tag)) {
      player.addTag(tag);
    }
  } catch (_error) {}
}

function safeRemoveTag(player, tag) {
  try {
    if (player && typeof player.removeTag === "function" && safeHasTag(player, tag)) {
      player.removeTag(tag);
    }
  } catch (_error) {}
}

function readBooleanPreference(player, propertyKey, disabledTag) {
  if (!player) {
    return true;
  }

  // The disabled tag is the strongest local signal. This keeps fallback
  // storage authoritative if a runtime exposes dynamic-property reads but
  // refuses or drops dynamic-property writes.
  if (safeHasTag(player, disabledTag)) {
    return false;
  }

  try {
    if (typeof player.getDynamicProperty === "function") {
      const value = player.getDynamicProperty(propertyKey);
      if (typeof value === "boolean") {
        return value;
      }
      if (typeof value === "number") {
        return value !== 0;
      }
      if (typeof value === "string") {
        const lowered = value.toLowerCase();
        if (lowered === "true") return true;
        if (lowered === "false") return false;
      }
    }
  } catch (_error) {
    // Fall through to tag-backed storage for runtimes without usable dynamic properties.
  }

  return !safeHasTag(player, disabledTag);
}

function writeBooleanPreference(player, propertyKey, disabledTag, enabled) {
  const normalized = !!enabled;
  let wroteDynamicProperty = false;

  try {
    if (player && typeof player.setDynamicProperty === "function") {
      player.setDynamicProperty(propertyKey, normalized);
      wroteDynamicProperty = true;
    }
  } catch (_error) {
    wroteDynamicProperty = false;
  }

  // Keep the fallback tags in sync. They are authoritative only when dynamic
  // properties are unavailable, but mirroring them also makes settings resilient
  // across runtimes that expose read but not write support.
  if (normalized) {
    safeRemoveTag(player, disabledTag);
  } else {
    safeAddTag(player, disabledTag);
  }

  return wroteDynamicProperty;
}

function hideVhsOverlay(player) {
  try {
    if (player && player.onScreenDisplay && typeof player.onScreenDisplay.setTitle === "function") {
      // Force the HUD title binding away from Low/High/Panic first. In-game
      // JSON UI bindings can retain the previous title token for a frame if
      // only an empty title is sent, while PARADISE_VHS_OFF is already hidden
      // by RP/ui/hud_screen.json.
      player.onScreenDisplay.setTitle(VHS_OFF_TOKEN, {
        fadeInDuration: 0,
        stayDuration: 1,
        fadeOutDuration: 0,
      });
      return true;
    }
  } catch (_error) {}
  return false;
}

function notifyVhsPreferenceChanged(player, enabled) {
  for (const listener of [...vhsPreferenceListeners]) {
    try {
      listener(player, !!enabled);
    } catch (_error) {}
  }
}

export function onVhsPreferenceChanged(listener) {
  if (typeof listener !== "function") {
    return () => {};
  }

  vhsPreferenceListeners.add(listener);
  return () => {
    vhsPreferenceListeners.delete(listener);
  };
}

export function isFogEnabled(player) {
  return readBooleanPreference(player, FOG_PROPERTY_KEY, FOG_DISABLED_TAG);
}

export function isVhsEnabled(player) {
  return readBooleanPreference(player, VHS_PROPERTY_KEY, VHS_DISABLED_TAG);
}

export function applyFogConfig(player) {
  if (!isPlayer(player)) {
    return false;
  }

  const enabled = isFogEnabled(player);
  return applyFogLayer(player, enabled ? undefined : CLEAR_FOG_ID, FOG_OVERRIDE_TAG);
}

export function setFogEnabled(player, enabled) {
  if (!isPlayer(player)) {
    return false;
  }

  writeBooleanPreference(player, FOG_PROPERTY_KEY, FOG_DISABLED_TAG, !!enabled);
  return applyFogConfig(player);
}

export function setVhsEnabled(player, enabled) {
  if (!isPlayer(player)) {
    return false;
  }

  const normalized = !!enabled;
  writeBooleanPreference(player, VHS_PROPERTY_KEY, VHS_DISABLED_TAG, normalized);
  if (!normalized) {
    hideVhsOverlay(player);
  }
  notifyVhsPreferenceChanged(player, normalized);
  return true;
}

export function applyPlayerConfig(player) {
  if (!isPlayer(player)) {
    return false;
  }

  const fogApplied = applyFogConfig(player);
  const vhsEnabled = isVhsEnabled(player);
  if (!vhsEnabled) {
    hideVhsOverlay(player);
    notifyVhsPreferenceChanged(player, false);
  }

  return fogApplied;
}

export function openPlayerConfig(player) {
  if (!isPlayer(player)) {
    return false;
  }

  const fogEnabled = isFogEnabled(player);
  const vhsEnabled = isVhsEnabled(player);

  const form = new ModalFormData()
    .title(CONFIG_TITLE)
    .toggle("Fog", { defaultValue: fogEnabled })
    .toggle("VHS", { defaultValue: vhsEnabled })
    .submitButton("Save");

  form.show(player).then((response) => {
    if (!response || response.canceled) {
      return;
    }

    if (!Array.isArray(response.formValues) || response.formValues.length < 2) {
      return;
    }

    const nextFogEnabled = response.formValues[0] === true;
    const nextVhsEnabled = response.formValues[1] === true;

    setFogEnabled(player, nextFogEnabled);
    setVhsEnabled(player, nextVhsEnabled);

    try {
      player.sendMessage(SAVE_MESSAGE);
    } catch (_error) {}
  }).catch(() => {
    try {
      player.sendMessage("Unable to open Paradise config right now.");
    } catch (_error) {}
  });

  return true;
}

function getPlayerFromOrigin(origin) {
  try {
    const source = origin ? origin.sourceEntity : undefined;
    return isPlayer(source) ? source : undefined;
  } catch (_error) {
    return undefined;
  }
}

function registerConfigCommand(event) {
  try {
    event.customCommandRegistry.registerCommand(
      {
        name: CONFIG_COMMAND_ID,
        description: "Open the Paradise.jar per-player config menu",
        permissionLevel: CommandPermissionLevel.Any,
        cheatsRequired: false,
        mandatoryParameters: [],
        optionalParameters: [],
      },
      (origin) => {
        const player = getPlayerFromOrigin(origin);
        if (!player) {
          return {
            status: CustomCommandStatus.Failure,
            message: "Run /p:config as a player.",
          };
        }

        system.run(() => {
          openPlayerConfig(player);
        });

        return {
          status: CustomCommandStatus.Success,
          message: "Opening Paradise config...",
        };
      },
    );
  } catch (_error) {
    // Match the existing command modules: duplicate command registration during
    // reloads is ignored.
  }
}

function applyConfigSoon(player, delayTicks = 1) {
  if (!isPlayer(player)) {
    return;
  }

  try {
    system.runTimeout(() => {
      applyPlayerConfig(player);
    }, Math.max(1, Math.floor(delayTicks)));
  } catch (_error) {
    try {
      system.run(() => applyPlayerConfig(player));
    } catch (__error) {}
  }
}

function sendSpawnConfigHintSoon(player, delayTicks = 1) {
  if (!isPlayer(player)) {
    return;
  }

  const delay = Math.max(1, Math.floor(delayTicks));
  try {
    system.runTimeout(() => {
      try {
        player.sendMessage(SPAWN_CONFIG_HINT_MESSAGE);
      } catch (_error) {}
    }, delay);
  } catch (_error) {
    try {
      system.run(() => {
        try {
          player.sendMessage(SPAWN_CONFIG_HINT_MESSAGE);
        } catch (__error) {}
      });
    } catch (__error) {}
  }
}

system.beforeEvents.startup.subscribe(registerConfigCommand);

try {
  world.afterEvents.playerSpawn.subscribe((event) => {
    if (event && event.player) {
      const delayTicks = event.initialSpawn ? 5 : 1;
      applyConfigSoon(event.player, delayTicks);
      sendSpawnConfigHintSoon(event.player, delayTicks + 1);
    }
  });
} catch (_error) {}

try {
  world.afterEvents.worldLoad.subscribe(() => {
    system.run(() => {
      try {
        for (const player of world.getPlayers()) {
          applyPlayerConfig(player);
        }
      } catch (_error) {}
    });
  });
} catch (_error) {}
