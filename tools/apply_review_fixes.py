#!/usr/bin/env python3
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "addon" / "Genshin X Craft BP" / "scripts" / "yellow_halls.js"

OLD = '''  if (disabled > 0) {
    state.flickerOn = true;
    state.flickerRestoreTick = now + randomInt(FLICKER_BURST_MIN_TICKS, FLICKER_BURST_MAX_TICKS);
  } else {
    state.nextFlickerTick = now + randomInt(20, 60);
  }
'''

NEW = '''  if (disabled > 0) {
    const burstTicks = randomInt(FLICKER_BURST_MIN_TICKS, FLICKER_BURST_MAX_TICKS);
    state.flickerOn = true;
    state.flickerRestoreTick = now + burstTicks;
    system.runTimeout(() => {
      try {
        if (!state.flickerOn) return;
        restoreFlickeredLights(dimension);
        state.nextFlickerTick = system.currentTick + randomInt(FLICKER_MIN_GAP_TICKS, FLICKER_MAX_GAP_TICKS);
      } catch (_error) {}
    }, burstTicks);
  } else {
    state.nextFlickerTick = now + randomInt(20, 60);
  }
'''


def main() -> None:
    source = TARGET.read_text(encoding="utf-8")
    if NEW in source:
        return
    count = source.count(OLD)
    if count != 1:
        raise RuntimeError(f"Expected one Yellow Halls flicker block, found {count}")
    TARGET.write_text(source.replace(OLD, NEW, 1), encoding="utf-8")


if __name__ == "__main__":
    main()
