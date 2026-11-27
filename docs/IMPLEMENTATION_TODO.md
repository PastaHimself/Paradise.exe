# Paradise.exe Resurrection — Persistent Implementation TODO

**Project root:** `/home/pasta/Downloads/paradise.exe reserection/Paradise.exe`

**Selected project directory:** `/paradise.exe-reserection`

**Authoritative specification:** `docs/GLM_FLASH_7DIM_MASTER_PLAN.md`

> **Never treat this TODO as a replacement for the master plan.** The master plan is the source of truth for implementation details, ordering, coordinates, asset ledgers, dependencies, and acceptance criteria. Re-read the relevant ticket in the master plan before starting or resuming it. This project has seven dimensions plus Ticket 8 for cross-dimension integration. Completing Yellow Halls does not complete the project.

## Permanent continuation rules

- [ ] At the start of every new or resumed work session, read this file, `AGENTS.md`, `AI_TOOLS.md`, and the relevant sections of `docs/GLM_FLASH_7DIM_MASTER_PLAN.md`.
- [ ] Before editing a ticket, read its entire master-plan section, its entry dependencies, asset/structure ledgers, command gates, and final **Pass** criteria.
- [ ] Follow the exact implementation order: **Yellow Halls → Library → Flat Flower → Endless Staircase → Catacombs → Burning Highway → Heaven → cross-dimension integration**.
- [ ] Inspect `git status --short`, `git diff --stat`, and `git diff --check` before editing. Preserve all existing dirty, untracked, and deleted work; never reset, stash, overwrite, or discard it without explicit authorization.
- [ ] Reconcile existing implementation and tests before adding code. A modified file is not proof that its ticket is complete; an agent report is not acceptance evidence until checked against the current tree.
- [ ] Keep existing gameplay, dimension IDs, travel pads, structures, timers, triggers, exits, and lifecycle behavior intact unless the master plan explicitly authorizes a change.
- [ ] Add deterministic regression tests for code changes. Static tests do not establish that Bedrock runtime behavior works in-game.
- [ ] Keep runtime, multiplayer, lighting, fog, particle, and mobile gates open until actual disposable-world/device evidence is recorded.
- [ ] Use the repository toolkit described by `AI_TOOLS.md`; run its write operations with `--dry-run` and inspect the planned changes before `--apply`.
- [ ] Do not commit, merge, push, open/publish PRs, or publish releases. The master plan contains a PR/merge workflow, but the current user instruction explicitly withholds that authorization.
- [ ] If this tracker and the master plan disagree, follow the master plan and correct this tracker. Never silently omit a dimension or Ticket 8.

## Overall sequence and status

| Order | Work item | Status | Completion rule |
|---:|---|---|---|
| 0 | Shared kits / Pre-Ticket 0 gate | Geometry migration passed; runtime blocked | 67 equivalent models migrated with established IDs preserved; clean-world display/startup and proposed-name reconciliation remain open. |
| 1 | Yellow Halls — `paradise:yellow_halls` | Static regression passed; runtime blocked | Ticket 1's full static and live acceptance criteria pass; unchanged entry/exit and patch joins remain functional. |
| 2 | Library — `library:the_library` | Static implementation advanced; runtime blocked | Ticket 2 passes, including the 20-asset velocity gate and Yellow Halls → Library travel. |
| 3 | Flat Flower — `paradise:flat_flower` | Static implementation advanced; runtime blocked | Ticket 3 passes; both original landmarks and existing flower gameplay remain intact. |
| 4 | Endless Staircase — `paradise:endless_staircase` | Static implementation advanced; runtime blocked | Ticket 4 passes, including paired tread lifecycle, upper-height safety, cleanup, and the original exit. |
| 5 | Catacombs — `catacombs:catacomb_mazes` | Static implementation advanced; runtime blocked | Ticket 5 passes across distinct generated seeds with original links and gameplay reachability intact. |
| 6 | Burning Highway — `paradise:burning_highway` | Static implementation advanced; runtime blocked | Ticket 6 passes at all required finish distances with both routes, hazards, collapse, and vehicle segmentation intact. |
| 7 | Heaven — `heaven:the_heaven` | Static implementation advanced; runtime blocked | Ticket 7 passes with both static rest displays, pool, and temple; existing rest gameplay remains unchanged. |
| 8 | Cross-dimension atmosphere, fog, particles, and mobile verification | Static implementation advanced; runtime blocked | Ticket 8 passes across all seven dimensions after Tickets 1–7. This is integration work, not an eighth dimension. |
| 9 | Final static/runtime audit and evidence | Static checkpoint verified; final acceptance open | Full tests, typecheck, CLI validation, dimension audit, standard preflight, paired-pack checks, and disposable-world/device evidence are recorded. |

