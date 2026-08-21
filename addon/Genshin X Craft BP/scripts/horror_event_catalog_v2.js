import { EVENT_FAMILY, EVENT_TIER } from './horror_event_model_v2.js';

const T = 20;
const S = (seconds) => Math.max(0, Math.round(seconds * T));

function sound(at, soundId, anchor, options = {}) {
  return { at: S(at), type: 'sound', soundId, anchor, volume: options.volume ?? 0.8, pitch: options.pitch ?? 1, condition: options.condition };
}

function particle(at, particleId, anchor, options = {}) {
  return { at: S(at), type: 'particle', particleId, anchor, count: options.count ?? 4, spread: options.spread ?? 0.4, condition: options.condition };
}

function watcher(at, style, anchor = 'ahead', options = {}) {
  return { at: S(at), type: 'watcher', style, anchor, chase: false, condition: options.condition };
}

function vhs(at, tier = 'low', ticks = S(3)) {
  return { at: S(at), type: 'vhs', tier, ticks };
}

function tempLight(at, mode = 'single', options = {}) {
  return { at: S(at), type: 'temp_light', mode, count: options.count ?? 1, restoreTicks: options.restoreTicks ?? S(8) };
}

function destruct(at, mode, options = {}) {
  return { at: S(at), type: 'destruct', mode, maxBlocks: options.maxBlocks ?? 4, radius: options.radius ?? 5, anchor: options.anchor ?? 'ahead', geometry: options.geometry };
}

function defaultAnchorPolicy(family) {
  if (family === EVENT_FAMILY.Sensory || family === EVENT_FAMILY.PlayerReactive) return 'follow_player';
  return 'fixed_world';
}


function score(spec = {}) {
  return (ctx = {}) => {
    if (spec.require && !spec.require(ctx)) return 0;
    let value = spec.base ?? 5;
    for (const [field, weight] of spec.fields ?? []) {
      const raw = ctx[field];
      if (typeof raw === 'boolean') value += raw ? weight : 0;
      else if (Number.isFinite(Number(raw))) value += Math.min(1, Math.max(0, Number(raw))) * weight;
    }
    return Math.max(0, value);
  };
}

function event(key, family, tier, intensity, durationSeconds, scorer, actions, extra = {}) {
  return Object.freeze({
    key,
    family,
    tier,
    intensity,
    minTension: extra.minTension ?? (tier === EVENT_TIER.Omen ? 10 : tier === EVENT_TIER.Scenario ? 24 : 48),
    maxTension: extra.maxTension ?? 100,
    minimumQuietTicks: extra.minimumQuietTicks ?? (tier === EVENT_TIER.Major ? S(90) : tier === EVENT_TIER.Scenario ? S(35) : S(18)),
    durationTicks: S(durationSeconds),
    anchorPolicy: extra.anchorPolicy ?? defaultAnchorPolicy(family),
    score: scorer,
    actions: Object.freeze(actions),
  });
}

const E = EVENT_FAMILY;
const R = EVENT_TIER;

