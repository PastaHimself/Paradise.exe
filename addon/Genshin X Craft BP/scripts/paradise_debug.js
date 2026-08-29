import {
  CommandPermissionLevel,
  CustomCommandStatus,
  ItemStack,
  system,
  world,
} from "@minecraft/server";
import {
  clearVhsRequest,
  getRequestedVhsTier,
  requestVhsTier,
  showVhsTier,
  VHS_TIER,
} from "./paradise_horror_state.js";
import {
  HORROR_SOUND,
  getPlayerAudioBasis,
  playAtPosition,
  playForOnePlayer,
  pointBehindPlayer,
} from "./horror_audio.js";
import {
  getHorrorDirectorSnapshot,
} from "./horror_director.js";
import { getVisualJobStats } from "./paradise_visual_jobs.js";
import { getFogRuntimeStats } from "./paradise_fog_runtime.js";

const DEBUG_COMMAND_ID = "p:debug";
const DEBUG_PREFIX = "§8[§dParadise Debug§8]§r";
const DEBUG_TEMP_TAG = "paradise_debug_temp";
const DETAIL_LINES_PER_TICK = 8;

const STATUS = Object.freeze({
  PASS: "PASS",
  FAIL: "FAIL",
  WARN: "WARN",
  SKIP: "SKIP",
  STATIC: "STATIC",
});