## Current verified snapshot — 2026-11-26

### Yellow Halls

- [x] Latest focused patch-job and pad-reservation suite: **15/15 passed**, exit 0. Full `npm test`: **213/213 passed**, exit 0. `npm run typecheck`: exit 0. Python Yellow Halls structure-mask tests: **3/3 passed**, exit 0.
- [x] Reproduced three asynchronous patch-job failures against the old implementation; replaced mutable in-flight request merging with a serialized per-patch tail and separate queued build options. Five executable orchestration tests now cover pre-start merging, late force requests, concurrent recovery owners, retry after failure, patch isolation and owner inclusion lifetime.
- [x] Reproduced a late connection-pad overwrite during deferred module placement; refresh reservations before final special-site writes. Two executable paint/ticking-area tests cover late pad preservation and ticking-area cleanup on placement failure.
- [x] Latest CLI validation and standard preflight exit 0, each with zero errors and eight existing audio warnings. Dimension audit exit 1, seven canonical registration advisories and zero errors. Tracked diff whitespace check exit 0.
- [ ] Re-run the gates after further changes. Live escape-room recovery, disconnect interleavings, actual block-light sampling and ticking-area ownership still require Bedrock evidence; executable tests use a controlled mock dimension and real orchestration source, not a game client.
- [ ] Complete the full Ticket 1 in-world acceptance: repeated turns, all eight bays, two-wide flood-fill, seed repeatability, unchanged exit-button behavior, ARCHIVE reserved/empty volume, and every required fixture/light/sign state in standard lighting.

The recovered worker-4 review raised floor-prop placement, eight-bay portal coverage, wallpaper output measurement, and escape-placement races. The current tree contains tests for floor props, bays, and measured wallpaper output; recheck the review against current HEAD rather than blindly reapplying old findings.

### Pre-Ticket 0 — independent shared-kit review (2026-11-26)

- [x] Worker-5 read-only audit reported 21 shared families, 90 registered blocks, 1,014 provenance records with exact RGBA/SHA-256 matches, four native alphabet substitutions and six deferred rows. Zero missing indexed geometry, duplicate identifiers or interactive shared definitions; both engine floors 1.26.50. These are worker-reported static results, not client evidence.
- [ ] Reconcile proposed ledger names with existing registered prefixes `sh_sign_backing`, `sh_sign_post`, `sh_hanging_sign`, `sh_fixture` (planned `sh_blank_sign_backing`, `sh_freestanding_sign_post`, `sh_hanging_directional_sign`, `sh_reusable_fixture_texture_states`). Preserve existing runtime block IDs and worlds; do not rename destructively.
- [x] Implemented guarded `geometry-reuse`: 65 identical shared duplicates plus 2 exact Yellow Halls fixture matches removed (90 → 23 shared models). 67 existing BP definitions redirected, 733 index rows updated, no registered block ID changed. Dry-run/apply plan SHA-256 `2633514b8ae5c02eea5e3ed39888f163166151cf8b7cbbedd5bd2fcea60d46fd`; repeated dry-run reports zero changes. Six migration regressions pass, including rollback, stale-owner rejection, different shapes and unexpected reference rejection.
- [ ] Original `/tmp/paradise-static-0.json` is unavailable. Reconstruct only from reviewed current registration/provenance evidence; do not blindly reapply the original shared batch.
- [ ] Shared platform display and startup in a fresh disposable QA world with Cheats and the Beta APIs experiment enabled remain unverified.

