# Paradise.exe V2 · Codex live verification checklist

Static renovation passes (`docs/GLM_FLASH_7DIM_MASTER_PLAN.md`, Pre-Ticket 0 → Ticket 8) are
merged on headless gates only. This file is the hand-off contract for the Codex desktop
session that runs the deferred in-game verification.

## How to run this checklist

1. Install the `.mcaddon` named in the stage section (`/tmp/Paradise-static-<stage>.mcaddon`).
2. Create a new flat world: **creative**, **standard (non-PBR) lighting**, resource pack
   subpack **`vhs_off`** active (it is the last subpack in `addon/RP/manifest.json`, so it
   wins), no experiments toggled on.
3. Every command below is copy-paste ready. `tp` commands must be run by a player with
   cheats enabled. Coordinates are block corners (`x y z` = the block you stand on).
4. Record `pass` / `fail` per line. A stage ships only when every line is `pass`.

### Environment pins

| Pin | Value |
| --- | --- |
| Engine floor | `1.26.50` (both manifests) |
| Lighting | Standard Bedrock lighting, PBR texture sets not required |
| Subpack | `vhs_off` |
| Experiments | none (zero toggles) |
| Canonical dimensions | `paradise:yellow_halls`, `library:the_library`, `paradise:flat_flower`, `paradise:endless_staircase`, `paradise:burning_highway`, `catacombs:catacomb_mazes`, `heaven:the_heaven` |

---

## Pre-Ticket 0 · Shared kits (`feat/v2-static-0-shared-kits`)

**Package.** `/tmp/Paradise-static-0.mcaddon`

**What shipped.** 73 shared-kit block definitions (90 emitted IDs once the 16-unit splitter
expanded `sign_backing`, `door_frame_trim`, `sign_post`, `fuse_box`, `hanging_sign`,
`conduit_end_cap` and the reusable fixture states) plus 4 `minecraft:oak_wall_sign`
native-substitute rows for `legible_pixel_alphabet`. All atlases are vanilla-pixel
re-assemblies logged in `3d model *DECORATION*/paradise_exe_v2/asset-index.csv`.

Bedrock caps a pack path segment at 59 characters, and the splitter appends
`_x0_y0_z0` plus a `.geo.json`/`.json` suffix, so four families carry shortened IDs
(`sh_sign_backing*`, `sh_sign_post*`, `sh_hanging_sign*`, `sh_fixture_*`). The ledger asset
names are unchanged in `asset-index.csv`.

### Build the QA bay (flat disposable world, origin `0 64 0`)

```text
/gamemode creative
/time set noon
/weather clear
/fill 0 64 0 47 64 23 minecraft:smooth_stone
/fill 0 65 12 47 69 12 minecraft:smooth_stone
/fill 0 70 8 47 70 12 minecraft:smooth_stone
/fill -4 64 -4 51 71 27 minecraft:air replace minecraft:water
```

Standing area is `y=65`, mounting plane is `z=11` (wall behind at `z=12`), ceiling fixtures
hang at `y=70/z=9`. Every block below is placed with
`["minecraft:cardinal_direction"="north"]` unless the row says otherwise.

### Viewpoints

```text
/execute in minecraft:overworld run tp @s 16 66 4
/execute in minecraft:overworld run tp @s 0 66 4
/execute in minecraft:overworld run tp @s 32 66 4
/execute in minecraft:overworld run tp @s 16 66 20
/execute in minecraft:overworld run tp @s 11 66 8
```

### Electrical kit rows (`y=67`, `z=11`)

Iron base `x=0`, dark base `x=16`, copper base `x=32`. Offsets are
`+1` conduit straight, `+3` conduit elbow, `+5` conduit end cap, `+7` wall junction,
`+9` fuse box, `+11` switch plate, `+13` vent grille.

```text
/setblock 1 67 11 paradise:sh_conduit_straight_iron ["minecraft:cardinal_direction"="north"]
/setblock 3 67 11 paradise:sh_conduit_elbow_iron ["minecraft:cardinal_direction"="north"]
/setblock 5 67 11 paradise:sh_conduit_end_cap_x0_y0_z0 ["minecraft:cardinal_direction"="north"]
/setblock 7 67 11 paradise:sh_wall_junction_iron ["minecraft:cardinal_direction"="north"]
/setblock 9 67 11 paradise:sh_fuse_box_x0_y0_z0 ["minecraft:cardinal_direction"="north"]
/setblock 11 67 11 paradise:sh_switch_plate_iron ["minecraft:cardinal_direction"="north"]
/setblock 13 67 11 paradise:sh_vent_grille_iron ["minecraft:cardinal_direction"="north"]
/setblock 17 67 11 paradise:sh_conduit_straight_dark ["minecraft:cardinal_direction"="north"]
/setblock 19 67 11 paradise:sh_conduit_elbow_dark ["minecraft:cardinal_direction"="north"]
/setblock 21 67 11 paradise:sh_conduit_end_cap_dark_x0_y0_z0 ["minecraft:cardinal_direction"="north"]
/setblock 23 67 11 paradise:sh_wall_junction_dark ["minecraft:cardinal_direction"="north"]
/setblock 25 67 11 paradise:sh_fuse_box_dark_x0_y0_z0 ["minecraft:cardinal_direction"="north"]
/setblock 27 67 11 paradise:sh_switch_plate_dark ["minecraft:cardinal_direction"="north"]
/setblock 29 67 11 paradise:sh_vent_grille_dark ["minecraft:cardinal_direction"="north"]
/setblock 33 67 11 paradise:sh_conduit_straight_copper ["minecraft:cardinal_direction"="north"]
/setblock 35 67 11 paradise:sh_conduit_elbow_copper ["minecraft:cardinal_direction"="north"]
/setblock 37 67 11 paradise:sh_conduit_end_cap_copper_x0_y0_z0 ["minecraft:cardinal_direction"="north"]
/setblock 39 67 11 paradise:sh_wall_junction_copper ["minecraft:cardinal_direction"="north"]
/setblock 41 67 11 paradise:sh_fuse_box_copper_x0_y0_z0 ["minecraft:cardinal_direction"="north"]
/setblock 43 67 11 paradise:sh_switch_plate_copper ["minecraft:cardinal_direction"="north"]
/setblock 45 67 11 paradise:sh_vent_grille_copper ["minecraft:cardinal_direction"="north"]
```