const FEATURE_INVENTORY = Object.freeze({
  manifests: [
    { id: "bp.manifest", category: "behavior.manifest", source: "BP/manifest.json", reason: "format_version 2; data module; script entry scripts/main.js; @minecraft/server beta; RP dependency d5a6452f-8580-46d6-b4f4-1009cb8fa8a3." },
    { id: "rp.manifest", category: "resource.manifest", source: "RP/manifest.json", reason: "format_version 2; resources module; VHS Off/VHS On subpacks, with VHS On carrying VHS 2.0 Clean Tape assets." },
    { id: "bp.pack_icon", category: "behavior.asset", source: "BP/pack_icon.png", reason: "Behavior pack icon present in source archive." },
    { id: "rp.pack_icon", category: "resource.asset", source: "RP/pack_icon.png", reason: "Resource pack icon present in source archive." },
  ],
  scriptModules: [
    { id: "script.main", source: "BP/scripts/main.js", reason: "Combined Paradise behavior entry imports all dimension, watcher, and player-light modules; owns the global horror event director and Android corruption script event." },
    { id: "script.burning_highway", source: "BP/scripts/burning_highway.js", reason: "Burning Highway custom dimension, entry command/chat command, run overlay, road generation, cleanup, and dimension listeners." },
    { id: "script.catacombs", source: "BP/scripts/catacombs.js", reason: "Catacomb Mazes custom dimension, entry command, maze generation job, memory rules, timers, anti-break/explosion, pressure-plate and death hooks." },
    { id: "script.endless_staircase", source: "BP/scripts/endless_staircase.js", reason: "Endless Staircase custom dimension, entry/leave chat commands, bootstrap, entity filtering, and dimension listeners." },
    { id: "script.flat_flower", source: "BP/scripts/flat_flower.js", reason: "Flat_Flower custom dimension, entry command/chat command, patch generation, lure rules, and interaction/break listeners." },
    { id: "script.heaven", source: "BP/scripts/heaven.js", reason: "Heaven custom dimension, entry command, floor generation, void monitor, trust rules, hostile cleanup, and interaction hooks." },
    { id: "script.library", source: "BP/scripts/library.js", reason: "Library custom dimension, entry command, room generation, library debt/quiz rules, item-use and chat-answer listeners." },
    { id: "script.yellow_halls", source: "BP/scripts/yellow_halls.js", reason: "Yellow Halls custom dimension, entry command/chat command, room generation, entity filtering, lures, and yellow-hum audio." },
    { id: "script.watcher_stalker", source: "BP/scripts/watcher_stalker.js", reason: "Watcher stalker AI, profile memory, heat/fear/sound scoring, debug script events, VHS pressure, anti-combat, spawn and cleanup loop." },
    { id: "script.paradise_horror_state", source: "BP/scripts/paradise_horror_state.js", reason: "VHS overlay request state." },
    { id: "script.player_light", source: "BP/scripts/player_light.js", reason: "Player-carried dynamic light probe and watcher bright-light script-event integration." },
    { id: "script.dimension_horror_rules", source: "BP/scripts/dimension_horror_rules.js", reason: "Reusable dimension horror utilities for cooldowns, motion sampling, remembered locations, sound/particle/title/effect wrappers, signs, and notes." },
    { id: "script.horror_audio", source: "BP/scripts/horror_audio.js", reason: "Horror sound ID registry and positional/player audio helpers for stalker, ambient, Yellow Halls, and Catacombs audio." },
    { id: "script.horror_director", source: "BP/scripts/horror_director.js", reason: "Shared horror pacing director used by global events, dimension rules, and watcher pressure so scare timing does not stack uncontrollably." },
    { id: "script.paradise_debug", source: "BP/scripts/paradise_debug.js", reason: "Single developer-only debug command harness." },
    { id: "script.paradise_telemetry", source: "BP/scripts/paradise_telemetry.js", reason: "Read-only ring-buffer telemetry for horror events, shared horror state changes, Stalker state transitions, and teleport-governor decisions." },
    { id: "script.paradise_player_horror_state", source: "BP/scripts/paradise_player_horror_state.js", reason: "Shared per-player fear/consequence layer for fear score, panic, flashlight interference, movement/vision/hearing timers, dimension shock cooldown, and Stalker attention." },
    { id: "script.stalker_teleport_governor", source: "BP/scripts/stalker_teleport_governor.js", reason: "Central Stalker teleport authority with phase policies, cooldowns, per-encounter budgets, and denial telemetry." },
  ],
  customDimensions: [
    { id: "paradise:yellow_halls", source: "BP/scripts/yellow_halls.js", reason: "Registered in startup via event.dimensionRegistry.registerCustomDimension." },
    { id: "paradise:flat_flower", source: "BP/scripts/flat_flower.js", reason: "Registered in startup via event.dimensionRegistry.registerCustomDimension." },
    { id: "paradise:endless_staircase", source: "BP/scripts/endless_staircase.js", reason: "Registered in startup via event.dimensionRegistry.registerCustomDimension." },
    { id: "paradise:burning_highway", source: "BP/scripts/burning_highway.js", reason: "Registered in startup via event.dimensionRegistry.registerCustomDimension." },
    { id: "catacombs:catacomb_mazes", source: "BP/scripts/catacombs.js", reason: "Discovered actual Catacombs dimension ID registered in startup." },
    { id: "heaven:the_heaven", source: "BP/scripts/heaven.js", reason: "Discovered actual Heaven dimension ID registered in startup." },
    { id: "library:the_library", source: "BP/scripts/library.js", reason: "Discovered actual Library dimension ID registered in startup." },
  ],
  customCommands: [
    { id: "p:enter_yellow_halls", source: "BP/scripts/yellow_halls.js", reason: "Existing player entry command, no parameters, Any permission, no cheats required." },
    { id: "p:enter_flat_flower", source: "BP/scripts/flat_flower.js", reason: "Existing player entry command, no parameters, Any permission, no cheats required." },
    { id: "p:enter_endless_staircase", source: "BP/scripts/endless_staircase.js", reason: "Existing player entry command, no parameters, Any permission, no cheats required." },
    { id: "p:enter_burning_highway", source: "BP/scripts/burning_highway.js", reason: "Existing player entry command, no parameters, Any permission, no cheats required." },
    { id: "p:catacombs", source: "BP/scripts/catacombs.js", reason: "Existing player entry command, no parameters, Any permission, no cheats required." },
    { id: "p:enter_catacombs", source: "BP/scripts/catacombs.js", reason: "p namespace player entry command alias for the Catacombs, no parameters, Any permission, no cheats required." },
    { id: "p:heaven", source: "BP/scripts/heaven.js", reason: "Existing player entry command, no parameters, Any permission, no cheats required." },
    { id: "p:enter_heaven", source: "BP/scripts/heaven.js", reason: "p namespace player entry command alias for Heaven, no parameters, Any permission, no cheats required." },
    { id: "p:library", source: "BP/scripts/library.js", reason: "Existing player entry command, no parameters, Any permission, no cheats required." },
    { id: "p:enter_library", source: "BP/scripts/library.js", reason: "p namespace player entry command alias for The Library, no parameters, Any permission, no cheats required." },
    { id: "p:debug", source: "BP/scripts/paradise_debug.js", reason: "New developer-only single diagnostic command, no subcommands, GameDirectors, cheats required." },
  ],
  chatCommands: [
    { id: "!enter_yellow_halls", source: "BP/scripts/yellow_halls.js", reason: "Existing beforeEvents.chatSend shortcut." },
    { id: "!enter_flat_flower", source: "BP/scripts/flat_flower.js", reason: "Existing beforeEvents.chatSend shortcut." },
    { id: "!enter_endless_staircase", source: "BP/scripts/endless_staircase.js", reason: "Existing beforeEvents.chatSend shortcut." },
    { id: "!leave_endless_staircase", source: "BP/scripts/endless_staircase.js", reason: "Existing beforeEvents.chatSend leave shortcut." },
    { id: "!enter_burning_highway", source: "BP/scripts/burning_highway.js", reason: "Existing beforeEvents.chatSend shortcut." },
    { id: "!enter_catacombs", source: "BP/scripts/catacombs.js", reason: "beforeEvents.chatSend shortcut for safe Catacombs entry." },
    { id: "!enter_heaven", source: "BP/scripts/heaven.js", reason: "beforeEvents.chatSend shortcut for safe Heaven entry." },
    { id: "!enter_library", source: "BP/scripts/library.js", reason: "beforeEvents.chatSend shortcut for safe Library entry." },
    { id: "library answer chat", source: "BP/scripts/library.js", reason: "Existing beforeEvents.chatSend answer handler for Library rules." },
  ],
  scriptEvents: [
    { id: "paradise:watcher", source: "BP/scripts/watcher_stalker.js", reason: "Watcher debug hook supports on/off/debug_on/debug_off/reset/pulse/stats/telemetry/reset_stats/profile/force_ambush/force_fakeout/light; debug harness safely probes stats/help only." },
    { id: "paradise:android_corruption", source: "BP/scripts/main.js", reason: "Android corruption script-event listener forces the androidCorruption horror event for a player source." },
  ],
  eventListeners: [
    { id: "worldLoad", source: "BP/scripts/main.js; dimension scripts; watcher_stalker.js", reason: "Startup/bootstrap hooks for global director, dimensions, watcher, and world generation." },
    { id: "playerDimensionChange", source: "BP/scripts/yellow_halls.js; flat_flower.js; endless_staircase.js; burning_highway.js; catacombs.js; heaven.js; library.js", reason: "Dimension entry/exit rules and return-location handling." },
    { id: "playerInteractWithBlock", source: "BP/scripts/main.js; dimension scripts; watcher_stalker.js", reason: "Global horror triggers, dimension interact rules, watcher activity scoring." },
    { id: "playerBreakBlock", source: "BP/scripts/main.js; dimension scripts; watcher_stalker.js", reason: "Global horror triggers, protected dimension blocks, watcher activity scoring." },
    { id: "playerPlaceBlock", source: "BP/scripts/main.js; watcher_stalker.js", reason: "Global trigger and watcher activity scoring." },
    { id: "entityHurt", source: "BP/scripts/main.js; watcher_stalker.js", reason: "Global triggers, watcher anti-combat, damage/fear scoring." },
    { id: "entitySpawn", source: "BP/scripts/main.js; dimension scripts; watcher_stalker.js", reason: "Spawn filters, watcher registration, dimension entity filtering." },
    { id: "entityDie", source: "BP/scripts/main.js; catacombs.js; endless_staircase.js; library.js; watcher_stalker.js", reason: "Death/cleanup/watcher state handling." },
    { id: "playerSpawn", source: "BP/scripts/main.js; dimension scripts; watcher_stalker.js; player_light.js", reason: "Respawn handling, watcher profile heat, player-light refresh." },
    { id: "playerLeave", source: "BP/scripts/catacombs.js; endless_staircase.js; heaven.js; library.js; burning_highway.js", reason: "Dimension/player state cleanup." },
    { id: "explosion", source: "BP/scripts/catacombs.js; watcher_stalker.js", reason: "Catacomb protection and watcher loud-sound scoring." },
    { id: "pressurePlatePush", source: "BP/scripts/catacombs.js", reason: "Catacomb maze interaction rule." },
    { id: "itemUse", source: "BP/scripts/library.js; player_light.js", reason: "Library item/rule hook and flashlight toggle hook." },
    { id: "scriptEventReceive", source: "BP/scripts/main.js; watcher_stalker.js", reason: "Android corruption and watcher debug script-event listeners." },
    { id: "startup", source: "BP/scripts/dimension modules; paradise_debug.js", reason: "Custom dimensions and custom commands are registered during system.beforeEvents.startup." },
  ],
  scheduledSystems: [
    { id: "global.horror_trigger_scan", source: "BP/scripts/main.js", reason: "Global horror director scan interval and delayed cleanup scheduling." },
    { id: "catacombs.escape_timer", source: "BP/scripts/catacombs.js", reason: "Catacomb escape countdown interval." },
    { id: "catacombs.flicker_lights", source: "BP/scripts/catacombs.js", reason: "Catacomb flickering lights interval." },
    { id: "catacombs.memory_rules", source: "BP/scripts/catacombs.js", reason: "Catacomb memory-rule interval and maze build runJob." },
    { id: "heaven.floor_generation", source: "BP/scripts/heaven.js", reason: "Heaven floor-generation interval." },
    { id: "heaven.void_monitor", source: "BP/scripts/heaven.js", reason: "Heaven void-fall monitor interval." },
    { id: "heaven.trust_rules", source: "BP/scripts/heaven.js", reason: "Heaven trust-rule interval." },
    { id: "library.room_generation", source: "BP/scripts/library.js", reason: "Library room-generation interval." },
    { id: "library.void_monitor", source: "BP/scripts/library.js", reason: "Library void-fall monitor interval." },
    { id: "library.rules", source: "BP/scripts/library.js", reason: "Library rule interval." },
    { id: "player_light.tick", source: "BP/scripts/player_light.js", reason: "Player-light tick interval." },
    { id: "watcher.tick", source: "BP/scripts/watcher_stalker.js", reason: "Watcher memory, spawn, VHS, AI, save, and cleanup interval." },
    { id: "dimension.entry_generation", source: "BP/scripts/yellow_halls.js; flat_flower.js; endless_staircase.js; burning_highway.js", reason: "Per-dimension generation/check intervals." },
  ],
  stateSystems: [
    { id: "dynamic_property.paradise:watcher_memory", category: "dynamic_property", source: "BP/scripts/watcher_stalker.js", reason: "Per-player watcher memory profile persistence." },
    { id: "scoreboard.paradise_horror", category: "scoreboard", source: "BP/scripts/main.js", reason: "Global horror event director state." },
    { id: "scoreboard.paradise_watcher_cd", category: "scoreboard", source: "BP/scripts/watcher_stalker.js", reason: "Watcher cooldown objective." },
    { id: "scoreboard.catacombs_state", category: "scoreboard", source: "BP/scripts/catacombs.js", reason: "Catacomb build/maze generation objective discovered from BUILD_OBJECTIVE_ID." },
    { id: "tag.paradise_watcher_managed", category: "tag", source: "BP/scripts/watcher_stalker.js", reason: "Watcher-managed entity tag." },
    { id: "state.player_maps", category: "state", source: "BP/scripts/main.js; watcher_stalker.js; dimension modules", reason: "In-memory player maps for global horror, watcher profiles, dimension timers, route memory, trust/debt, and return positions." },
  ],
  behaviorData: [
    { id: "entity.paradise:watcher", source: "BP/entities/watcher.json", reason: "Summonable watcher entity with synced paradise:anim_state property, physics, health, type family, and empty loot table." },
    { id: "item.paradise:flashlight", source: "BP/items/flashlight.json", reason: "Flashlight OFF item state with paradise:flashlight_off icon, main-hand/offhand support, and max stack size 1." },
    { id: "item.paradise:flashlight_on", source: "BP/items/flashlight_on.json", reason: "Flashlight ON item state with paradise:flashlight_on icon; player_light.js swaps the held stack when toggled." },
    { id: "loot.watcher_empty", source: "BP/loot_tables/entities/watcher_empty.json", reason: "Empty watcher loot table referenced by BP watcher entity." },
    { id: "bp.text.en_US", source: "BP/texts/en_US.lang", reason: "Behavior pack language file." },
    { id: "bp.text.languages", source: "BP/texts/languages.json", reason: "Behavior pack language list." },
  ],
  horrorEvents: [
    "deadTree", "emptyVillage", "houseReplacement", "wrongDeathArm", "forbiddenStructure", "redstoneCross",
    "inventoryCourtesy", "doorApproval", "furnacePause", "bedDuplicate", "windowFrost", "itemReturn",
    "lockedInside", "copyRoom", "lightWithoutSource", "nameOnWall", "quietBell", "pantryRule",
    "rainShelter", "bedRefusal", "fakeRepair", "perfectHallway", "exitThankYou", "signThatLeaves",
    "wrongChestItem", "watchingVillager", "secondBed", "cleanPatch", "wrongSunrise", "bellNoVillage",
    "animalSilence", "itemNameFlicker", "noFallSound", "torchBlink", "doorCount",
    "buriedTile", "approvedPath", "chestApology", "firstRefusal", "bedMoved", "wrongCoordinatesNote",
    "shadowFollow", "bloodTrail", "androidCorruption",
  ].map((id) => ({ id, source: "BP/scripts/main.js", reason: "Registered global horror event director entry." })),
  resourceData: [
    { id: "client_entity.paradise:watcher", category: "resource.entity", source: "RP/entity/watcher.entity.json", reason: "Client entity references watcher texture, geometry, animations, and render controller." },
    { id: "geometry.abyssal_stalker", category: "resource.geometry", source: "RP/models/entity/abyssal_stalker.geo.json", reason: "Watcher geometry identifier geometry.abyssal_stalker." },
    { id: "animation.abyssal_stalker.idle", category: "resource.animation", source: "RP/animations/abyssal_stalker.animation.json", reason: "Watcher idle animation." },
    { id: "animation.abyssal_stalker.walk", category: "resource.animation", source: "RP/animations/abyssal_stalker.animation.json", reason: "Watcher walk animation." },
    { id: "animation.abyssal_stalker.run", category: "resource.animation", source: "RP/animations/abyssal_stalker.animation.json", reason: "Watcher run animation." },
    { id: "animation.abyssal_stalker.roar", category: "resource.animation", source: "RP/animations/abyssal_stalker.animation.json", reason: "Watcher roar animation." },
    { id: "animation.abyssal_stalker.attack", category: "resource.animation", source: "RP/animations/abyssal_stalker.animation.json", reason: "Watcher attack animation." },
    { id: "controller.render.paradise_watcher", category: "resource.render_controller", source: "RP/render_controllers/watcher.render_controllers.json", reason: "Watcher render controller uses Geometry.default, Material.default, Texture.default." },
    { id: "attachable.paradise:flashlight", category: "resource.attachable", source: "RP/attachables/flashlight.json", reason: "OFF-state flashlight attachable using a slot-bound root bone, perspective item poses, and textures/items/flashlight_off." },
    { id: "attachable.paradise:flashlight_on", category: "resource.attachable", source: "RP/attachables/flashlight_on.json", reason: "ON-state flashlight attachable using a slot-bound root bone, perspective item poses, and textures/items/flashlight_on." },
    { id: "geometry.flashlight", category: "resource.geometry", source: "RP/models/blocks/flashlight.geo.json", reason: "Flashlight handheld geometry with root_item bound through q.item_slot_to_bone_name(c.item_slot)." },
    { id: "animation.paradise_flashlight.first_person_hold", category: "resource.animation", source: "RP/animations/attachables/flashlight.animation.json", reason: "First-person flashlight item-bone pose based on the Genshin-X-Craft attachable pattern." },
    { id: "animation.paradise_flashlight.third_person_hold", category: "resource.animation", source: "RP/animations/attachables/flashlight.animation.json", reason: "Third-person flashlight item-bone pose based on the Genshin-X-Craft attachable pattern." },
    { id: "item_texture.paradise:flashlight", category: "resource.item_texture", source: "RP/textures/item_texture.json", reason: "Item atlas maps paradise:flashlight, paradise:flashlight_on, and paradise:flashlight_off to flashlight item textures." },
    { id: "fog.paradise:dark_fog", category: "resource.fog", source: "RP/fogs/paradise_dark_fog.json; RP/biomes_client.json", reason: "Default client biome fog identifier paradise:dark_fog." },
    { id: "ui.vhs_overlay", category: "resource.ui", source: "RP/ui/vhs_overlay.json; RP/ui/_ui_defs.json", reason: "VHS 2.0 Clean Tape HUD overlay adapted to the existing PARADISE_VHS_LOW/HIGH/PANIC title tokens." },
    { id: "ui.android_corruption", category: "resource.ui", source: "RP/ui/android_corruption.json; RP/ui/_ui_defs.json", reason: "Android recovery/corruption HUD bound to PARADISE_ANDROID_SHOW and PARADISE_ANDROID_PANIC." },
    { id: "ui.run_overlay", category: "resource.ui", source: "RP/ui/run_overlay.json; RP/ui/_ui_defs.json", reason: "RUN overlay bound to PARADISE_RUN_SHOW." },
    { id: "ui.hud_screen", category: "resource.ui", source: "RP/ui/hud_screen.json", reason: "HUD screen routes to VHS fullscreen HUD content and suppresses raw debug title tokens." },
    { id: "subpack.vhs_off", category: "resource.subpack", source: "RP/subpacks/vhs_off/ui/_ui_defs.json; RP/subpacks/vhs_off/ui/hud_screen.json", reason: "VHS Off subpack disables extra UI definitions and routes hud_screen back to hud.hud_content." },
    { id: "subpack.vhs_on", category: "resource.subpack", source: "RP/subpacks/vhs_on/textures/ui/vhs", reason: "VHS On subpack contains the VHS 2.0 Clean Tape effect texture overrides." },
    { id: "rp.text.en_US", category: "resource.lang", source: "RP/texts/en_US.lang", reason: "Resource pack language file." },
    { id: "rp.text.languages", category: "resource.lang", source: "RP/texts/languages.json", reason: "Resource pack language list." },
    { id: "textures_list", category: "resource.texture_list", source: "RP/textures/textures_list.json", reason: "Texture list references 20 pack textures including VHS 2.0 Clean Tape and flashlight item textures." },
  ],
  textures: [
    "textures/entity/abyssal_stalker", "textures/entity/virus",
    "textures/items/flashlight_icon", "textures/items/flashlight_off", "textures/items/flashlight_on",
    "textures/horror_recovery_ui_assets/android _curropt", "textures/horror_recovery_ui_assets/android_recovery_full", "textures/horror_recovery_ui_assets/button_white_border_blue_fill",
    "textures/ui/run", "textures/ui/vhs/battery", "textures/ui/vhs/chroma_atlas", "textures/ui/vhs/color_wash", "textures/ui/vhs/dropout_atlas",
    "textures/ui/vhs/grain_atlas", "textures/ui/vhs/head_switch_atlas", "textures/ui/vhs/osd_corners", "textures/ui/vhs/rec_dot", "textures/ui/vhs/scanlines",
    "textures/ui/vhs/tracking_atlas", "textures/ui/vhs/vignette",
  ].map((id) => ({ id, category: "resource.texture", source: `RP/${id}.png`, reason: "Texture asset present and referenced by texture list/UI/entity data." })),
  sounds: [
    { id: "horror_recovery_ui_assets.factory_reset_screen", file: "sounds/horror_recovery_ui_assets/factory_reset_screen.wav" },
    { id: "paradise.stalker.breath_far", file: "sounds/paradise_horror/breath_far.ogg" },
    { id: "paradise.stalker.breath_near", file: "sounds/paradise_horror/breath_near.ogg" },
    { id: "paradise.stalker.step_behind", file: "sounds/paradise_horror/step_behind.ogg" },
    { id: "paradise.stalker.wall_scratch", file: "sounds/paradise_horror/wall_scratch.ogg" },
    { id: "paradise.stalker.roar_muffled", file: "sounds/paradise_horror/roar_muffled.ogg" },
    { id: "paradise.ambient.low_hum", file: "sounds/paradise_horror/low_hum.ogg" },
    { id: "paradise.ambient.light_pop", file: "sounds/paradise_horror/light_pop.ogg" },
    { id: "paradise.ambient.radio_numbers", file: "sounds/paradise_horror/radio_numbers.ogg" },
    { id: "paradise.dimension.yellow_hum", file: "sounds/paradise_horror/yellow_hum.ogg" },
    { id: "paradise.dimension.catacomb_whisper", file: "sounds/paradise_horror/catacomb_whisper.ogg" },
    { id: "paradise.flashlight.switch", file: "sounds/paradise_flashlight/switch_click_sound.ogg" },
  ].map((item) => ({ id: item.id, category: "resource.sound", source: `RP/${item.file}; RP/sounds/sound_definitions.json`, reason: `Sound definition resolves to ${item.file}.` })),
  referenceGroups: [
    { id: "refs.global_horror.blocks_items_entities", source: "BP/scripts/main.js", reason: "204 Minecraft block/item/entity/effect IDs used by global horror event director." },
    { id: "refs.yellow_halls.blocks_items_entities", source: "BP/scripts/yellow_halls.js", reason: "34 Minecraft/Paradise IDs used by Yellow Halls generation, lures, and entity filtering." },
    { id: "refs.flat_flower.blocks_items_entities", source: "BP/scripts/flat_flower.js", reason: "14 Minecraft/Paradise IDs used by Flat_Flower generation and lure rules." },
    { id: "refs.endless_staircase.blocks_items_entities", source: "BP/scripts/endless_staircase.js", reason: "9 Minecraft/Paradise IDs used by Endless Staircase generation and filtering." },
    { id: "refs.burning_highway.blocks_items_entities", source: "BP/scripts/burning_highway.js", reason: "20 Minecraft/Paradise IDs used by Burning Highway generation and filtering." },
    { id: "refs.catacombs.blocks_items_entities", source: "BP/scripts/catacombs.js", reason: "63 Minecraft/Catacombs IDs used by Catacomb generation, mobs, particles, and effects." },
    { id: "refs.heaven.blocks_items_entities", source: "BP/scripts/heaven.js", reason: "63 Minecraft/custom dimension IDs used by Heaven generation, hostile filters, and rules." },
    { id: "refs.library.blocks_items_entities", source: "BP/scripts/library.js", reason: "Library dimension block/item/entity IDs used by room generation, quiz/debt rules, and filters." },
    { id: "refs.watcher.blocks_entities_effects_particles", source: "BP/scripts/watcher_stalker.js", reason: "33 watcher IDs covering watcher entity, particles, animation property, memory dynamic property, dimensions, containers, player/effects." },
    { id: "refs.player_light.blocks_items_sounds", source: "BP/scripts/player_light.js", reason: "Player-light IDs covering light blocks, custom flashlight item, switch sound, carried light sources, equippable component, and watcher script event." },
    { id: "refs.dimension_horror_rules.blocks_items", source: "BP/scripts/dimension_horror_rules.js", reason: "3 utility block/item IDs for signs and note items." },
    { id: "refs.horror_director.pacing", source: "BP/scripts/horror_director.js", reason: "Phase, cooldown, and scare-decision identifiers used by shared scare pacing." },
  ],
  staticReferenceValidation: Object.freeze({
    missingAssetCount: 0,
    brokenReferenceCount: 0,
    reason: "Offline source scan found all watcher loot, flashlight item/attachable/model/perspective-animation/textures, RP entity texture/geometry/animation/render-controller references, UI textures, texture-list entries, sound files, fog identifier, language files, and pack icons present.",
  }),
});