const environmental = [
  event('light_pop_chain', E.Environmental, R.Omen, 1, 10, score({ base: 7, fields: [['darkness', 6], ['artificial', 4]], require: (c) => c.nearLight }), [
    sound(0, 'paradise.ambient.light_pop', 'left'), sound(3.2, 'paradise.ambient.light_pop', 'right'), sound(7.5, 'paradise.ambient.low_hum', 'far_ahead', { volume: 0.35, pitch: 0.82 }),
  ]),
  event('cold_draft', E.Environmental, R.Omen, 1, 12, score({ base: 6, fields: [['underground', 4], ['artificial', 3], ['stillness', 4]] }), [
    sound(0, 'paradise.stalker.breath_far', 'left', { volume: 0.35, pitch: 0.75 }), particle(3, 'minecraft:basic_smoke_particle', 'left', { count: 2 }), sound(8.5, 'paradise.ambient.low_hum', 'behind', { volume: 0.22, pitch: 0.7 }),
  ]),
  event('distant_collapse', E.Environmental, R.Omen, 2, 13, score({ base: 5, fields: [['underground', 8], ['darkness', 3]] }), [
    sound(0, 'random.anvil_land', 'far_ahead', { volume: 0.25, pitch: 0.55 }), sound(4.5, 'dig.stone', 'far_ahead', { volume: 0.45, pitch: 0.62 }), particle(9, 'minecraft:basic_smoke_particle', 'far_ahead', { count: 6, spread: 1.2 }),
  ]),
  event('room_hum', E.Environmental, R.Omen, 1, 14, score({ base: 4, fields: [['artificial', 8], ['stillness', 5]] }), [
    sound(0, 'paradise.ambient.low_hum', 'near', { volume: 0.22, pitch: 0.88 }), sound(5, 'paradise.ambient.low_hum', 'right', { volume: 0.28, pitch: 0.8 }), sound(11, 'paradise.ambient.light_pop', 'behind', { volume: 0.45, pitch: 0.9 }),
  ]),
  event('lamp_flicker', E.Environmental, R.Scenario, 2, 15, score({ base: 5, fields: [['artificial', 7], ['darkness', 2]], require: (c) => c.nearLight }), [
    sound(0, 'paradise.ambient.light_pop', 'near'), tempLight(2.5, 'single', { count: 1, restoreTicks: S(2) }), tempLight(6, 'single', { count: 1, restoreTicks: S(1.2) }), sound(10, 'paradise.ambient.low_hum', 'behind', { volume: 0.25, pitch: 0.7 }),
  ]),
  event('dry_roof_rain', E.Environmental, R.Omen, 1, 11, score({ base: 5, fields: [['artificial', 6], ['openSky', -2], ['stillness', 3]] }), [
    sound(0, 'weather.rain', 'overhead', { volume: 0.2, pitch: 0.7 }), sound(3.5, 'weather.rain', 'overhead', { volume: 0.28, pitch: 0.62 }), sound(8, 'paradise.stalker.wall_scratch', 'overhead', { volume: 0.3, pitch: 0.78 }),
  ]),
  event('ceiling_dust', E.Environmental, R.Omen, 1, 9, score({ base: 5, fields: [['underground', 7], ['stillness', 4]] }), [
    sound(0, 'dig.stone', 'overhead', { volume: 0.18, pitch: 0.65 }), particle(2, 'minecraft:basic_smoke_particle', 'overhead', { count: 5, spread: 0.8 }), sound(6.5, 'paradise.stalker.wall_scratch', 'overhead', { volume: 0.3, pitch: 0.66 }),
  ]),
  event('dead_air', E.Environmental, R.Scenario, 2, 15, score({ base: 5, fields: [['darkness', 5], ['stillness', 5], ['alone', 4]] }), [
    sound(0, 'paradise.ambient.low_hum', 'far_ahead', { volume: 0.18, pitch: 0.55 }), vhs(4, 'low', S(2)), sound(10.5, 'paradise.stalker.breath_far', 'behind', { volume: 0.18, pitch: 0.6 }),
  ]),
  event('door_settling', E.Environmental, R.Omen, 1, 10, score({ base: 4, fields: [['artificial', 5], ['recentInteraction', 6]], require: (c) => c.nearDoor }), [
    sound(0, 'random.door_open', 'interaction', { volume: 0.3, pitch: 0.7 }), sound(4, 'random.door_close', 'behind', { volume: 0.35, pitch: 0.72 }), sound(7.8, 'paradise.stalker.wall_scratch', 'interaction', { volume: 0.28, pitch: 0.8 }),
  ]),
  event('blackout_procession', E.Environmental, R.Major, 4, 22, score({ base: 3, fields: [['artificial', 7], ['darkness', 5], ['tensionNorm', 6]], require: (c) => c.nearLight }), [
    sound(0, 'paradise.ambient.light_pop', 'far_ahead'), tempLight(2, 'procession', { count: 1, restoreTicks: S(18) }), tempLight(6, 'procession', { count: 2, restoreTicks: S(14) }), tempLight(10, 'procession', { count: 3, restoreTicks: S(10) }), sound(14, 'paradise.stalker.breath_far', 'far_ahead', { volume: 0.35, pitch: 0.68 }),
  ]),
];