| Check | Expectation |
| --- | --- |
| Conduit run | Straight / elbow / end cap read as one continuous 2-px conduit; no gap, no z-fight with the wall |
| Fuse and switch | Flush against `z=11`; fuse box body does not poke through `z=12` |
| Vent grille | Slats visible, `2`-block wide face flat on the wall |
| Material separation | Iron = grey, dark = near-black, copper = green-brown; three visibly different kits |
| Path clearance | Walking the `z=10` lane at `y=65` never collides with a wall kit (all kits are collision-free) |

### Fixture states (`y=70`, `z=9`)

```text
/setblock 1 70 9 paradise:sh_fixture_lit_x0_y0_z0 ["minecraft:cardinal_direction"="north"]
/setblock 1 70 10 paradise:sh_fixture_lit_x0_y0_z1 ["minecraft:cardinal_direction"="north"]
/setblock 5 70 9 paradise:sh_fixture_unlit_x0_y0_z0 ["minecraft:cardinal_direction"="north"]
/setblock 5 70 10 paradise:sh_fixture_unlit_x0_y0_z1 ["minecraft:cardinal_direction"="north"]
/setblock 9 70 9 paradise:sh_fixture_damaged_x0_y0_z0 ["minecraft:cardinal_direction"="north"]
/setblock 9 70 10 paradise:sh_fixture_damaged_x0_y0_z1 ["minecraft:cardinal_direction"="north"]
/setblock 13 70 9 paradise:sh_fixture_dim_x0_y0_z0 ["minecraft:cardinal_direction"="north"]
/setblock 13 70 10 paradise:sh_fixture_dim_x0_y0_z1 ["minecraft:cardinal_direction"="north"]
```

```text
/execute in minecraft:overworld run tp @s 7 66 6
```

| Check | Expectation |
| --- | --- |
| Lit | `light_emission` 13; the two blocks read as one 2-block housing; warm diffuse face |
| Unlit | `light_emission` 0; dark phosphor grid, no glow |
| Damaged | `light_emission` 4; corroded casing, dead filament |
| Dim | `light_emission` 7; low warm flicker tone |
| No floating cuboids | Housing back plate touches `z=9` ceiling cell; nothing hangs in mid-air |

### Signage and wear rows

Signs (`y=66`, `z=11`):

```text
/setblock 1 66 11 paradise:sh_sign_backing_x0_y0_z0 ["minecraft:cardinal_direction"="north"]
/setblock 2 66 11 paradise:sh_sign_backing_x1_y0_z0 ["minecraft:cardinal_direction"="north"]
/setblock 3 66 11 paradise:sh_small_wall_plate ["minecraft:cardinal_direction"="north"]
/setblock 5 66 11 paradise:sh_arrow_sheet_magenta_arrow ["minecraft:cardinal_direction"="north"]
/setblock 7 66 11 paradise:sh_arrow_sheet_chevron_arrow ["minecraft:cardinal_direction"="north"]
/setblock 9 66 11 paradise:sh_arrow_sheet_cardinal_compass ["minecraft:cardinal_direction"="north"]
/setblock 11 66 11 paradise:sh_arrow_sheet_focal_target ["minecraft:cardinal_direction"="north"]
/setblock 13 66 11 minecraft:oak_wall_sign ["minecraft:cardinal_direction"="north"]
/setblock 15 66 10 paradise:sh_sign_post_x0_y0_z0 ["minecraft:cardinal_direction"="north"]
/setblock 15 67 10 paradise:sh_sign_post_x0_y1_z0 ["minecraft:cardinal_direction"="north"]
```

Wear overlays (`y=65`, `z=11`) and debris:

```text
/setblock 1 65 11 paradise:sh_wear_overlays_cracks ["minecraft:cardinal_direction"="north"]
/setblock 3 65 11 paradise:sh_wear_overlays_stains ["minecraft:cardinal_direction"="north"]
/setblock 5 65 11 paradise:sh_wear_overlays_soot ["minecraft:cardinal_direction"="north"]
/setblock 7 65 11 paradise:sh_wear_overlays_chipped_edges ["minecraft:cardinal_direction"="north"]
/setblock 9 65 11 paradise:sh_wear_overlays_peeling_paint ["minecraft:cardinal_direction"="north"]
/setblock 11 65 10 paradise:sh_small_debris ["minecraft:cardinal_direction"="north"]
/setblock 13 65 10 paradise:sh_small_debris_charred ["minecraft:cardinal_direction"="north"]
/setblock 15 65 10 paradise:sh_small_debris_clean ["minecraft:cardinal_direction"="north"]
```

| Check | Expectation |
| --- | --- |
| Sign backing | Two-block-wide backing reads as one plate; no seam gap at `x=1→2` |
| Arrows | Four distinct glyphs, 1-px inset, readable at 4 blocks |
| Lettering | Vanilla sign accepts A–Z and 0–9 with the raw vanilla font, no custom atlas |
| Wear overlays | Five visibly different 1-px insets (cracks, stains, soot, chips, peeling) |
| Debris | Three debris clusters sit on the floor, never floating |

