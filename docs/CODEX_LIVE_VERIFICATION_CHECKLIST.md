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