const sensory = [
  event('second_footstep', E.Sensory, R.Omen, 1, 9, score({ base: 6, fields: [['moving', 7], ['alone', 3]] }), [
    sound(0, 'paradise.stalker.step_behind', 'behind', { volume: 0.45 }), sound(3.5, 'paradise.stalker.step_behind', 'behind', { volume: 0.5, condition: 'moving' }), sound(7.2, 'paradise.stalker.step_behind', 'right', { volume: 0.32, condition: 'turned_around' }),
  ]),
  event('wall_scratch_trail', E.Sensory, R.Omen, 1, 12, score({ base: 6, fields: [['artificial', 4], ['underground', 5], ['darkness', 3]] }), [
    sound(0, 'paradise.stalker.wall_scratch', 'left'), sound(4.2, 'paradise.stalker.wall_scratch', 'right', { volume: 0.7 }), sound(9, 'paradise.stalker.wall_scratch', 'behind', { volume: 0.45, pitch: 0.82 }),
  ]),
  event('breath_at_shoulder', E.Sensory, R.Scenario, 3, 12, score({ base: 3, fields: [['stillness', 7], ['darkness', 5], ['alone', 5]] }), [
    sound(0, 'paradise.stalker.breath_far', 'behind', { volume: 0.25 }), sound(4.5, 'paradise.stalker.breath_near', 'left', { volume: 0.55 }), sound(8, 'paradise.stalker.step_behind', 'right', { volume: 0.3, condition: 'turned_around' }),
  ]),
  event('imitated_door', E.Sensory, R.Omen, 1, 10, score({ base: 3, fields: [['recentInteraction', 9], ['artificial', 3]], require: (c) => c.nearDoor }), [
    sound(0, 'random.door_close', 'interaction', { volume: 0.45 }), sound(3.5, 'random.door_open', 'behind', { volume: 0.38, pitch: 0.85 }), sound(7.5, 'paradise.stalker.step_behind', 'behind', { volume: 0.25 }),
  ]),
  event('approaching_knocks', E.Sensory, R.Scenario, 3, 16, score({ base: 5, fields: [['artificial', 5], ['stillness', 5], ['darkness', 3]] }), [
    sound(0, 'paradise.stalker.wall_scratch', 'far_ahead', { volume: 0.28 }), sound(5, 'paradise.stalker.wall_scratch', 'right', { volume: 0.48 }), sound(10.5, 'paradise.stalker.wall_scratch', 'behind', { volume: 0.72 }), sound(14, 'paradise.stalker.breath_near', 'behind', { volume: 0.24 }),
  ]),
  event('moving_whisper', E.Sensory, R.Omen, 2, 14, score({ base: 4, fields: [['underground', 5], ['darkness', 4], ['moving', 3]] }), [
    sound(0, 'paradise.dimension.catacomb_whisper', 'left', { volume: 0.22 }), sound(4.5, 'paradise.dimension.catacomb_whisper', 'ahead', { volume: 0.28, pitch: 0.85 }), sound(10.5, 'paradise.dimension.catacomb_whisper', 'right', { volume: 0.2, pitch: 1.1 }),
  ]),
  event('false_minecart', E.Sensory, R.Omen, 2, 12, score({ base: 5, fields: [['underground', 6], ['darkness', 3]] }), [
    sound(0, 'minecart.base', 'far_ahead', { volume: 0.22, pitch: 0.72 }), sound(4, 'minecart.base', 'ahead', { volume: 0.3, pitch: 0.78 }), sound(9, 'minecart.base', 'behind', { volume: 0.18, pitch: 0.62 }),
  ]),
  event('tool_echo', E.Sensory, R.Omen, 1, 10, score({ base: 3, fields: [['recentBreak', 10], ['underground', 3]] }), [
    sound(0, 'dig.stone', 'interaction', { volume: 0.3, pitch: 0.8 }), sound(3, 'dig.stone', 'far_ahead', { volume: 0.28, pitch: 0.7 }), sound(7, 'paradise.stalker.wall_scratch', 'right', { volume: 0.22 }),
  ]),
  event('distant_roar', E.Sensory, R.Scenario, 3, 14, score({ base: 3, fields: [['underground', 6], ['darkness', 5], ['tensionNorm', 4]] }), [
    sound(0, 'paradise.stalker.roar_muffled', 'far_ahead', { volume: 0.25, pitch: 0.66 }), sound(5.5, 'paradise.ambient.low_hum', 'right', { volume: 0.2, pitch: 0.55 }), sound(11, 'paradise.stalker.breath_far', 'behind', { volume: 0.18, pitch: 0.7 }),
  ]),
  event('numbers_in_walls', E.Sensory, R.Scenario, 2, 15, score({ base: 3, fields: [['artificial', 5], ['darkness', 5], ['stillness', 4]] }), [
    sound(0, 'paradise.ambient.radio_numbers', 'left', { volume: 0.2, pitch: 0.9 }), sound(6, 'paradise.ambient.radio_numbers', 'behind', { volume: 0.22, pitch: 0.72 }), sound(12, 'paradise.stalker.wall_scratch', 'behind', { volume: 0.3, pitch: 0.72 }),
  ]),
];