### Trim rows (`y=65`, `z=10`)

```text
/setblock 1 65 10 paradise:sh_wall_base_trim ["minecraft:cardinal_direction"="north"]
/setblock 3 65 10 paradise:sh_floor_border_trim ["minecraft:cardinal_direction"="north"]
/setblock 5 65 10 paradise:sh_corner_trim ["minecraft:cardinal_direction"="north"]
/setblock 7 65 10 paradise:sh_door_frame_trim_x0_y0_z0 ["minecraft:cardinal_direction"="north"]
/setblock 7 66 10 paradise:sh_door_frame_trim_x0_y1_z0 ["minecraft:cardinal_direction"="north"]
/setblock 9 65 10 paradise:sh_trim_end_cap ["minecraft:cardinal_direction"="north"]
```

| Check | Expectation |
| --- | --- |
| Base / border | Base trim hugs the wall foot; floor border lies flat, walkable |
| Corner | Corner trim closes the wall/floor joint without a diagonal gap |
| Door frame | Frame rises above the 1-block door aperture (`y=65..66`) and stops flush at `y=67` |
| End cap | Terminates a run cleanly, 3 px deep |

### Rotational check

```text
/setblock 20 65 10 paradise:sh_corner_trim ["minecraft:cardinal_direction"="east"]
/setblock 22 65 10 paradise:sh_corner_trim ["minecraft:cardinal_direction"="south"]
/setblock 24 65 10 paradise:sh_corner_trim ["minecraft:cardinal_direction"="west"]
/execute in minecraft:overworld run tp @s 22 66 6
```

| Check | Expectation |
| --- | --- |
| Cardinal states | Each rotation mounts against its own neighboring wall; no kit rotates into the room |

### Stage 0 sign-off

- [ ] All 73 shared-kit definitions resolve (no missing-texture purple checkerboard).
- [ ] Zero floating cuboids; every kit is flush to a wall, floor, or ceiling cell.
- [ ] Standard lighting shows every state distinctly (lit / unlit / damaged / dim).
- [ ] `vhs_off` reads cleanly with no VHS overlay.
- [ ] No interactive element exists in the build (switch plates and phone silhouettes are passive).

---

## Ticket 1 · Yellow Halls (`feat/v2-static-1-yellow-halls`)

**Package.** `/tmp/Paradise-static-1.mcaddon`

**What shipped.** 46 Yellow Halls block definitions (75 emitted IDs after the splitter) in four
families: wallpapers `clean/stained/peeling/water_damaged`, beige carpet
`base/worn_path/dark_stain`, acoustic ceiling `intact/cracked`, the multi-state fluorescent
fixtures (`lit` 13, `dim` 7, `burned_out` 0, `missing_tube` 6), eight authored scenery bays, the
service conduit chain, the reserved breaker mount and the wall/floor clutter lanes. The corridor
motif runs inside `generatePatchMaze` and is rejected whenever it would disconnect a patch.

**Where.** The authored bay set lives in patch `(1,0)`, which is world **X 32..63, Z 0..31** in
`paradise:yellow_halls`. Enter with `!enter_yellow_halls`, then walk east from the arrival pad.

### Viewpoints

```text
/execute in paradise:yellow_halls run tp @s 0 66 0
/execute in paradise:yellow_halls run tp @s 35 66 4
/execute in paradise:yellow_halls run tp @s 43 66 4
/execute in paradise:yellow_halls run tp @s 51 66 4
/execute in paradise:yellow_halls run tp @s 59 66 4
/execute in paradise:yellow_halls run tp @s 35 66 19
/execute in paradise:yellow_halls run tp @s 43 66 19
/execute in paradise:yellow_halls run tp @s 51 66 19
/execute in paradise:yellow_halls run tp @s 59 66 19
/execute in paradise:yellow_halls run tp @s 58 66 4
/execute in paradise:yellow_halls run tp @s 54 66 20
```

### Eight scenery bays

| Bay | Anchor (world) | Expected |
| --- | --- | --- |
| 1 | `35 66 7` | Closed office door, frame on x2/x5 of the cell, wallpaper behind |
| 2 | `43 66 7` | Bricked-up door, mortar lines readable, no gap to the corridor |
| 3 | `51 66 7` | Closed office door plus the STAIRWELL sign at `52 67 6` |
| 4 | `59 66 7` | Maintenance hatch recess and the MAINTENANCE plate at `60 67 6` |
| 5 | `35 66 16` | Bricked-up door on the south row |
| 6 | `43 66 16` | Closed office door with the return-air vent at `44 67 17` |
| 7 | `51 66 16` | ARCHIVE blind alcove: frame at x50/x53, arrow at `49 67 17`, sign at `51 67 17` |
| 8 | `59 66 16` | Closed door and EXIT wayfinding at `60 67 17` |

| Check | Expectation |
| --- | --- |
| Fake doors | Every bay reads as a shut door; no bay opens into a wall block or a live portal |
| Portal fallback | A bay whose face is a live portal moved one block inward and one block in +X |
| Signage | STAIRWELL / MAINTENANCE / ARCHIVE / EXIT glyphs are legible at 4 blocks, arrows point the right way |
| ARCHIVE mount | The alcove front volume `54 65 17` → `54 67 18` is empty; no prop was registered |

### Breaker reservation (must stay empty)

```text
/execute in paradise:yellow_halls run tp @s 54 66 20
```