### Existing work that must be reconciled, not discarded

- The worktree was already dirty on branch `main`, HEAD `d33b8d46`. It includes changes in Yellow Halls, Library, Flat Flower, Catacombs, Burning Highway, atmosphere, visual jobs, tests, and developer tooling. The master plan itself is modified. Inspect its diff before touching it.
- Tracked changes included `AGENTS.md`, `addon/BP/scripts/{burning_highway,catacombs,flat_flower,library,paradise_dimension_atmosphere,paradise_visual_jobs,yellow_halls,yellow_halls_decor,yellow_halls_decor_model}.js`, `docs/GLM_FLASH_7DIM_MASTER_PLAN.md`, tests, and toolkit files.
- Untracked work included dimension lifecycle modules, particle dispatch, single-flight and visual-job queue modules, Yellow Halls lifecycle/pad-reservation modules, and related regression tests. `docs/CODEX_LIVE_VERIFICATION_CHECKLIST.md` was already deleted. Preserve all of this state.
- Worker-5's read-only Library review reported mismatches to reconcile around shelf placement, lighting, the restricted archive, structure masks, and chunk-generation scheduling. Compare every finding with Ticket 2 and the current `library.js`/tests before editing.
- A prior agent handoff reported Catacombs shared-maze concurrency and verified-exit improvements with five tests. Verify the actual diff and tests before relying on that report.
- The latest Yellow Halls static test result is not a runtime qualification result.

### Runtime blockers to re-probe

- Re-probed 2026-11-26: QA world `Paradise Recovery QA 20261126` (`n0h5VBQTODI=`) exists with BP 1.2.14 and RP 1.0.15. `worlds_list` confirms the QA world is available, but `game_status` does not identify which listed world is currently open; the active world identity therefore remains unverified. Game is running in-world, the player is in the Overworld, and the native UI/frame inspection shows an inactivity overlay: “You've been away for a bit. Press any button to jump back into the game.” WebSocket is disconnected and Bridge is inactive. The file content log contains **two** scripting errors: `Plugin [Paradise.exe BP - 1.2.14] - requesting dependency on beta APIs [@minecraft/server - 2.11.0-beta], but the Beta APIs experiment is not enabled.` No world was opened, left, reloaded or written during that historical probe. The user has since authorized creating a fresh disposable QA world with Cheats and the Beta APIs experiment enabled for MCP runtime testing. Preserve beta pins and do not alter this existing world or the user's main world.
- The Beta APIs-disabled startup failure is explained by the experiment being disabled. For the next runtime attempt, create a new 1.26.50 disposable world through the MCP-controlled Minecraft UI, turn Cheats ON, enable Beta APIs, select `vhs_off`, and verify the world and pack versions. Enable other experiments only when a specific API or test requires them. This setup does not authorize migrating the seven chat subscriptions or changing API pins.
- Current `AGENTS.md` reports that live MCP world discovery returned no worlds, opening `ReworkV2` failed, and UI-tree/frame capture was unavailable. A previous handoff had a disposable QA world open; re-probe the live state rather than assuming either snapshot is still current.
- BDS was previously unavailable because `/home/pasta/.local/share/bedrock-server/current/bedrock_server` did not exist. Do not claim BDS qualification unless a valid server is subsequently installed and tested.
- The Bridge pack was previously inactive. Do not claim Bridge-only inspection or timing capabilities without confirming it is active in a disposable QA world.
- If a runtime gate cannot be performed, record the exact blocker and leave that gate open. Do not convert a static pass into an in-game pass.

### Additional reference-check evidence