let debugSessionInFlight = false;
let nextSessionId = 1;

function safeMessage(target, message) {
  try {
    if (target && typeof target.sendMessage === "function") {
      target.sendMessage(message);
      return;
    }
  } catch (_error) {}
  try {
    world.sendMessage(message);
  } catch (_error) {}
}

function asErrorMessage(error) {
  if (!error) return "unknown error";
  if (typeof error === "string") return error;
  if (error.message) return String(error.message);
  return String(error);
}

function isValidEntity(entity) {
  try {
    if (!entity) return false;
    if (typeof entity.isValid === "function") return entity.isValid();
    return entity.isValid !== false;
  } catch (_error) {
    return false;
  }
}

function getPlayerFromOrigin(origin) {
  const source = origin && (origin.sourceEntity || origin.initiator);
  if (source && source.typeId === "minecraft:player") {
    return source;
  }
  return undefined;
}

function addResult(ctx, category, feature, test, status, reason, source, cleanup = "n/a") {
  ctx.results.push({ category, feature, test, status, reason, source, cleanup });
}

function addStatic(ctx, item, fallbackCategory, test = "static inventory/reference validation") {
  addResult(ctx, item.category || fallbackCategory, item.id, test, STATUS.STATIC, item.reason, item.source, "none");
}

function runCheck(ctx, category, feature, test, source, fn, cleanup = "none") {
  try {
    const reason = fn();
    addResult(ctx, category, feature, test, STATUS.PASS, reason || "check completed", source, cleanup);
    return true;
  } catch (error) {
    addResult(ctx, category, feature, test, STATUS.FAIL, asErrorMessage(error), source, cleanup);
    return false;
  }
}

