import path from "node:path";

const VANILLA_SPAWN_EGG_BY_ENTITY = new Map([
  ["armadillo.entity.json", "spawn_egg_armadillo"],
  ["camel.entity.json", "spawn_egg_camel"],
  ["cat.entity.json", "spawn_egg_cat"],
  ["chicken.entity.json", "spawn_egg_chicken"],
  ["cow.entity.json", "spawn_egg_cow"],
  ["fox.entity.json", "spawn_egg_fox"],
  ["goat.entity.json", "spawn_egg_goat"],
  ["llama.entity.json", "spawn_egg_llama"],
  ["ocelot.entity.json", "spawn_egg_ocelot"],
  ["panda.entity.json", "spawn_egg_panda"],
  ["parrot.entity.json", "spawn_egg_parrot"],
  ["pig.entity.json", "spawn_egg_pig"],
  ["rabbit.entity.json", "spawn_egg_rabbit"],
  ["sheep.entity.json", "spawn_egg_sheep"],
  ["turtle.entity.json", "spawn_egg_turtle"],
]);

const VANILLA_ANIMATION_BY_ENTITY = new Map([
  ["camel.entity.json", ["animation.camel.look_at_target"]],
  ["cat.entity.json", ["animation.cat.baby_transform"]],
  ["fox.entity.json", ["animation.fox.baby_transform"]],
  ["sheep.entity.json", ["animation.sheep.setup.v2", "animation.sheep.baby_transform"]],
]);

const VANILLA_TERRAIN_TEXTURES = new Set([
  "textures/blocks/cake",
]);

const REFERENCE_TOKEN_CHARACTER = String.raw`[A-Za-z0-9_./\\:-]`;

function containsExactReference(message, reference) {
  const escaped = reference.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `(?<!${REFERENCE_TOKEN_CHARACTER})${escaped}(?!${REFERENCE_TOKEN_CHARACTER})`,
  ).test(message);
}

function normalizeAnimationDiagnosticMessage(message) {
  return message.replace(/^Missing animation\.(?=animation\.)/i, "Missing ");
}

function formatCode(code) {
  if (typeof code === "string" || typeof code === "number") return String(code);
  if (code && typeof code === "object") {
    if (typeof code.value === "string") return code.value;
    if (typeof code.code === "string") return code.code;
  }
  return "";
}

export function vanillaFallbackReason(diagnostic) {
  const file = String(diagnostic.file ?? "").replaceAll("\\", "/");
  const fileName = path.posix.basename(file);
  const code = formatCode(diagnostic.code);
  const message = String(diagnostic.message ?? "");

  if (code === "behaviorpack.item.components.texture_not_found") {
    const spawnEgg = VANILLA_SPAWN_EGG_BY_ENTITY.get(fileName);
    if (
      spawnEgg &&
      file.includes("/RP/entity/") &&
      message.includes(`"${spawnEgg}"`)
    ) {
      return `vanilla spawn-egg texture alias ${spawnEgg}`;
    }
  }

  if (code === "resourcepack.anim_or_controller.missing") {
    const animations = VANILLA_ANIMATION_BY_ENTITY.get(fileName) ?? [];
    const searchableMessage = normalizeAnimationDiagnosticMessage(message);
    const animation = animations.find((name) => containsExactReference(searchableMessage, name));
    if (file.includes("/RP/entity/") && animation) {
      return `vanilla client animation ${animation}`;
    }
  }

  if (
    code === "resourcepack.texture.missing" &&
    file.endsWith("/RP/textures/terrain_texture.json")
  ) {
    for (const texture of VANILLA_TERRAIN_TEXTURES) {
      if (containsExactReference(message, texture)) return `vanilla terrain texture ${texture}`;
    }
  }

  return null;
}