- Earlier paired BP/RP MCP check found 20 errors. Repaired the genuinely missing `textures/blocks/smoker_front_on_1` alias to the existing native `smoker_front_on` PNG/flipbook, verified against installed 1.26.52.3.
- Final post-repair MCP check: 2,096 files scanned, 19 raw findings (five inherited animation references and fourteen candle-cake aliases). Re-verified all five animation IDs in Mojang `bedrock-samples` at stable 1.26.50.4 commit `46ba6ea985fb5a92d79a9419198f10dda14c199d`: camel line 38, cat line 65, fox line 24, sheep lines 20 and 24. Re-verified all fourteen `textures/blocks/cake` aliases in the same commit's `resource_pack/textures/terrain_texture.json` at lines 3277–3316. These are exact vanilla references; preserve them rather than inventing custom files. Actual client resolution remains unverified. `containsExactReference()` now enforces both leading and trailing token boundaries, with 7/7 focused regression tests passing. The Blockception LSP server is absent from the local checkout, so its live audit could not be rerun; the MCP `pack_check` still reports the 19 raw vanilla findings. Obsolete smoker alias remains removed from the fallback allowlist.

## Integrated implementation checkpoint — 2026-11-26

This is a static implementation checkpoint, **not acceptance of Tickets 0–8**. The prior all-experiments-off QA gate is superseded by the user's instruction to use a fresh disposable world with Cheats and Beta APIs enabled for MCP testing. The ordered live Pass gates remain open until that world is created and tested. No existing-world or main-world setting, API pin, dimension ID, commit, push or publication changed.

| Ticket | Implemented and verified statically | Remaining evidence / known deviations |
|---|---|---|
| 0 | Guarded geometry reuse and exact reference-alias repair; old block IDs and source exports retained. | Proposed ledger names mapped to existing shortened IDs, not destructively renamed. Shared display and vanilla reference resolution need client evidence. |
| 1 | Previous single-flight, pad scan/recovery, deferred placement, eight-bay/floor/wear regressions retained. Corrected structure-mask reader to Bedrock Z-fastest order; 3/3 tests pass. | Actual light, escape, and Yellow Halls-to-Library travel gates blocked. |
| 2 | Library generator, public cross, shelves, lighting, archive reservation, deferred structure placement and lifecycle; corrected archive/alcove/balcony NBT masks in Z-fastest order. Focused 32/32 tests passed; all 4 library structures valid. | Fallen shelf and tall ladder runtime segmentation still outstanding. 20-family timed static inventory is not first-production velocity or client acceptance. |
| 3 | Authored routes, flower branches, marker pairs, original landmark support, pad protection, generation version guards and 8 ordinary light anchors. Six full-tile floor collisions restored through reviewed migration. Worker focused 27/27 tests passed. | Native tree perimeter conflicts with two authored cells at (32,65,36/37); preserved tree and two-wide X30..31 approach. West post (20,65,45) conflicts with two-wide route and was omitted; flagged roof/rail replacements not applied where they remove original support. Client checks open. |
| 4 | Two tread collision profiles restored; paired ascent, negative-Z exit, legal Y bound, western station landings, guarded row/scenery lifecycle and inverse NBT-mask cleanup, bridge offers at 96/192. | Safe straight rails used rather than unstaged sloped pieces; actual ascent, station/bridge support, repeat/restart and multiplayer clearance open. |
| 5 | Coordinate-keyed junction selection, closed-wall rotated segment placement, floor/wall/lighting dressing after carve, sealed-wall approach, shared-maze and exit lifecycle retained; cancel stale visual work and exclude functional rooms. | Clue uses alternate closed wall if authored pieces overlap; shallow south-wall modules only pending full-cell mask work. Exact clue/egress and two live seeds open. |
| 6 | Main and service routes, longitudinal divider, side-mounted signs/fittings, shoulder details, shelter roof, safe ends and post-collapse removal; original off-road wreck structure restored with four exact shell segments and detached parts in NBT. Await structure jobs while ticking area held. | Odd-length divider phase uses a native gray-concrete fallback; full scenery/overlay and sign-render review remains. Test D=260/380/400 and hazard behavior in client. |
| 7 | Static rest displays at S.x-20/Z2 and Z12, original gameplay rest/duplicate no longer overwritten by static pieces; fixed pool/temple placement after base chunks, ambient reservation guards; pool glass/corners and temple dais repaired in NBT. | Native quartz substitutions used for parts of temple/frame; complete precise decorative segments, rest footprint overlap review, garden/path clearance and runtime inertness remain. |
| 8 | Preserved API-first owned fog tags, reject unknown/invalid push result, malformed memory tiers fallback Low, skip clipped particle samples using live height range, unchanged ten-tick pulse and existing VHS preference. | Global biome fog kept pending mandatory A/B; actual height ranges, low-memory 120s, four-client, TPS and mobile/VHS gates open. |