function buildStaticCoverage(ctx) {
  for (const item of FEATURE_INVENTORY.manifests) addStatic(ctx, item, "manifest");
  for (const item of FEATURE_INVENTORY.scriptModules) addStatic(ctx, item, "script.module");
  for (const item of FEATURE_INVENTORY.customCommands) addStatic(ctx, item, "custom_command", "command registration inventory");
  for (const item of FEATURE_INVENTORY.chatCommands) addStatic(ctx, item, "chat_command", "chat shortcut inventory");
  for (const item of FEATURE_INVENTORY.scriptEvents) addStatic(ctx, item, "script_event", "script event listener inventory");
  for (const item of FEATURE_INVENTORY.eventListeners) addStatic(ctx, item, "event_listener", "event subscription inventory");
  for (const item of FEATURE_INVENTORY.scheduledSystems) addStatic(ctx, item, "scheduled_system", "interval/timeout/job inventory");
  for (const item of FEATURE_INVENTORY.stateSystems) addStatic(ctx, item, item.category || "state", "state system inventory");
  for (const item of FEATURE_INVENTORY.behaviorData) addStatic(ctx, item, "behavior.data", "BP JSON/static data validation");
  for (const item of FEATURE_INVENTORY.horrorEvents) addStatic(ctx, item, "horror_event", "horror event registry inventory");
  for (const item of FEATURE_INVENTORY.resourceData) addStatic(ctx, item, item.category || "resource", "RP JSON/reference validation");
  for (const item of FEATURE_INVENTORY.textures) addStatic(ctx, item, "resource.texture", "texture reference validation");
  for (const item of FEATURE_INVENTORY.sounds) addStatic(ctx, item, "resource.sound", "sound definition reference validation");
  for (const item of FEATURE_INVENTORY.referenceGroups) addStatic(ctx, item, "script.reference_group", "script block/item/entity ID inventory");

  addResult(
    ctx,
    "resource.references",
    "static.reference_integrity",
    "offline reference resolver",
    FEATURE_INVENTORY.staticReferenceValidation.brokenReferenceCount === 0 && FEATURE_INVENTORY.staticReferenceValidation.missingAssetCount === 0 ? STATUS.STATIC : STATUS.FAIL,
    FEATURE_INVENTORY.staticReferenceValidation.reason,
    "full BP/RP source scan",
    "none",
  );
}