const reality = [
  event('echoed_action', E.RealityDistortion, R.Omen, 1, 9, score({ base: 3, fields: [['recentInteraction', 8], ['recentBreak', 5]] }), [
    sound(0, 'random.click', 'interaction', { volume: 0.25, pitch: 0.78 }), sound(3.5, 'random.click', 'behind', { volume: 0.28, pitch: 0.68 }), vhs(7, 'low', S(1.2)),
  ]),
  event('impossible_echo', E.RealityDistortion, R.Scenario, 2, 13, score({ base: 5, fields: [['underground', 5], ['artificial', 4], ['stillness', 3]] }), [
    sound(0, 'paradise.stalker.wall_scratch', 'ahead', { volume: 0.4 }), sound(4, 'paradise.stalker.wall_scratch', 'behind', { volume: 0.4, pitch: 1.08 }), sound(9, 'paradise.stalker.wall_scratch', 'ahead', { volume: 0.22, pitch: 0.52 }),
  ]),
  event('shadow_pass', E.RealityDistortion, R.Scenario, 2, 11, score({ base: 4, fields: [['darkness', 7], ['moving', 3]] }), [
    vhs(0, 'low', S(1)), particle(2, 'minecraft:basic_smoke_particle', 'peripheral', { count: 7, spread: 1.4 }), sound(6.5, 'paradise.stalker.step_behind', 'left', { volume: 0.25, pitch: 0.7 }),
  ]),
  event('light_without_source', E.RealityDistortion, R.Scenario, 2, 12, score({ base: 4, fields: [['darkness', 8], ['underground', 2]] }), [
    particle(0, 'minecraft:endrod', 'ahead', { count: 3, spread: 0.3 }), sound(3, 'paradise.ambient.low_hum', 'ahead', { volume: 0.2, pitch: 1.2 }), particle(8, 'minecraft:endrod', 'behind', { count: 1, spread: 0.1 }),
  ]),
  event('corridor_stretch_audio', E.RealityDistortion, R.Scenario, 3, 15, score({ base: 3, fields: [['artificial', 6], ['sprinting', 4], ['underground', 3]] }), [
    sound(0, 'paradise.stalker.step_behind', 'far_ahead', { volume: 0.3 }), sound(5, 'paradise.stalker.step_behind', 'far_ahead', { volume: 0.18, pitch: 0.6 }), vhs(9, 'low', S(2)), sound(12, 'paradise.stalker.step_behind', 'behind', { volume: 0.22, pitch: 1.15 }),
  ]),
  event('room_repeat', E.RealityDistortion, R.Scenario, 2, 14, score({ base: 2, fields: [['artificial', 7], ['routeRepeat', 7]] }), [
    sound(0, 'random.door_open', 'ahead', { volume: 0.25, pitch: 0.8 }), sound(5, 'random.door_open', 'ahead', { volume: 0.25, pitch: 0.8 }), sound(10, 'paradise.ambient.low_hum', 'behind', { volume: 0.25, pitch: 0.6 }),
  ]),
  event('vanished_noise_source', E.RealityDistortion, R.Omen, 2, 11, score({ base: 4, fields: [['turnedAround', 6], ['darkness', 3]] }), [
    sound(0, 'paradise.stalker.step_behind', 'behind', { volume: 0.55 }), sound(3.5, 'paradise.stalker.wall_scratch', 'left', { volume: 0.25, condition: 'turned_around' }), vhs(7.5, 'low', S(0.8)),
  ]),
  event('delayed_world_sound', E.RealityDistortion, R.Omen, 1, 10, score({ base: 3, fields: [['recentBreak', 7], ['recentInteraction', 5]] }), [
    sound(0, 'random.click', 'interaction', { volume: 0.18, pitch: 0.55 }), sound(4.5, 'dig.stone', 'interaction', { volume: 0.28, pitch: 0.6 }), sound(8, 'dig.stone', 'behind', { volume: 0.2, pitch: 1.2 }),
  ]),
  event('peripheral_static', E.RealityDistortion, R.Scenario, 3, 12, score({ base: 4, fields: [['turnedAround', 4], ['darkness', 5], ['tensionNorm', 3]] }), [
    vhs(0, 'low', S(1.5)), sound(2.5, 'paradise.ambient.radio_numbers', 'peripheral', { volume: 0.12, pitch: 0.52 }), particle(6, 'minecraft:basic_smoke_particle', 'peripheral', { count: 5 }), sound(9, 'paradise.stalker.breath_far', 'behind', { volume: 0.16 }),
  ]),
  event('false_daybreak', E.RealityDistortion, R.Major, 4, 18, score({ base: 2, fields: [['underground', 9], ['darkness', 5], ['stillness', 3]] }), [
    sound(0, 'ambient.weather.lightning.impact', 'far_ahead', { volume: 0.1, pitch: 1.7 }), particle(4, 'minecraft:endrod', 'far_ahead', { count: 8, spread: 2 }), vhs(8, 'high', S(2)), sound(13, 'paradise.ambient.low_hum', 'behind', { volume: 0.22, pitch: 0.5 }),
  ]),
];

