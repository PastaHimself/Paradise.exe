#!/usr/bin/env python3
"""Apply narrow, behavior-preserving fixes exposed by Bedrock beta JS type-checking."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "addon" / "Genshin X Craft BP" / "scripts"


def replace_once(relative: str, old: str, new: str) -> None:
    path = SCRIPTS / relative
    source = path.read_text(encoding="utf-8")
    if new in source:
        return
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"Expected exactly one match in {relative}, found {count}: {old!r}")
    path.write_text(source.replace(old, new, 1), encoding="utf-8")


def main() -> None:
    replace_once(
        "dimension_horror_rules.js",
        "system.runTimeout(resolve, Math.max(1, Math.floor(ticks || 1)));",
        "system.runTimeout(() => resolve(), Math.max(1, Math.floor(ticks || 1)));",
    )

    replace_once(
        "endless_staircase.js",
        "  let structureId = STAIR_SCENERY.support;",
        "  /** @type {string} */\n  let structureId = STAIR_SCENERY.support;",
    )

    replace_once(
        "harmful_player_events.js",
        "function safeDamage(player, amount, minHealth = CONFIG.lethalFloor, damagingEntity = undefined) {",
        "function safeDamage(player, amount, minHealth = Number(CONFIG.lethalFloor), damagingEntity = undefined) {",
    )

    replace_once(
        "horror_events_v2.js",
        '    case "temp_light": executeTempLight(session, player, action, currentTick); break;',
        '    case "temp_light": executeTempLight(session, player, action); break;',
    )

    replace_once(
        "paradise_dimension_plan.js",
        "const PARADISE_DIMENSION_IDS = new Set(Object.values(DIMENSION));",
        "/** @type {Set<string>} */\nconst PARADISE_DIMENSION_IDS = new Set(Object.values(DIMENSION));",
    )

    replace_once(
        "paradise_player_horror_state.js",
        "  const merged = {\n    ...profile,\n    ...consequence,\n  };",
        "  const merged = /** @type {any} */ ({\n    ...profile,\n    ...consequence,\n  });",
    )

    replace_once(
        "paradise_visual_budget.js",
        "  let tier = MEMORY_TIER.Mid;",
        "  /** @type {number} */\n  let tier = MEMORY_TIER.Mid;",
    )

    replace_once(
        "player_light.js",
        "function handleFlashlightUse(event) {\n  if (!isFlashlightItem(event?.itemStack)) {\n    return;\n  }\n\n  const player = event.source;",
        "function handleFlashlightUse(event) {\n  const itemStack = event?.beforeItemStack ?? event?.itemStack;\n  if (!isFlashlightItem(itemStack)) {\n    return;\n  }\n\n  const player = event?.source ?? event?.player;",
    )
    replace_once(
        "player_light.js",
        "subscribeAfterEvent(world.afterEvents.itemUseOn, handleFlashlightUse);",
        "subscribeAfterEvent(world.afterEvents.playerInteractWithBlock, handleFlashlightUse);",
    )


if __name__ == "__main__":
    main()