### Library velocity evidence (worker-6)

Review started 2026-11-26T15:40:05Z (1795707605), final static implementation timestamp 15:55:49Z (1795708549), 944s elapsed. Existing source/atlas/ID inventory ran 15:51:10.836Z–15:51:10.910Z. This measures **static inventory only**: original production start, repair counts and actual renders are unavailable; 0 new families scaffolded in that timed inventory; valid production assets/hour and 20/20 acceptance cannot be claimed.

| Family (required order) | Static read seconds | Existing primary ID count |
|---|---:|---:|
| Full bookshelf | 0.002485 | 2 |
| Sparse shelf | 0.002435 | 2 |
| Empty shelf | 0.002995 | 2 |
| Shelf endcap | 0.003424 | 2 |
| Tall divider | 0.002938 | 4 |
| Fallen shelf | 0.002979 | 1 (unsegmented) |
| Dark wood paneling | 0.003561 | 1 |
| Worn parquet | 0.004312 | 1 |
| Carpet runner | 0.004644 | 1 |
| Cracked plaster | 0.005573 | 1 |
| Water-damaged baseboard | 0.003938 | 1 |
| Reading table | 0.004725 | 2 |
| Reading chair | 0.003442 | 1 |
| Study carrel | 0.003369 | 4 |
| Rolling book cart | 0.003487 | 2 |
| Tall library ladder | 0.003932 | 1 (unsegmented) |
| Index-card drawer cabinet | 0.003840 | 1 |
| Book return slot | 0.003723 | 1 |
| Locked document cabinet | 0.003756 | 2 |
| Desk lamp | 0.003967 | 2 |

### Reviewed repair transactions

- Flat Flower floors: first five plan `8d02b36c9891dd792aeaa0590498dae3bb5d32aa790eba5272d3316e0161f522`; bare flower patch plan `b36738b2685387ec5f454e68fc3e69ea7579e87edd87b650114bab760c1f3ae6`.
- Stair treads: plan `327df1f0fd2a2b7c2f2faf6f4c5247fb59197812d428f83dbd319439fb5802b4`; both IDs unchanged, collision now matches ascending two-box profile.
- Highway wreck and Heaven pool/temple NBT: plan `38d5a6f131bbf163e7c03fbc5b337d585e3baaa6c700b66a63f0d8d05f44006d`. All 3 applied; repeat dry-run unchanged; tests verify exact Z-fastest cells, palette states, secondary layers and idempotence.
- Integrated JS: 240/240 across 24 suites, exit 0; full Python toolkit discovery: 31/31, exit 0 (246.884 seconds). Typecheck, validate, standard preflight and diff check each exit 0 (28 structures, 0 validation errors, 8 established audio warnings). Dimension audit exit 1, seven advisory script-registered ID warnings and zero errors. Tested working tree based on HEAD `d33b8d46`; no new commit. No release gate is marked accepted from these static checks alone.

## Ticket 1 — Yellow Halls

Master-plan section: `docs/GLM_FLASH_7DIM_MASTER_PLAN.md`, lines 158–248.