const reactive = [
  event('lookback_punishment', E.PlayerReactive, R.Scenario, 3, 13, score({ base: 0, fields: [['lookBackRate', 14], ['darkness', 4]], require: (c) => c.lookBackRate >= 0.45 }), [
    sound(0, 'paradise.stalker.step_behind', 'behind', { volume: 0.5 }), sound(3, 'paradise.stalker.wall_scratch', 'ahead', { volume: 0.45, condition: 'turned_around' }), sound(9, 'paradise.stalker.breath_far', 'left', { volume: 0.2 }),
  ]),
  event('sprint_pursuit', E.PlayerReactive, R.Scenario, 3, 16, score({ base: 0, fields: [['sprinting', 10], ['fearSprint', 10]], require: (c) => c.sprinting && c.fearSprint }), [
    sound(0, 'paradise.stalker.step_behind', 'behind', { volume: 0.5 }), sound(3.5, 'paradise.stalker.step_behind', 'behind', { volume: 0.6, condition: 'sprinting' }), sound(7, 'paradise.stalker.step_behind', 'behind', { volume: 0.68, condition: 'sprinting' }), sound(12.5, 'paradise.stalker.breath_near', 'ahead', { volume: 0.3 }),
  ]),
  event('freeze_pressure', E.PlayerReactive, R.Scenario, 3, 14, score({ base: 0, fields: [['stillness', 12], ['tensionNorm', 5]], require: (c) => c.stillTicks >= S(4) }), [
    sound(0, 'paradise.stalker.breath_far', 'behind', { volume: 0.24 }), sound(5, 'paradise.stalker.breath_near', 'left', { volume: 0.42, condition: 'still' }), sound(10.5, 'paradise.stalker.wall_scratch', 'right', { volume: 0.38, condition: 'still' }),
  ]),
  event('backtrack_occupied', E.PlayerReactive, R.Scenario, 3, 15, score({ base: 0, fields: [['backtracked', 15], ['routeRepeat', 5]], require: (c) => c.backtracked }), [
    sound(0, 'paradise.stalker.step_behind', 'route_ahead', { volume: 0.28 }), sound(5, 'paradise.stalker.wall_scratch', 'route_ahead', { volume: 0.38 }), watcher(9.5, 'hallway', 'route_ahead'),
  ]),
  event('route_warning', E.PlayerReactive, R.Scenario, 3, 16, score({ base: 0, fields: [['routeRepeat', 16], ['sprinting', 3]], require: (c) => c.routeRepeat >= 0.5 }), [
    sound(0, 'paradise.stalker.wall_scratch', 'route_ahead', { volume: 0.3 }), sound(5, 'paradise.stalker.breath_far', 'route_ahead', { volume: 0.24 }), watcher(10, 'half_hidden', 'route_ahead'),
  ]),
  event('darkness_curiosity', E.PlayerReactive, R.Omen, 2, 12, score({ base: 0, fields: [['darkness', 10], ['moving', 4]], require: (c) => c.darkness >= 0.65 }), [
    sound(0, 'paradise.ambient.low_hum', 'ahead', { volume: 0.2 }), sound(4.5, 'paradise.dimension.catacomb_whisper', 'ahead', { volume: 0.18 }), particle(9, 'minecraft:basic_smoke_particle', 'ahead', { count: 4 }),
  ]),
  event('hiding_breath', E.PlayerReactive, R.Scenario, 3, 14, score({ base: 0, fields: [['hiding', 16], ['darkness', 3]], require: (c) => c.hiding }), [
    sound(0, 'paradise.stalker.step_behind', 'outside_hide', { volume: 0.3 }), sound(5, 'paradise.stalker.breath_far', 'outside_hide', { volume: 0.38 }), sound(10, 'paradise.stalker.breath_near', 'outside_hide', { volume: 0.32 }),
  ]),
  event('doorway_hesitation', E.PlayerReactive, R.Omen, 2, 10, score({ base: 0, fields: [['doorHesitation', 15], ['artificial', 3]], require: (c) => c.doorHesitation }), [
    sound(0, 'random.door_close', 'ahead', { volume: 0.32, pitch: 0.7 }), sound(3.2, 'paradise.stalker.step_behind', 'behind', { volume: 0.28 }), sound(7, 'random.door_open', 'behind', { volume: 0.22, pitch: 0.8 }),
  ]),
  event('repeated_shelter', E.PlayerReactive, R.Scenario, 3, 17, score({ base: 0, fields: [['shelterReliance', 16], ['artificial', 4]], require: (c) => c.shelterReliance >= 0.5 }), [
    sound(0, 'paradise.stalker.wall_scratch', 'outside_hide', { volume: 0.3 }), sound(6, 'random.door_open', 'peripheral', { volume: 0.28, pitch: 0.72 }), sound(12, 'paradise.stalker.breath_far', 'outside_hide', { volume: 0.3 }),
  ]),
  event('fearless_approach', E.PlayerReactive, R.Scenario, 3, 15, score({ base: 0, fields: [['bravery', 15], ['tensionNorm', 4]], require: (c) => c.bravery >= 0.55 }), [
    sound(0, 'paradise.stalker.breath_far', 'ahead', { volume: 0.25 }), sound(5, 'paradise.stalker.roar_muffled', 'far_ahead', { volume: 0.2, pitch: 0.7 }), watcher(10, 'half_hidden', 'ahead'),
  ]),
];