| Check | Expectation |
| --- | --- |
| Back plane | `54..55 66..67 16` is a solid flat wallpaper plane |
| Front volume | `54..55 65..67 17..18` is air; no breaker prop, lever or interactive block exists |
| No wiring | `paradise_loop.js` is absent and nothing reacts to the reserved cells |

### Surfaces and lighting

| Check | Expectation |
| --- | --- |
| Wallpaper | Clean / stained / peeling / water-damaged mix; peeling only at corners or under a vent; water damage only near vents or corners |
| Carpet | Beige base with a worn path along the route columns and dark stains only on the shoulder |
| Acoustic ceiling | Intact with occasional cracked tiles; missing panels only inside the ceiling-failure module |
| Fixtures | Recessed two-block housings every four blocks along each leg; turn-adjacent fixture is dim; burned-out units have lit neighbours within four blocks |
| Path | Two-block clear walkable path with two blocks of headroom through every corridor and bay turnout |
| Flush mounting | No floating cuboid; every prop is flush to a wall, floor or ceiling |

### Service conduit

```text
/execute in paradise:yellow_halls run tp @s 58 66 4
```

| Check | Expectation |
| --- | --- |
| Run | Straight `57 67 6` → elbow `58 67 6` → junction `59 67 6` → end cap `61 67 6` reads as one conduit |
| Fuse cabinet | `paradise:yh_fuse_cabinet` sits at `58 65 6` and stays clear of the elbow above it |
| Vent | Return-air vent at `44 67 17` is flush with the wall and does not sit in a door column |

### Clutter lanes

| Check | Expectation |
| --- | --- |
| Floor props | Desk `57 65 20`, filing cabinet `33 65 5`, water cooler `45 65 5`, chair `42 65 20`, wastebasket `41 65 18`, boxes `61 65 19`, debris `34 65 20` and `35 65 9` all sit in wall lanes with their frontage clear |
| Poster | Corridor poster at `41 65 6` is a two-block portrait, mounting back flush at Z7 |
| Escape room | The existing button, reversed sign and approach are untouched; the static exit sign sits at `C.x+5, 67, C.z+6` |

### Ticket 1 sign-off

- [ ] Solve the arrival → exit route normally; the existing exit button still works.
- [ ] Two consecutive patches show the right-angle motif (no straight sightline entry → far opening).
- [ ] All four `.mcstructure` patches resolve: `ceiling_failure` shows missing panel / exposed grid / dark cavity and the missing-tube split; `service_recess` wallpaper; `maintenance_nook` vent and plate with x3..4 clear; `dead_end_landmark` sign and boxes on the outer strips.
- [ ] Standard lighting shows every fixture state distinctly, `vhs_off` active.

---

## Ticket 2 · Library (`feat/v2-static-2-library`)

**Package.** `/tmp/Paradise-static-2.mcaddon`

**What shipped.** 37 library block definitions (46 emitted IDs): worn parquet, carpet runner,
dark wood paneling, water-damaged baseboard, cracked plaster, full/sparse/empty shelves and
endcaps, study carrel, tables, chairs, carts, ladder, index-card cabinet, book return, locked
document cabinet, desk lamp and the two-state aisle light. `lib_archive_desk` and
`lib_card_reader_terminal` stay deferred and their alcove stays empty.

**Velocity benchmark (20 families).** start `2026-11-22T13:58:26Z` (epoch 1795355906), end
`2026-11-22T13:58:27Z` (epoch 1795355907), elapsed **1 s**, 21 blocks / 89 files, 18 first-pass
accepted with 2 repairs (the cell-sized staged copies for `fallen_shelf` and
`tall_library_ladder`), **72,000 assets/hour** by `20 × 3600 / elapsed_seconds`.

### Viewpoints (visit-chunk coordinates; spawn is `1000v+0.5,65,0.5`)

```text
/execute in library:the_library run tp @s 1000.5 65 0.5
/execute in library:the_library run tp @s 2000.5 65 0.5
/execute in library:the_library run tp @s 2000.5 65 1000.5
/execute in library:the_library run tp @s 3000.5 65 1000.5
```

### Checks

| Check | Expectation |
| --- | --- |
| Crossroads | Floor Y64 with the runner on the `x=7..8 ∪ z=7..8` cross; full traverse stays two blocks wide |
| Shelves | Rows at x3 and x11 (variant 2 adds x2 and x6 for a three-block aisle); tiers at Y65/67/69, never above Y71; endcaps at z0 and z15 |
| Sampling | Full at local z mod 6 ∈ {0,1,4}, sparse at {2,3}, empty at 5 |
| Vanilla anchors | `minecraft:bookshelf` remains at `(3,65,2)`, `(11,65,2)` and `(11,65,9)` in the arrival chunk |
| Paneling | Dark wood band Y65–71, baseboard Y65, cracked plaster on one in eight non-door panels Y68–70 |
| Lighting | Two-block aisle lights above x4..5 and x10..11 at z4 and z11, mounted at Y72 with glowstone at Y73; lit anchors `(4,73,4)`, `(11,73,11)`, `(10,73,13)`; restricted room alternates unlit |
| Restricted bay | `[10..13,65..68,12..14]` empty behind a lit frame, flat plinth at Y64, approach `[11..12,65..67,9..11]` clear, RESTRICTED at `(11,69,10)` |
| Structures | `reading_alcove` carrel/table/lamp with x2..3 clear; `archive_frame` trim at (1,3,2)/(5,3,2) and plate at (3,5,2) with Z0..1 untouched; `central_monument` and `upper_balcony` accents |
| Travel | Yellow Halls → Library through the `yellow-archive` pad at anchor offset `(−10,0,0)` on standard settings |