- [ ] Preserve the existing spawn `(0,66,0)`, join/patch behavior, entry/escape ownership, exit button, and two-wide portals.
- [ ] Verify the recurring right-angle maze motif, protected turns, deterministic connectivity, 6% loop-edge policy, and flood-fill after accepted loops.
- [ ] Verify all eight authored bays, their signs/doors/hatch, portal-aware inward relocation, and the fixed ARCHIVE blind alcove reservation.
- [ ] Keep the breaker mount back plane and empty front volume reserved; register no breaker prop in this ticket.
- [ ] Verify wallpaper target and measured output ratios after rejected wear-roll remapping; floor wear, raised corners, ceiling failures, fixture variants, conduit, vents, and lighting match the ledger.
- [ ] Keep floor-prop frontage, arrival spawn buffer, exit approach, and all route columns clear.
- [ ] Preserve module structure sizes/masks; retry deterministic eligible cells when bays or escape sites reserve a candidate.
- [ ] Verify single-flight merging, forced follow-up rebuilds, multiple escape owners, disconnect cleanup, failed teleport recovery, queued placement guards, ticking-area ownership, and cancellation/error cleanup.
- [ ] Live pass: inspect two repeated turns and all eight bays, solve the unchanged exit normally, confirm ARCHIVE mount volume is empty, and capture two-block-path flood-fill plus seed-repeat evidence.

## Ticket 2 — Library

Master-plan section: `docs/GLM_FLASH_7DIM_MASTER_PLAN.md`, lines 249–326.

- [ ] Reconcile existing Library lifecycle work and worker-5 findings before changing implementation.
- [ ] Protect the full public cross in every chunk and the three-block aisle in the west room; correct shelf rows, tiers, endcaps, fallen shelf, and tall divider without closing travel lanes.
- [ ] Preserve the three vanilla bookshelf functional anchors used by the existing proximity check.
- [ ] Implement parquet/runner, dark wood, baseboards, cracked plaster, service fluorescent, aisle lights, desk lamp, and required minimum block-light levels.
- [ ] Implement the restricted bay's fixed gate, two passable columns, backing, plinth, empty archive/terminal reserve, sign, lit anchor, and clear approach. Do not add read/card checks or state.
- [ ] Reconcile structure masks, authored placements, and two-tick sliced chunk-generation scheduling against the plan; preserve teaching signs, riddle/chat handlers, question chest, and existing triggers.
- [ ] Complete the exact 20-asset production velocity measurement: timestamps, per-asset time, first-pass/repair counts, 20/20 accepted, zero unresolved content errors, exact registrations/reservations, and lit/low-power evidence.
- [ ] Live pass: Yellow Halls → Library through the existing `yellow-archive` pad on standard settings; separately verify the Yellow Halls exit still returns to the Overworld.

## Ticket 3 — Flat Flower

Master-plan section: `docs/GLM_FLASH_7DIM_MASTER_PLAN.md`, lines 327–402.

- [ ] Preserve the existing true/false golden-flower checks and consequences; static marker names must not become logic flags.
- [ ] Build the authored arrival → gazebo → lone-tree route while preserving the existing travel pad and required clearance.
- [ ] Keep all three branches walkable and visually distinguishable: one true north branch and two decoy silhouettes; keep the distant marker separate and un-arrowed.
- [ ] Preserve both original landmark structures and their supports, the flower ring, eight fixed light anchors per ordinary patch, and seeded/noise decoration outside the finite authored scene.
- [ ] Verify repeat rebuilds, deterministic off-axis paths, branch collision clearance, and no change to active flower triggers.

## Ticket 4 — Endless Staircase

Master-plan section: `docs/GLM_FLASH_7DIM_MASTER_PLAN.md`, lines 403–475.

- [ ] Preserve per-player lane spacing, ascent direction, thresholds/consequences, `generateExitRoute` / `placeExitStructure`, and original exit at z = −28.
- [ ] Add/maintain both walk treads as one lifecycle unit, two-block headroom, safe guard/support wall, and a clear lateral shaft.
- [ ] Enforce legal build height: no visual/tread writes above occupied Y319; move distant bridge offers to z96/z192 only, not the unsafe baseline z288.
- [ ] Add 12-step side landings without flattening the primary slope; verify station numbering, lamp state cycle, light anchors, service doors/hatches, and remote-ledge scenery.
- [ ] Preserve structure masks, per-slice placement caches, inverse cleanup, site reservations, and success-only cache updates across restart and multi-player lanes.
- [ ] Live pass: ascend 48 steps, inspect all authored 12-step phases and safe bridge Y, restart/clear/rebuild with two players, take the existing exit, and verify no rail gaps or residual collision.