const watcherLinked = [
  event('peripheral_watch', E.WatcherLinked, R.Scenario, 3, 14, score({ base: 5, fields: [['darkness', 5], ['moving', 2], ['tensionNorm', 3]] }), [sound(0, 'paradise.stalker.breath_far', 'peripheral', { volume: 0.2 }), watcher(5, 'half_hidden', 'peripheral'), sound(10, 'paradise.stalker.step_behind', 'behind', { volume: 0.2 })]),
  event('distant_observer', E.WatcherLinked, R.Scenario, 3, 16, score({ base: 5, fields: [['openSpace', 6], ['tensionNorm', 4]] }), [sound(0, 'paradise.ambient.low_hum', 'far_ahead', { volume: 0.18 }), watcher(6, 'fog', 'far_ahead'), sound(12, 'paradise.stalker.breath_far', 'behind', { volume: 0.16 })]),
  event('hallway_glimpse', E.WatcherLinked, R.Scenario, 3, 15, score({ base: 5, fields: [['artificial', 6], ['darkness', 4]] }), [sound(0, 'paradise.stalker.wall_scratch', 'ahead', { volume: 0.3 }), watcher(5, 'hallway', 'ahead'), sound(11, 'paradise.ambient.light_pop', 'ahead', { volume: 0.35 })]),
  event('half_hidden_presence', E.WatcherLinked, R.Scenario, 3, 15, score({ base: 4, fields: [['artificial', 5], ['stillness', 4], ['darkness', 4]] }), [sound(0, 'paradise.stalker.breath_far', 'right', { volume: 0.22 }), watcher(6, 'half_hidden', 'right'), sound(11.5, 'paradise.stalker.wall_scratch', 'left', { volume: 0.25 })]),
  event('turnaround_presence', E.WatcherLinked, R.Scenario, 3, 13, score({ base: 0, fields: [['turnedAround', 14], ['lookBackRate', 5]], require: (c) => c.turnedAround }), [sound(0, 'paradise.stalker.step_behind', 'behind', { volume: 0.45 }), watcher(3.5, 'turnaround', 'behind'), sound(9, 'paradise.stalker.wall_scratch', 'ahead', { volume: 0.22 })]),
  event('fog_silhouette', E.WatcherLinked, R.Major, 4, 20, score({ base: 4, fields: [['openSpace', 6], ['darkness', 4], ['tensionNorm', 5]] }), [sound(0, 'paradise.ambient.low_hum', 'far_ahead', { volume: 0.2, pitch: 0.6 }), vhs(5, 'low', S(2)), watcher(8, 'fog', 'far_ahead'), sound(15, 'paradise.stalker.roar_muffled', 'far_ahead', { volume: 0.16, pitch: 0.55 })]),
  event('route_intercept', E.WatcherLinked, R.Major, 4, 19, score({ base: 0, fields: [['routeRepeat', 14], ['fearSprint', 5]], require: (c) => c.routeRepeat >= 0.45 }), [sound(0, 'paradise.stalker.step_behind', 'behind', { volume: 0.35 }), sound(5, 'paradise.stalker.wall_scratch', 'route_ahead', { volume: 0.4 }), watcher(9, 'half_hidden', 'route_ahead'), sound(15, 'paradise.stalker.breath_far', 'left', { volume: 0.18 })]),
  event('stare_contest', E.WatcherLinked, R.Major, 4, 18, score({ base: 0, fields: [['stillness', 10], ['bravery', 7]], require: (c) => c.stillTicks >= S(3) }), [sound(0, 'paradise.stalker.breath_far', 'ahead', { volume: 0.18 }), watcher(5, 'hallway', 'ahead'), vhs(9, 'low', S(2)), sound(14, 'paradise.ambient.low_hum', 'behind', { volume: 0.2, pitch: 0.55 })]),
  event('bait_sighting', E.WatcherLinked, R.Scenario, 3, 16, score({ base: 0, fields: [['fearSprint', 13], ['routeRepeat', 4]], require: (c) => c.fearSprint }), [watcher(0, 'hallway', 'ahead'), sound(5, 'paradise.stalker.step_behind', 'behind', { volume: 0.35, condition: 'sprinting' }), sound(10, 'paradise.stalker.wall_scratch', 'route_ahead', { volume: 0.3 })]),
  event('false_pursuit_watcher', E.WatcherLinked, R.Major, 4, 20, score({ base: 2, fields: [['sprinting', 6], ['fearSprint', 7], ['tensionNorm', 4]] }), [sound(0, 'paradise.stalker.step_behind', 'behind', { volume: 0.5 }), sound(4, 'paradise.stalker.step_behind', 'behind', { volume: 0.62, condition: 'sprinting' }), watcher(8, 'turnaround', 'behind'), sound(14, 'paradise.stalker.breath_far', 'ahead', { volume: 0.2 })]),
];