### Ticket 2 sign-off

- [ ] Walk the full cross in both directions without a collision or dead end.
- [ ] Both light states read distinctly in standard light with `vhs_off`.
- [ ] The restricted alcove is empty and its frame reads as a sealed archive bay.
- [ ] Archive desk and card-reader terminal are absent; no read/card checks exist.

## Ticket 8 · Atmosphere, fog, particles & release prep (`feat/v2-static-8-atmosphere-release`)

**Artifact:** `/tmp/Paradise-static-8.mcaddon` (21,850,031 bytes, built with
`python3 tools/ai/cli.py package --output /tmp/Paradise-static-8.mcaddon --apply --json`).

**No new static geometry.** This stage is runtime atmosphere and release plumbing, so the
viewpoints below re-check existing rooms with the new fog/particle budget behaviour. Spawn is
`1000v+0.5,65,0.5` per dimension unless a dimension's own section in this file states otherwise.

### Viewpoints (one per dimension, in the arrival chunk)

```text
/execute in paradise:yellow_halls run tp @s 1000.5 65 0.5
/execute in library:the_library run tp @s 1000.5 65 0.5
/execute in paradise:flat_flower run tp @s 1000.5 65 0.5
/execute in paradise:endless_staircase run tp @s 1000.5 65 0.5
/execute in paradise:burning_highway run tp @s 1000.5 65 0.5
/execute in catacombs:catacomb_mazes run tp @s 1000.5 65 0.5
/execute in heaven:the_heaven run tp @s 1000.5 65 0.5
```

### Fog per dimension (component first, command fallback)

| Dimension ID | Fog identifier | Particle |
| --- | --- | --- |
| `paradise:yellow_halls` | `paradise:yellow_halls_fog` | `paradise:dust_mote` |
| `library:the_library` | `paradise:library_fog` | `paradise:dust_mote` |
| `paradise:flat_flower` | `paradise:flat_flower_fog` | `paradise:pollen_mote` |
| `paradise:endless_staircase` | `paradise:endless_staircase_fog` | `paradise:dust_mote` |
| `paradise:burning_highway` | `paradise:burning_highway_fog` | `paradise:ash_fleck` |
| `catacombs:catacomb_mazes` | `paradise:catacombs_fog` | `paradise:dust_mote` |
| `heaven:the_heaven` | `paradise:heaven_fog` | `paradise:celestial_mote` |

`applyFogLayer` now calls `player.fogSettings.remove(tag)` then `push(fogId, tag)` **first**; `/fog`
runs only when the component is missing or throws. `applyDimensionAtmosphere` still applies the
dimension layer first and `applyFogConfig` second, so the `paradise_config_fog_override` layer stays
on top of dimension fog on repeated loads and world reloads. No global `setStack` or `pop` is used,
so other packs' layers are untouched.

### Checks

| Check | Expectation |
| --- | --- |
| Fog component path | Walking between two dimensions swaps the fog with no stacking haze and no `/fog` command in the log (`getFogRuntimeStats().commandApplied` stays flat) |
| Fog fallback | On a runtime without `fogSettings`, the same transitions still apply fog through `/fog`; failures only increment `failures` |
| Config override | Toggling config fog off (`clear` layer) survives a dimension change and a world reload; turning it back on restores dimension fog beneath it |
| Global default fog | `addon/RP/biomes_client.json` keeps `minecraft:default` → `paradise:dark_fog`, and the file loads with no missing-identifier log line |
| Particles | All four (`ash_fleck`, `celestial_mote`, `dust_mote`, `pollen_mote`) resolve; the correct one spawns per dimension and none appear through walls at bay viewpoints |
| Low-tier budget | A Low memory tier device shows no ambient burst (burst 0) and no leaf pass; Mid and above still pulse |
| Y clamp | Ambient motes never appear below Y−63 or above Y318, including while standing at a `Y=−64` catacomb floor or a `Y=319` staircase top |
| Subpacks | `vhs_off` is last in `addon/RP/manifest.json` subpacks, so a fresh install lands on `vhs_off` and the VHS overlay stays off until opted in |

### Release gate evidence (local, headless)

```text
validate --json                exit 0, errors 0
audit --check dimensions       errors [], 7 canonical registration advisories only
preflight --json               exit 0, ok true
structures (7 dimensions)      exit 0, 28 structures, 0 unknown blocks / 0 invalid palettes
unit + JS regression           38 Python + 18 toolkit + 63 JS tests, all pass
package --dry-run / --apply    exit 0, 21,850,031-byte archive
```

### Ticket 8 sign-off

- [ ] Every one of the seven dimensions still enters with its own fog and particle, in standard lighting with `vhs_off`.
- [ ] Dimension changes never stack fog and never disturb another pack's layers.
- [ ] The config fog toggle keeps its override above dimension fog across a reload.
- [ ] `vhs_off` is the default subpack after installing the `.mcaddon` fresh.
- [ ] No particle or decorative write lands outside `Y = −64..319`.

## Ticket 3 · Flat Flower (`feat/v2-static-3-flat-flower`)

**Artifact:** `/tmp/Paradise-static-3.mcaddon` (21,938,978 bytes, built with
`python3 tools/ai/cli.py package --output /tmp/Paradise-static-3.mcaddon --apply --json`).

**Scene.** World drawing origin `(0,64,0)`. Ground is Y64, flowers/debris Y65, light anchors Y68.
`hashCoords(x,z,0x464c4154)%100` drives every zone roll. The authored scene spans X0..55 / Z2..53;
generic noise flowers still fill the rest of each 32×32 patch. `paintSceneColumn` paints the ground
and its zone flower, `placeSceneAnchors` places each landmark once from the patch that owns its
anchor, and the three route markers are static blocks at Y65.