function* runDimensionChecks(ctx) {
  for (const dimension of FEATURE_INVENTORY.customDimensions) {
    runCheck(ctx, "custom_dimension", dimension.id, "world.getDimension availability", dimension.source, () => {
      const dim = world.getDimension(dimension.id);
      if (!dim) throw new Error("world.getDimension returned undefined");
      return `dimension object available; id=${dim.id || dimension.id}`;
    });
    yield;
  }
}

function runWatcherCommandProbe(ctx, player, message) {
  runCheck(ctx, "watcher", `paradise:watcher ${message}`, "existing watcher script-event hook probe", "BP/scripts/watcher_stalker.js", () => {
    const result = player.runCommand(`scriptevent paradise:watcher ${message}`);
    const status = result && typeof result.successCount === "number" ? `successCount=${result.successCount}` : "command dispatched";
    return `scriptevent dispatched through player command source; ${status}`;
  }, "no debug state created by harness");
}

function runTitleProbe(player, token) {
  if (!player || !player.onScreenDisplay || typeof player.onScreenDisplay.setTitle !== "function") {
    throw new Error("player.onScreenDisplay.setTitle is unavailable");
  }
  player.onScreenDisplay.setTitle(token, {
    fadeInDuration: 0,
    stayDuration: 5,
    fadeOutDuration: 0,
  });
  return `title token ${token} accepted`;
}