const destructive = [
  event('wall_breach', E.Destructive, R.Major, 5, 20, score({ base: 3, fields: [['artificial', 9], ['darkness', 4], ['tensionNorm', 4]], require: (c) => c.destructibleNearby }), [sound(0, 'paradise.stalker.wall_scratch', 'ahead', { volume: 0.5 }), sound(5, 'dig.stone', 'ahead', { volume: 0.55, pitch: 0.7 }), destruct(8, 'remove', { maxBlocks: 5, radius: 5, anchor: 'ahead', geometry: 'wall' }), particle(9, 'minecraft:basic_smoke_particle', 'ahead', { count: 10, spread: 1.2 }), sound(14, 'paradise.stalker.breath_far', 'ahead', { volume: 0.2 })]),
  event('ceiling_collapse', E.Destructive, R.Major, 5, 18, score({ base: 4, fields: [['underground', 9], ['tensionNorm', 4]], require: (c) => c.destructibleNearby }), [sound(0, 'dig.stone', 'overhead', { volume: 0.3, pitch: 0.5 }), sound(4, 'random.anvil_land', 'overhead', { volume: 0.2, pitch: 0.65 }), destruct(7, 'collapse', { maxBlocks: 6, radius: 4, anchor: 'overhead', geometry: 'ceiling' }), particle(8, 'minecraft:basic_smoke_particle', 'overhead', { count: 12, spread: 1.4 })]),
  event('floor_failure', E.Destructive, R.Major, 5, 16, score({ base: 2, fields: [['artificial', 5], ['underground', 5], ['stillness', 3]], require: (c) => c.safeFloorFailure }), [sound(0, 'dig.stone', 'below', { volume: 0.25, pitch: 0.55 }), sound(4, 'paradise.stalker.wall_scratch', 'below', { volume: 0.3, pitch: 0.65 }), destruct(7, 'remove', { maxBlocks: 3, radius: 2, anchor: 'below', geometry: 'floor' }), particle(8, 'minecraft:basic_smoke_particle', 'below', { count: 8 })]),
  event('light_extinction', E.Destructive, R.Major, 4, 18, score({ base: 3, fields: [['artificial', 7], ['darkness', 4]], require: (c) => c.nearLight }), [sound(0, 'paradise.ambient.light_pop', 'left'), sound(4, 'paradise.ambient.light_pop', 'right'), destruct(7, 'extinguish', { maxBlocks: 4, radius: 7, anchor: 'near', geometry: 'light' }), sound(11, 'paradise.stalker.breath_far', 'behind', { volume: 0.3 }), vhs(14, 'low', S(2))]),
  event('doorway_seal', E.Destructive, R.Major, 4, 18, score({ base: 3, fields: [['artificial', 8], ['doorHesitation', 4]], require: (c) => c.nearDoor && c.sealableDoorway }), [sound(0, 'random.door_close', 'ahead', { volume: 0.55, pitch: 0.7 }), sound(4, 'dig.stone', 'ahead', { volume: 0.4, pitch: 0.65 }), destruct(7, 'seal', { maxBlocks: 1, radius: 3, anchor: 'ahead', geometry: 'doorway' }), sound(12, 'paradise.stalker.wall_scratch', 'behind', { volume: 0.35 })]),
  event('structural_decay', E.Destructive, R.Major, 5, 22, score({ base: 3, fields: [['artificial', 8], ['stillness', 4], ['tensionNorm', 4]], require: (c) => c.destructibleNearby }), [sound(0, 'paradise.ambient.low_hum', 'near', { volume: 0.2, pitch: 0.52 }), destruct(5, 'remove', { maxBlocks: 3, radius: 6, anchor: 'left', geometry: 'wall' }), sound(8, 'dig.stone', 'right', { volume: 0.35, pitch: 0.6 }), destruct(11, 'remove', { maxBlocks: 5, radius: 6, anchor: 'right', geometry: 'wall' }), particle(13, 'minecraft:basic_smoke_particle', 'near', { count: 10, spread: 1.5 })]),
  event('fire_outbreak', E.Destructive, R.Major, 5, 19, score({ base: 2, fields: [['artificial', 4], ['openSpace', 3], ['tensionNorm', 5]], require: (c) => c.safeIgnitionNearby }), [sound(0, 'fire.fire', 'ahead', { volume: 0.18, pitch: 0.7 }), sound(4, 'paradise.stalker.wall_scratch', 'ahead', { volume: 0.35 }), destruct(7, 'ignite', { maxBlocks: 3, radius: 5, anchor: 'ahead', geometry: 'surface' }), sound(12, 'fire.fire', 'ahead', { volume: 0.45, pitch: 0.8 })]),
  event('shelter_breach', E.Destructive, R.Major, 5, 22, score({ base: 0, fields: [['shelterReliance', 13], ['artificial', 7], ['tensionNorm', 3]], require: (c) => c.shelterReliance >= 0.5 && c.destructibleNearby }), [sound(0, 'paradise.stalker.wall_scratch', 'outside_hide', { volume: 0.45 }), sound(6, 'dig.stone', 'outside_hide', { volume: 0.5, pitch: 0.65 }), destruct(9, 'remove', { maxBlocks: 6, radius: 5, anchor: 'outside_hide', geometry: 'wall' }), sound(14, 'paradise.stalker.breath_far', 'outside_hide', { volume: 0.35 }), watcher(17, 'half_hidden', 'outside_hide')]),
  event('path_collapse', E.Destructive, R.Major, 5, 20, score({ base: 0, fields: [['routeRepeat', 14], ['fearSprint', 4]], require: (c) => c.routeRepeat >= 0.5 && c.destructibleNearby }), [sound(0, 'random.anvil_land', 'route_ahead', { volume: 0.22, pitch: 0.6 }), sound(5, 'dig.stone', 'route_ahead', { volume: 0.5, pitch: 0.65 }), destruct(8, 'collapse', { maxBlocks: 6, radius: 5, anchor: 'route_ahead', geometry: 'path' }), particle(9, 'minecraft:basic_smoke_particle', 'route_ahead', { count: 12, spread: 1.8 }), sound(15, 'paradise.stalker.step_behind', 'behind', { volume: 0.25 })]),
  event('catastrophic_peak', E.Destructive, R.Major, 5, 26, score({ base: 1, fields: [['tensionNorm', 12], ['darkness', 4], ['alone', 3]], require: (c) => c.destructibleNearby && c.tension >= 78 }), [sound(0, 'paradise.stalker.roar_muffled', 'far_ahead', { volume: 0.35, pitch: 0.58 }), vhs(3, 'high', S(3)), destruct(6, 'remove', { maxBlocks: 6, radius: 6, anchor: 'ahead', geometry: 'wall' }), sound(9, 'random.anvil_land', 'overhead', { volume: 0.3, pitch: 0.55 }), destruct(12, 'collapse', { maxBlocks: 6, radius: 6, anchor: 'overhead', geometry: 'ceiling' }), sound(16, 'paradise.stalker.breath_near', 'behind', { volume: 0.4 }), watcher(19, 'fog', 'far_ahead')]),
];