### Viewpoints (spawn is `0.5,66,0.5`)

```text
/execute in paradise:flat_flower run tp @s 0.5 66 2.5
/execute in paradise:flat_flower run tp @s 4.5 66 10.5
/execute in paradise:flat_flower run tp @s 12.5 66 18.5
/execute in paradise:flat_flower run tp @s 32.5 66 34.5
/execute in paradise:flat_flower run tp @s 38.5 66 22.5
/execute in paradise:flat_flower run tp @s 18.5 66 43.5
/execute in paradise:flat_flower run tp @s 55.5 66 42.5
/execute in paradise:flat_flower run tp @s 8.5 66 48.5
/execute in paradise:flat_flower run tp @s 49.5 66 53.5
/execute in paradise:flat_flower run tp @s 7.5 66 20.5
/execute in paradise:flat_flower run tp @s 26.5 66 30.5
/execute in paradise:flat_flower run tp @s 49.5 66 29.5
/execute in paradise:flat_flower run tp @s 14.5 66 28.5
/execute in paradise:flat_flower run tp @s 21.5 66 29.5
/execute in paradise:flat_flower run tp @s 8.5 66 17.5
```

### Checks

| Check | Expectation |
| --- | --- |
| Footpaths | X0..1/Z2..4 → X0..5/Z3..4 → X4..5/Z5..15 → X4..17/Z14..15 → X16..17/Z16..23 read as one continuous worn footpath, two blocks wide with two blocks of headroom |
| Travel pad | The existing pad at X0/Z10 keeps at least three blocks of clear margin; no path or prop enters it |
| Gazebo | `ruined_gazebo` at `(12,65,18)` stands with four spruce posts at local `(1,1)`, `(10,1)`, `(1,10)`, `(10,10)`, low spruce rails on z1/z10 at x2..3 and x8..9, deepslate-tile roof caps at Y6..7 over x1..2 and x9..10, and both interior strips open |
| Lone tree | `lone_tree` at `(32,65,34)`, trunk and azalea canopy preserved, mossy-cobblestone ring on the perimeter with the two-wide west entrance at local z5..6, root footprint x4..6/z4..7 untouched |
| True marker | `paradise:ff_true_route_marker` at `(38,65,22)` with its open diamond head, at the end of the north branch |
| Decoys | `paradise:ff_decoy_marker_one` at `(18,65,43)` and `paradise:ff_decoy_marker_two` at `(55,65,42)`; all three posts read at the same height and differ only by head silhouette between 10 and 18 blocks |
| Garden remnants | Bench `(14,65,28)` facing +X, watering can `(13,65,29)`, gate posts at x8/x11 z17 with x9..10 open, broken fence at x7 and x11 z18, trellis `(21,65,29)` with planter `(22,65,30)`, empty beds x12..13 z26 |
| Dense plot | X3..11/Z20..39 near-70% dense clusters with bare-soil pockets |
| Sparse plot | X22..30/Z27..34 reads sparse (~25%) with scattered bent (~10%) and wilted (~5%) stems |
| Flower rows | X45..53 at z26/29/32 only, starting x45 every three blocks, empty soil between and a second ground band beyond z35 |
| Landmarks | `flower_ring` at `(8,65,48)` and `distant_marker` at `(49,65,53)` remain recognizable, supported, and the distant marker keeps no arrow |
| Structures | `structures --query flat_flower --palette --check-blocks` passes: gazebo palette gains spruce log/slab and deepslate tiles, tree ring gains mossy cobblestone, no air or void cells changed |

### Ticket 3 sign-off

- [ ] Walk all three branches end to end with no collision and no dead end.
- [ ] The three marker silhouettes read distinctly under desaturated rendering while the ground path centre stays clear.
- [ ] No active flower trigger, golden-flower check or consequence changed.
- [ ] Both original landmarks survive a patch rebuild at the same coordinates.
- [ ] Eight light anchors per ordinary patch are still present at Y68.

## Ticket 4 · Endless Staircase (`feat/v2-static-4-endless-staircase`)

**Artifact:** `/tmp/Paradise-static-4.mcaddon` (22,064,917 bytes, built with
`python3 tools/ai/cli.py package --output /tmp/Paradise-static-4.mcaddon --apply --json`).

**Envelope.** Scene starts in the per-player lane at `X = L = getLaneOffsetForPlayer(id)` (first player
`L=1000`) with treads at `y = 64 + z`, `z` ascending. Both walk columns `L−1..L` share the row and the
slice lifecycle. The primary guard is `L+1`, the shaft void is `L+2..L+7`, the remote ledge is
`L+8..L+10`. Rows above `z=255` (`y>319`) are no longer written.

### Viewpoints (lane 1000)

```text
/execute in paradise:endless_staircase run tp @s 1000.5 66 0.5
/execute in paradise:endless_staircase run tp @s 1000.5 78 12.5
/execute in paradise:endless_staircase run tp @s 1000.5 90 24.5
/execute in paradise:endless_staircase run tp @s 1000.5 162 96.5
/execute in paradise:endless_staircase run tp @s 1010.5 165 96.5
/execute in paradise:endless_staircase run tp @s 1000.5 258 192.5
/execute in paradise:endless_staircase run tp @s 1008.5 260 192.5
/execute in paradise:endless_staircase run tp @s 1000.5 322 255.5
/execute in paradise:endless_staircase run tp @s 1000.5 66 -28.5
```

### Checks

