# Yellow Halls return-air vent

A two-section wall return grille with a flush double perimeter frame, ten angled horizontal louvers, a center divider, recessed dark duct backing, and four dark fastener heads.

## Files

- `yellow_halls_return_air_vent.bbmodel` — editable Blockbench Bedrock Block project.
- `yellow_halls_return_air_vent.geo.json` — Bedrock geometry export.
- `return_air_vent_iron.png` — 32×32 atlas copied byte-for-byte from the completed shared vent grille atlas.
- `plan.json` — dimensions, geometry parts, references, and verification status.
- `uv_audit.json` — face UV assignments extracted from the exported editable project.
- `three_quarter.png` — final 640×480 Blockbench screenshot.

## Texture sources

The delivered atlas is an unchanged copy of `../shared/vent_grille/iron.png` (SHA-256 `fe11dd7bdde77be6b7c9f8dfb2ff337b64a27128e68f8c615f91930268c61d51`). Its source tiles are the local vanilla `textures/blocks/iron_block.png` and `textures/blocks/concrete_black.png` assets listed in `plan.json`. No pixels were painted, recolored, resized, or filtered.

## Verification

Native front, three-quarter, back, and side views were inspected. Blockbench reports bounds `[-8, 2, 5.8]` to `[8, 14, 8]`, size `16×12×2.2`, and confirms the model fits a single block cell. The export still uses the Bedrock default identifier `geometry.unknown`; pack bindings and in-game behavior are not part of this asset phase. The final three-quarter screenshot is saved as `three_quarter.png` (640×480; SHA-256 `f5a02ba67b598715ca66305f8714e4afbce415df2bd6cd5e9c36b0045d9b0627`). The exported project has 24 cubes and 144 assigned faces; all UV rectangles are structurally valid. The PNG, editable project, Bedrock geometry, atlas, plan, and UV audit are present. In-game rendering and pack integration remain intentionally out of scope.