export const HORROR_EVENT_CATALOG = Object.freeze([
  ...environmental,
  ...sensory,
  ...reality,
  ...reactive,
  ...watcherLinked,
  ...destructive,
]);

const FORBIDDEN_ACTIONS = new Set(['damage', 'teleport_player', 'inventory', 'title', 'actionbar', 'message']);
const ALLOWED_CONDITIONS = new Set(['turned_around', 'not_turned', 'sprinting', 'not_sprinting', 'still', 'moving', 'dark', 'backtracked']);
const ALLOWED_ANCHOR_POLICIES = new Set(['fixed_world', 'follow_player', 'adaptive']);
const ALLOWED_DESTRUCTIVE_GEOMETRIES = new Set(['wall', 'ceiling', 'floor', 'path', 'surface', 'light', 'doorway']);

export function validateHorrorEventCatalog(catalog) {
  const errors = [];
  if (!Array.isArray(catalog)) return ['catalog_not_array'];
  const keys = new Set();
  const familyCounts = new Map();
  for (const eventDef of catalog) {
    if (!eventDef?.key || keys.has(eventDef.key)) errors.push(`bad_key:${eventDef?.key}`);
    keys.add(eventDef?.key);
    familyCounts.set(eventDef?.family, (familyCounts.get(eventDef?.family) || 0) + 1);
    if (typeof eventDef?.score !== 'function') errors.push(`missing_score:${eventDef?.key}`);
    if (!ALLOWED_ANCHOR_POLICIES.has(eventDef?.anchorPolicy)) errors.push(`bad_anchor_policy:${eventDef?.key}`);
    if (!Array.isArray(eventDef?.actions) || eventDef.actions.length < 3) errors.push(`too_few_actions:${eventDef?.key}`);
    let lastAt = -1;
    for (const action of eventDef?.actions || []) {
      if (FORBIDDEN_ACTIONS.has(action.type)) errors.push(`forbidden_action:${eventDef.key}:${action.type}`);
      if (action.condition && !ALLOWED_CONDITIONS.has(action.condition)) errors.push(`bad_condition:${eventDef.key}:${action.condition}`);
      if (!Number.isFinite(action.at) || action.at < lastAt) errors.push(`bad_timing:${eventDef.key}`);
      lastAt = action.at;
      if (action.type === 'destruct' && eventDef.family !== EVENT_FAMILY.Destructive) errors.push(`destruct_wrong_family:${eventDef.key}`);
      if (action.type === 'destruct' && (!(action.maxBlocks >= 1) || action.maxBlocks > 12)) errors.push(`destruct_budget:${eventDef.key}`);
      if (action.type === 'destruct' && !ALLOWED_DESTRUCTIVE_GEOMETRIES.has(action.geometry)) errors.push(`destruct_geometry:${eventDef.key}`);
      if (action.type === 'watcher' && action.chase === true) errors.push(`watcher_chase:${eventDef.key}`);
    }
  }
  for (const family of Object.values(EVENT_FAMILY)) {
    if (familyCounts.get(family) !== 10) errors.push(`family_count:${family}:${familyCounts.get(family) || 0}`);
  }
  if (catalog.length !== 60) errors.push(`catalog_count:${catalog.length}`);
  return errors;
}