| Check | Expectation |
| --- | --- |
| Paired treads | Every row `z≥0` has a walkable tread at both `L` and `L−1`; climbing either column keeps the same rise and headroom |
| Guard | Continuous `paradise:es_straight_railing` at `L+1` with end posts every fourth row; the guard is never broken or removed |
| Chipped rows | Every `z%11=7` leans chipped tread stock against the `L−3` wall; the walking profile stays continuous |
| Landings | At each `k=floor(z/12)`: scuffed tiles on `L−5..L−3` at `y` and `z=t..t+1`, number plate at `(L−5,y+2,t+1)`, caged lamp at `(L−3,y+2,t+1)`, step light at `(L+1,y,t−1)` |
| Lamp states | k%4 0/1 normal (11), 2 red (7), 3 dead (0); the dead station still reads next to a lit pool and the small step light at emission 6 |
| Plates | k<4 numbered, 4..7 peeling, 8..11 blank, k≥12 repeated |
| Signs and doors | Direction signs on every third landing at `(L−3,y+2,t−2)`; service doors on the thirds alternate chained and emergency and stay at `L−4` or further back; hatches at `L−4` |
| Bridge | `distant_bridge` appears only at `z=96` and `z=192`, east of the void at `X≥L+10`, never touching the walk columns and never at the old 24-step row `z=288` |
| Remote ledge | Grating, broken grating, bent rail, broken railing gap and hanging cables live only at `L+8..L+10` |
| Ceiling clamp | No décor or tread is written for `z>255`; decoration stops cleanly and the exit at `z=−28` keeps its full clearance |
| Cleanup | Walking 48 steps and back removes both tread columns and all fittings behind the cleanup bound with no remnant collision |

### Ticket 4 sign-off

- [ ] Ascend 48 steps through at least four authored 12-step phases without a gap or collision.
- [ ] The bridge at `z=96` is visible from the walk but unreachable and unsupported by the treads.
- [ ] Restart and clear/rebuild with two players in separate lanes leaves each lane intact.
- [ ] The existing exit at `z=−28` still works and the fall threshold behaviour is unchanged.

## Ticket 5 · Catacombs (`feat/v2-static-5-catacombs`)

**Artifact:** `/tmp/Paradise-static-5.mcaddon` (see `package --apply` byte count in the PR).

**Dress.** Core `(0,64,0)`, cell base `B=(5cx,64,5cz)`, interior `B+1..3`, floor Y64, open Y65..68,
ceiling Y69. Walls use `wallBlock` (76% clean, 14% cracked, 10% damp); floors use `floorBlock`
(84% tiles, 12% uneven, 4% standing water), and the cell centre stays the functional slot. Lights
cycle lit 9 / unlit 0 / sconce 10 / rusted cage 8 by cell index. Burial objects sit behind a closed
wall only in dead ends. The sealed doorway is resolved by `selectJunction` and installed as an
optical plane W(1,0,65..67), clue W(0,0,66), sconce W(2,0,67), warning W(0,0,67) with flat floor
W(1..2,0,64) and approach W(1,1,65)/W(2,1,65) cleared. Both wall layers and the adjacent cell side
stay solid; nothing triggers the doorway.

### Viewpoints (spawn chunk at `1000v+0.5,65,0.5`)

```text
/execute in catacombs:catacomb_mazes run tp @s 1000.5 65 0.5
/execute in catacombs:catacomb_mazes run tp @s 1005.5 65 5.5
/execute in catacombs:catacomb_mazes run tp @s 1010.5 65 10.5
/execute in catacombs:catacomb_mazes run tp @s 1015.5 65 15.5
/execute in catacombs:catacomb_mazes run tp @s 1020.5 65 20.5
```

### Checks

| Check | Expectation |
| --- | --- |
| Surfaces | Clean masonry dominates with occasional cracked and damp patches; damp only pools near the floor line |
| Floors | Uneven tiles and standing water appear as isolated patches, never across a whole cell |
| Lights | All four states appear: lit cluster (9), unlit cluster (0), wall sconce (10), rusted cage (8); a dead station still reads next to a lit neighbour |
| Burial | Bone shelves, coffin boards, sarcophagi, urns and niches appear only behind closed walls or on the outer lane of dead ends |
| Arches | Straight and low arches sit overhead at Y68 with supports on the wall plane, never across a portal mouth |
| Sealed junction | A sealed stone doorway with a cracked clue panel, sconce and warning reads as a closed blocking; the two approach cells are clear and both wall layers plus the adjacent cell side remain solid |
| Reserved future opening | W(1..2,0,65..67) and the adjacent side W(1..2,−1,65..67) are backed solid; the flat floor W(1..2,0,64) is present |
| Protected systems | Exit door lock, timers, maze seeds and shortcut behaviour are unchanged; no shortcut script trips the doorway |
| Structures | `tomb_shrine` and `ossuary_panel` recessed planes, `collapsed_crypt` and `memorial_chamber` cleared cores; no functional slot or explicit light removed |

### Ticket 5 sign-off

- [ ] Walk a full corridor loop; every turned corner shows dressed wall surfaces and no floating prop.
- [ ] A dead end shows one burial object behind a closed wall with the middle lane clear.
- [ ] The sealed doorway reads closed from both sides and its clue panel is legible.
- [ ] Chest/loot/light positions and the exit lock behave exactly as before.

## Ticket 6 · Burning Highway (`feat/v2-static-6-burning-highway`)

**Artifact:** `/tmp/Paradise-static-6.mcaddon` (22,970,824 bytes, built with
`python3 tools/ai/cli.py package --output /tmp/Paradise-static-6.mcaddon --apply --json`).