## Ticket 5 — Catacombs

Master-plan section: `docs/GLM_FLASH_7DIM_MASTER_PLAN.md`, lines 476–545.

- [ ] Preserve exit-door lock, timer, maze-link/seed generation, shortcuts, start/exit/loot/chest/light functional footprints, and existing gameplay.
- [ ] Apply deterministic wall/floor wear, eligible wall dressing, lighting variants, and burial objects only in closed-wall/outer-lane positions; maintain two clear columns from every portal and opaque cover support.
- [ ] Add the static sealed shortcut-junction clue/warning/sconce and reserve the future opening coordinates while leaving both wall layers sealed in shipped generation.
- [ ] Do not wire a shortcut callback or open the future passage in this ticket. Record actual selected seed and world coordinates for QA-only sampling.
- [ ] Keep module count at or below six and prioritize the junction and reserved cells; preserve deterministic module selection and structure masks.
- [ ] Live pass: capture two distinct seeds, unchanged original links, two-block minimum egress, start/exit/loot reachability, torchlight clue/warning, and the resolved future opening with its sealed back intact.

## Ticket 6 — Burning Highway

Master-plan section: `docs/GLM_FLASH_7DIM_MASTER_PLAN.md`, lines 546–620.

- [ ] Preserve movement, collapse, geyser, chase, cross-dimension travel, baseline hazard floor types, safe spawn pad, and finish-area clearance. Leave legacy `buildServiceDetour` dormant.
- [ ] Build the fixed Z96–127 turnout within the logical lane: two clear routes (main and shelter), safe entries/merge, divider/guardrail phases, supported roof, and rejoin at comparable Y64.
- [ ] Preserve main-route and shelter collision clearance, lava/collapse semantics, and existing obstacles outside the turnout.
- [ ] Add source-faithful asphalt/lane/edge/skid/crack/heat/ash/soot/paint overlays without adding collision or narrowing the two walk lines; maintain three-block overhead clearance.
- [ ] Segment the wreck into all four prescribed structure cells, support it safely, place detached parts correctly, and keep the vehicle off both walking strips.
- [ ] Keep roadside structures outside route/collapse danger and verify texture provenance and normal/scorched sign readability.
- [ ] Live pass: inspect main/service routes at D=260, 380, and 400; both turnout ends; post-collapse clearance; spawn safety; all four wreck segments; and off-route roadside structures.

## Ticket 7 — Heaven

Master-plan section: `docs/GLM_FLASH_7DIM_MASTER_PLAN.md`, lines 621–712.

- [ ] Preserve old rest chest/bed/note, duplicate call behavior, trust consequences, void/entry/return, and teleport. Do not implement dynamic rest swapping.
- [ ] Add the two fixed clean/disturbed static rest displays and connecting paths while preserving the existing gameplay pad and READING ROOM pad; keep display frontage clear.
- [ ] Build the pool/garden while preserving cyan glass interior, corner supports, pedestrian openings, east/west routes, steps, bridge support, and two-block path headroom.
- [ ] Preserve the existing distant temple structure and support platform; add columns/capitals and peripheral paths; replace central gold with the flat pale dais and keep its future altar reserve empty.
- [ ] Keep the temple exit frame, blind-wall seal panel, open-but-inert frame, emblems, and fabric as static pieces. No emblem/door/altar callback or seal parts.
- [ ] Prevent ambient structure overwrites near the pool, temple, and rest pads; do not pre-generate decoration-only chunks outside the existing budget.
- [ ] Live pass: both rest layouts readable side by side, old rest interaction unchanged, pool/corners survive repeat generation, temple platform accessible, dais empty, all static pieces inert, and standard-light texture evidence recorded.