function* runActiveChecks(ctx) {
  const player = ctx.player;

  runCheck(ctx, "command", DEBUG_COMMAND_ID, "player executor validation", "BP/scripts/paradise_debug.js", () => {
    if (!player || player.typeId !== "minecraft:player") throw new Error("debug command did not receive a player source");
    return `executor ${player.name || player.id || "player"} accepted`;
  });
  yield;

  runCheck(ctx, "script_runtime", "world.players", "world/getPlayers runtime availability", "@minecraft/server 2.9.0-beta", () => {
    const players = world.getPlayers();
    return `world.getPlayers returned ${players.length} player(s)`;
  });

  runCheck(ctx, "script_runtime", "system.currentTick", "system runtime availability", "@minecraft/server 2.9.0-beta", () => {
    return `currentTick=${system.currentTick}`;
  });

  runCheck(ctx, "horror_director", "shared_pacing_snapshot", "read shared horror director phase/cooldown snapshot", "BP/scripts/horror_director.js", () => {
    const snapshot = getHorrorDirectorSnapshot(system.currentTick);
    if (!snapshot || typeof snapshot.phase !== "string") throw new Error("horror director snapshot unavailable");
    return `phase=${snapshot.phase}; quietTicks=${snapshot.quietTicks}; globalCooldownRemainingTicks=${snapshot.globalCooldownRemainingTicks}`;
  }, "no persistent world state; may normalize expired director cooldowns");
  yield;

  yield* runDimensionChecks(ctx);

  runCheck(ctx, "player_state", "temporary_player_tag", "add/remove temporary player tag", "@minecraft/server Player tags", () => {
    const hadTag = player.hasTag(DEBUG_TEMP_TAG);
    if (!hadTag) player.addTag(DEBUG_TEMP_TAG);
    if (!player.hasTag(DEBUG_TEMP_TAG)) throw new Error("temporary tag was not applied");
    if (!hadTag) player.removeTag(DEBUG_TEMP_TAG);
    if (!hadTag && player.hasTag(DEBUG_TEMP_TAG)) throw new Error("temporary tag cleanup failed");
    return hadTag ? "temporary tag already existed; left intact" : "temporary tag applied and removed";
  }, "removed unless it pre-existed");
  yield;

  runCheck(ctx, "scoreboard", "paradise_horror", "read objective if present", "BP/scripts/main.js", () => {
    const objective = world.scoreboard.getObjective("paradise_horror");
    return objective ? "objective present" : "objective not created yet; static usage validated";
  });

  runCheck(ctx, "scoreboard", "paradise_watcher_cd", "read objective if present", "BP/scripts/watcher_stalker.js", () => {
    const objective = world.scoreboard.getObjective("paradise_watcher_cd");
    return objective ? "objective present" : "objective not created yet; static usage validated";
  });

  runCheck(ctx, "scoreboard", "catacombs_state", "read objective if present", "BP/scripts/catacombs.js", () => {
    const objective = world.scoreboard.getObjective("catacombs_state");
    return objective ? "objective present" : "objective not created yet; static usage validated";
  });
  yield;

  runCheck(ctx, "dynamic_property", "paradise:watcher_memory", "read-only dynamic property API check", "BP/scripts/watcher_stalker.js", () => {
    if (typeof player.getDynamicProperty !== "function") throw new Error("player.getDynamicProperty unavailable");
    const value = player.getDynamicProperty("paradise:watcher_memory");
    return value === undefined ? "property currently unset; API available" : `property readable; type=${typeof value}`;
  }, "read-only; no mutation");
  yield;

  runCheck(ctx, "horror_state", "vhs_request_lifecycle", "request/get/clear VHS tier", "BP/scripts/paradise_horror_state.js", () => {
    requestVhsTier(player, VHS_TIER.Low, system.currentTick, 2, "debug-probe");
    const requested = getRequestedVhsTier(player, system.currentTick);
    clearVhsRequest(player);
    if (requested !== VHS_TIER.Low) throw new Error(`expected ${VHS_TIER.Low}, got ${requested}`);
    return "VHS request accepted, read back, and cleared";
  }, "clearVhsRequest called");
  yield;

  runCheck(ctx, "ui", "vhs.overlay.low", "active VHS title token probe", "RP/ui/vhs_overlay.json; BP/scripts/paradise_horror_state.js", () => {
    showVhsTier(player, VHS_TIER.Low, 5);
    return "showVhsTier Low executed";
  }, "transient HUD title only");

  runCheck(ctx, "ui", "vhs.overlay.off", "active VHS title clear probe", "RP/ui/vhs_overlay.json; BP/scripts/paradise_horror_state.js", () => {
    showVhsTier(player, VHS_TIER.Off, 1);
    return "showVhsTier Off executed";
  }, "transient HUD title only");

  runCheck(ctx, "ui", "android.recovery.overlay", "active Android title token probe", "RP/ui/android_corruption.json", () => runTitleProbe(player, "PARADISE_ANDROID_SHOW"), "transient HUD title only");

  runCheck(ctx, "ui", "run.overlay", "active RUN title token probe", "RP/ui/run_overlay.json", () => runTitleProbe(player, "PARADISE_RUN_SHOW"), "transient HUD title only");
  yield;

  runCheck(ctx, "horror_audio", "audio.player_low_hum", "active low-volume player sound probe", "BP/scripts/horror_audio.js; RP/sounds/sound_definitions.json", () => {
    const played = playForOnePlayer(player, HORROR_SOUND.AmbientLowHum, { volume: 0.01, pitch: 1 });
    if (!played) throw new Error("playForOnePlayer returned false");
    return `played ${HORROR_SOUND.AmbientLowHum} at volume 0.01`;
  }, "no persistent state");

  runCheck(ctx, "horror_audio", "audio.position_basis", "audio location helper probe", "BP/scripts/horror_audio.js", () => {
    const basis = getPlayerAudioBasis(player);
    const point = pointBehindPlayer(player, 2, 0, 0.5);
    if (!basis || !point) throw new Error("audio basis helpers returned empty values");
    return `computed behind-player point ${Math.round(point.x)},${Math.round(point.y)},${Math.round(point.z)}`;
  });
  yield;

  runCheck(ctx, "horror_audio", "audio.position_light_pop", "active low-volume positional sound probe", "BP/scripts/horror_audio.js; RP/sounds/sound_definitions.json", () => {
    const location = pointBehindPlayer(player, 2, 0, 0.5);
    const played = playAtPosition(player.dimension, HORROR_SOUND.AmbientLightPop, location, { volume: 0.01, pitch: 1 });
    if (!played) throw new Error("playAtPosition returned false");
    return `played ${HORROR_SOUND.AmbientLightPop} at nearby debug point`;
  }, "no persistent state");
  yield;

  runWatcherCommandProbe(ctx, player, "stats");
  yield;
  runWatcherCommandProbe(ctx, player, "__debug_help");
  yield;

  runCheck(ctx, "watcher", "entity.paradise:watcher", "safe spawn/remove sanity probe", "BP/entities/watcher.json; RP/entity/watcher.entity.json", () => {
    const location = pointBehindPlayer(player, 3, 0, 0.2);
    const watcher = player.dimension.spawnEntity("paradise:watcher", location);
    if (!watcher || watcher.typeId !== "paradise:watcher") throw new Error("spawnEntity did not create paradise:watcher");
    try { watcher.addTag(DEBUG_TEMP_TAG); } catch (_error) {}
    ctx.tempEntities.push(watcher);
    return `spawned temporary watcher at ${Math.round(location.x)},${Math.round(location.y)},${Math.round(location.z)}`;
  }, "queued for removal");
  yield;
  yield;

  runCheck(ctx, "player_light", "flashlight.item_stack", "custom flashlight item-state constructor probe", "BP/items/flashlight.json; BP/items/flashlight_on.json; RP/textures/item_texture.json", () => {
    const offStack = new ItemStack("paradise:flashlight", 1);
    const onStack = new ItemStack("paradise:flashlight_on", 1);
    if (!offStack || offStack.typeId !== "paradise:flashlight") throw new Error("OFF item state did not resolve");
    if (!onStack || onStack.typeId !== "paradise:flashlight_on") throw new Error("ON item state did not resolve");
    return `created transient ${offStack.typeId} and ${onStack.typeId}`;
  }, "transient object only; no inventory mutation");

  runCheck(ctx, "player_light", "carried_light_probe", "read-only inventory/equipment component probe", "BP/scripts/player_light.js; BP/items/flashlight.json", () => {
    const equipment = player.getComponent("minecraft:equippable") || player.getComponent("equippable");
    const inventory = player.getComponent("minecraft:inventory") || player.getComponent("inventory");
    if (!equipment && !inventory) throw new Error("inventory and equippable components unavailable");
    return `equippable=${equipment ? "yes" : "no"}; inventory=${inventory ? "yes" : "no"}; no inventory mutation`;
  }, "read-only; no inventory mutation");

  runCheck(ctx, "player_light", "flashlight.switch_sound", "active low-volume flashlight switch sound probe", "RP/sounds/sound_definitions.json; BP/scripts/player_light.js", () => {
    const soundId = "paradise.flashlight.switch";
    if (typeof player.playSound === "function") {
      player.playSound(soundId, { volume: 0.01, pitch: 1 });
      return `played ${soundId} through player.playSound at volume 0.01`;
    }
    if (typeof player.dimension?.playSound === "function") {
      player.dimension.playSound(soundId, player.location, { volume: 0.01, pitch: 1 });
      return `played ${soundId} through dimension.playSound at volume 0.01`;
    }
    throw new Error("no sound playback API available for flashlight switch probe");
  }, "no persistent state");
  yield;
}