**Envelope.** Road `X=L−3..L+3` at Y64, lava Y63, walls `X=L±4` to Y67, ceiling Y68..70. Overlays are
one block high at Y65 and only replace air. `buildServiceDetour` stays dormant. Ribs skip Z94..128 and
stop before the finish area. The wreck cluster sits at `W=(L+9,64,min(D−30,286+((seed>>>10)%23)))`.

### Viewpoints (lane 2000, live D=300 for this seed family)

```text
/execute in paradise:burning_highway run tp @s 2000.5 66 4.5
/execute in paradise:burning_highway run tp @s 2000.5 66 20.5
/execute in paradise:burning_highway run tp @s 2000.5 66 97.5
/execute in paradise:burning_highway run tp @s 2002.5 66 105.5
/execute in paradise:burning_highway run tp @s 2000.5 66 110.5
/execute in paradise:burning_highway run tp @s 2000.5 66 120.5
/execute in paradise:burning_highway run tp @s 2001.5 66 125.5
/execute in paradise:burning_highway run tp @s 1999.5 66 138.5
/execute in paradise:burning_highway run tp @s 2009.5 66 290.5
```

### Checks

| Check | Expectation |
| --- | --- |
| Lane line | Dashed stripe on X−2 only where z%8 is 0..3, between Z11 and D−25 |
| Shoulders | Outer stripes on X−3 and X3 in the same window; turnout shoulder stays at X3 |
| Wear | Skids only at X−1/Z136..141, cracks at X3 where z%17=0, heat damage at X−3 where z%23=0 |
| Turnout | Z96..127 plain asphalt, X−2..2 clear at both ends, divider on X0 alternating clean 99..105, damaged 106..107, clean 108..117, bent guardrail 118..122, end cap 123..124, merge chevron at (L+1,65,125) |
| Shelter | Turnout geometry at X3/Y65..67/Z105..116 with roof support at X3/Y67, X1..2 clear through Y65..66 |
| Ribs | Tunnel ribs at Z48,176,304 only (`48+64n`, skipping the turnout), bearing columns intact, clear opening x2..8 at y1..3, signs at local (2,5,1)/(8,5,1) |
| Wreck | Four shell segments in `wreck_cluster` cells (2,1,2),(3,1,2),(2,1,3),(3,1,3) with detached wheel (1,1,3), broken bumper (4,1,3), loose door (5,1,2), scrap (6,1,4); walking strips X−3..−1 clear |
| Overpass and lavafall | Overpass deck weathered off-road at X≥L+10; lavafall crust on its perimeter only, lava channel preserved |
| Hazards | Lava, collapse, geyser and chase behaviour unchanged; overlays never sit above a gap and clear with their row |
| Finish | Z≥D−24 stays free of new props; both routes rejoin at Y64 |

### Ticket 6 sign-off

- [ ] Run the lane at D=260, 380 and 400; no overlay floats over lava after a collapse.
- [ ] Shelter camping follows baseline lava/collapse behaviour.
- [ ] `buildServiceDetour` never runs and the main road is never burned by it.
- [ ] The phone box and emergency exit boards stay static and unpowered.

## Ticket 7 · Heaven (`feat/v2-static-7-heaven`)

**Artifact:** `/tmp/Paradise-static-7.mcaddon` (23,577,740 bytes, built with
`python3 tools/ai/cli.py package --output /tmp/Paradise-static-7.mcaddon --apply --json`).

**Dress.** 113 registered blocks across 36 families; the three seal families stay deferred and
unregistered. `heaven_scene.js` stages the clean rest station `R` at the spawn anchor and the disturbed
twin `R'` nine blocks east, exit frames at ±4, pool edging with a two-wide north opening, and the
temple dais reserve `[10..13,3..6,10..13]`. `hv_dark_tile_seams_calcite_brick_seams` uses an exact copy
of `V/quartz_bricks.png` because the calcite tile is Preview-only.

### Viewpoints (rest anchor near spawn)

```text
/execute in heaven:the_heaven run tp @s 1000.5 66 105.5
/execute in heaven:the_heaven run tp @s 1009.5 66 105.5
/execute in heaven:the_heaven run tp @s 996.5 66 102.5
/execute in heaven:the_heaven run tp @s 1000.5 66 87.5
/execute in heaven:the_heaven run tp @s 1010.5 66 22.5
/execute in heaven:the_heaven run tp @s 1012.5 69 12.5
```

### Checks

| Check | Expectation |
| --- | --- |
| Rest pair | `R` reads clean and intact; `R'` nine blocks east reads disturbed with footprints, a damaged bench, lamp and sign; both keep the bed, chest and approach slots |
| Exit frames | `hv_open_exit_frame` west and `hv_final_door_frame` east of the arrival pad, both static and unpowered |
| Pool | Garden edging wraps the rim with the two-wide north pedestrian opening and planters on the four corners; cyan glass interior untouched |
| Dais reserve | `[10..13,3..6,10..13]` inside the temple stays empty; no seal pedestal, face or floor inlay is registered or placed |
| Materials | `hv_dark_tile_seams_calcite_brick_seams` reads as quartz bricks (stable substitute); other seams use their pinned sources |
| Structure patches | `reflection_pool` rim at Y0, `celestial_arch` top ring, `distant_temple` floor; colonnade had no perimeter solids and is unchanged |
| Gameplay | Rest chest and bed behaviour unchanged; no exit trigger or seal logic added |

### Ticket 7 sign-off

- [ ] Both rest stations read distinctly from one approach in standard light with `vhs_off`.
- [ ] The pool edging never blocks the north walkway.
- [ ] The temple dais is empty and its reserve is untouched.
- [ ] No deferred seal block appears anywhere in the world.