## Ticket 8 — Cross-dimension integration

Master-plan section: `docs/GLM_FLASH_7DIM_MASTER_PLAN.md`, lines 713–775. Start only after Tickets 1–7 pass.

- [ ] Verify all seven canonical dimension IDs and legal height envelope (−64 through 319; upper boundary 320 exclusive) against source, live handles, and sampled structures.
- [ ] Preserve existing once-per-pulse atmosphere schedule and one-shot RP emitters; no extra polling or new geometry/structure placements.
- [ ] Change unknown/unreadable/failing memory-tier fallback to Low (including non-finite values), preserve configured rates, cache per-player due ticks, and clean only owned entries on leave.
- [ ] Use `Player.fogSettings.remove(tag)` then `push(fogId, tag)` through deferred execution; preserve owned tags and config override priority. Use existing selector/entity-command fallback only when API is unavailable/fails; never pop another pack's layers or use global `setStack`.
- [ ] Add fog tests for API success/no command, unavailable API, remove/push exceptions, repeated entry, reload, other players' layers, and failed command result. Stats must distinguish API, fallback, and total failure.
- [ ] Confirm no global biome fog bleed into vanilla dimensions; remove the global default only if disposable-world A/B proves per-player fallback and vanilla restoration.
- [ ] Verify all four particle definitions and paths: dust, pollen, ash, celestial. Respect Low/SuperLow/unknown zero-spawn budget and Mid/High/SuperHigh burst/radius caps; clamp Y and avoid additional block queries/trace loops.
- [ ] Run the 120-second low-memory route with zero subsystem particle spawns; test Mid/High counts, four-client overlap, two-job cap, duplicate prevention, stale-job cleanup, and stable 20 TPS or record regression/call tree.
- [ ] Verify `vhs_off` is the default in a fresh 1.26.50 world on mobile and desktop; keep `vhs_on` manually selectable and preserve manifest V2 compatibility.
- [ ] Mobile pass: standard non-PBR lighting, render distance 6 chunks, fresh load, repeat visit, two-player overlap, readable cues, frame pacing, profile build time, and content-log deltas.

## Final validation checklist

- [x] Current checkpoint: `npm test` 240/240, exit 0; full Python toolkit tests 31/31, exit 0. Repeat after any further implementation.
- [x] Current checkpoint: `npm run typecheck`, exit 0.
- [x] Current checkpoint: `python3 tools/ai/cli.py validate --json`, exit 0.
- [x] Current checkpoint: `python3 tools/ai/cli.py audit --check dimensions --limit 50 --json`, exit 1 for the seven documented advisories, zero errors.
- [x] Current checkpoint: `python3 tools/ai/cli.py preflight --json`, exit 0 (standard preflight, without substituted options).
- [ ] Run paired BP/RP reference and structure checks from `addon/`; do not scan the repository root with bundled vanilla sample packs included and then attribute sample-only findings to Paradise.exe.
- [ ] Run `git diff --check`, review `git diff --stat`, inspect every changed/untracked/deleted path, and verify no unrelated files were lost.
- [ ] In disposable Bedrock worlds, verify both packs/scripts load and all seven dimensions, pads/travel, structures, gameplay, lighting, fog, particles, and mobile constraints. Record exact engine/device/world/settings and content-log deltas.
- [ ] Update this file and the master plan with evidence-based statuses only. Keep any blocked runtime gate visibly open.

## Per-ticket evidence to record

For every ticket, record the ticket ID, changed paths, dry-run/apply summaries, deterministic test names/results, root validation and standard preflight exit codes, dimension-audit findings, tested commit/head (without creating a commit), runtime world/seed/visit/lane/coordinates, reserved volumes, light/sign states, and unresolved dependencies. Report accepted, substituted, flagged, and deferred asset rows by exact ID. For Library, include the measured 20-asset throughput result. Do not report a ticket as accepted until its master-plan **Pass** evidence exists.