function cleanupDebugState(ctx) {
  let removedEntities = 0;
  let failedEntities = 0;

  for (const entity of ctx.tempEntities) {
    try {
      if (isValidEntity(entity)) {
        entity.remove();
        removedEntities += 1;
      }
    } catch (_error) {
      failedEntities += 1;
    }
  }

  try {
    if (ctx.player && ctx.player.hasTag(DEBUG_TEMP_TAG)) {
      ctx.player.removeTag(DEBUG_TEMP_TAG);
    }
  } catch (_error) {}

  try {
    clearVhsRequest(ctx.player);
  } catch (_error) {}

  const status = failedEntities === 0 ? STATUS.PASS : STATUS.WARN;
  addResult(
    ctx,
    "cleanup",
    "debug_temp_state",
    "remove temporary watcher/tag/VHS request state",
    status,
    `removedEntities=${removedEntities}; failedEntities=${failedEntities}; tempTag cleared best-effort; VHS request cleared`,
    "BP/scripts/paradise_debug.js",
    failedEntities === 0 ? "complete" : "partial",
  );
}

function summarize(ctx) {
  const summary = { PASS: 0, FAIL: 0, WARN: 0, SKIP: 0, STATIC: 0 };
  for (const result of ctx.results) {
    summary[result.status] = (summary[result.status] || 0) + 1;
  }

  const active = summary.PASS + summary.FAIL + summary.WARN;
  const skipped = summary.SKIP;
  const statics = summary.STATIC;
  const total = ctx.results.length;
  const missingAssets = FEATURE_INVENTORY.staticReferenceValidation.missingAssetCount;
  const brokenReferences = FEATURE_INVENTORY.staticReferenceValidation.brokenReferenceCount;
  const cleanupResult = ctx.results.find((r) => r.category === "cleanup")?.reason || "cleanup not recorded";

  return {
    summary,
    active,
    skipped,
    statics,
    total,
    missingAssets,
    brokenReferences,
    cleanupResult,
  };
}

function formatResultLine(result, index) {
  const color = result.status === STATUS.PASS ? "§a" : result.status === STATUS.FAIL ? "§c" : result.status === STATUS.WARN ? "§6" : result.status === STATUS.SKIP ? "§7" : "§b";
  return `${DEBUG_PREFIX} ${color}${result.status}§r #${index + 1} ${result.category}/${result.feature} :: ${result.test} — ${result.reason} (${result.source}; cleanup=${result.cleanup})`;
}

function sendReport(ctx) {
  const data = summarize(ctx);
  safeMessage(
    ctx.player,
    `${DEBUG_PREFIX} §fPASS ${data.summary.PASS} §8| §bSTATIC ${data.summary.STATIC} §8| §6WARN ${data.summary.WARN} §8| §cFAIL ${data.summary.FAIL} §8| §7SKIP ${data.summary.SKIP}`,
  );
  safeMessage(
    ctx.player,
    `${DEBUG_PREFIX} total=${data.total}; active=${data.active}; static=${data.statics}; skipped=${data.skipped}; missingAssets=${data.missingAssets}; brokenReferences=${data.brokenReferences}; cleanup=${data.cleanupResult}`,
  );
  const visualJobs = getVisualJobStats();
  safeMessage(
    ctx.player,
    `${DEBUG_PREFIX} visual_jobs active=${visualJobs.active} queued=${visualJobs.queued} placed=${visualJobs.placed} retried=${visualJobs.retried} failed=${visualJobs.failed}`,
  );
  const fogRuntime = getFogRuntimeStats();
  safeMessage(
    ctx.player,
    `${DEBUG_PREFIX} fog_runtime command=${fogRuntime.commandApplied} component=${fogRuntime.componentApplied} failures=${fogRuntime.failures}${fogRuntime.lastFailure ? ` last=${fogRuntime.lastFailure}` : ""}`,
  );

  const important = ctx.results.filter((r) => r.status === STATUS.FAIL || r.status === STATUS.WARN || r.status === STATUS.SKIP);
  if (important.length > 0) {
    safeMessage(ctx.player, `${DEBUG_PREFIX} Actionable results:`);
    for (const result of important) {
      safeMessage(ctx.player, formatResultLine(result, ctx.results.indexOf(result)));
    }
  }

  safeMessage(ctx.player, `${DEBUG_PREFIX} Detailed coverage matrix follows in tick-batched chat output (${ctx.results.length} rows).`);
  let index = 0;
  system.runJob((function* () {
    while (index < ctx.results.length) {
      for (let i = 0; i < DETAIL_LINES_PER_TICK && index < ctx.results.length; i += 1, index += 1) {
        safeMessage(ctx.player, formatResultLine(ctx.results[index], index));
      }
      yield;
    }
  })());
}

function* runDebugSession(ctx) {
  safeMessage(ctx.player, `${DEBUG_PREFIX} Starting session ${ctx.sessionId}.`);
  buildStaticCoverage(ctx);
  yield;
  yield* runActiveChecks(ctx);
  cleanupDebugState(ctx);
  yield;
  sendReport(ctx);
  debugSessionInFlight = false;
}

function startDebugSession(player) {
  if (debugSessionInFlight) {
    safeMessage(player, `${DEBUG_PREFIX} Another debug session is already running.`);
    return;
  }

  debugSessionInFlight = true;
  const ctx = {
    sessionId: nextSessionId++,
    player,
    results: [],
    tempEntities: [],
  };

  try {
    system.runJob((function* () {
      try {
        yield* runDebugSession(ctx);
      } catch (error) {
        addResult(ctx, "debug_harness", "session", "top-level exception guard", STATUS.FAIL, asErrorMessage(error), "BP/scripts/paradise_debug.js", "cleanup attempted");
        cleanupDebugState(ctx);
        sendReport(ctx);
        debugSessionInFlight = false;
      }
    })());
  } catch (error) {
    debugSessionInFlight = false;
    safeMessage(player, `${DEBUG_PREFIX} Failed to start debug job: ${asErrorMessage(error)}`);
  }
}

function registerParadiseDebugCommand(event) {
  try {
    event.customCommandRegistry.registerCommand(
      {
        name: DEBUG_COMMAND_ID,
        description: "Run one full safe Paradise.jar diagnostic pass",
        permissionLevel: CommandPermissionLevel.GameDirectors,
        cheatsRequired: true,
        mandatoryParameters: [],
        optionalParameters: [],
      },
      (origin) => {
        const player = getPlayerFromOrigin(origin);
        if (!player) {
          return {
            status: CustomCommandStatus.Failure,
            message: "Run /p:debug as a player.",
          };
        }

        system.run(() => {
          startDebugSession(player);
        });

        return {
          status: CustomCommandStatus.Success,
          message: "Paradise debug session queued.",
        };
      },
    );
  } catch (_error) {
    // Existing modules ignore duplicate registration on reload; keep the same convention.
  }
}

system.beforeEvents.startup.subscribe(registerParadiseDebugCommand);
