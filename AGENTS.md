# Paradise.exe development

## Scope and sources

- Start with the [renovation tracker](docs/IMPLEMENTATION_TODO.md) and use the [developer toolkit](AI_TOOLS.md). Work on one dimension at a time, in tracker order. Retrieve only its section and applicable shared constraints from the [archived design plan](docs/archive/GLM_FLASH_7DIM_MASTER_PLAN.md). Use the archive as a reference for design requirements, asset inventory, technical constraints, and reservations. This file and the live tracker govern QA setup, implementation order, verification, and publication authorization. Record any proposed substitutions or deferrals with their reason and disposition.
- Resolve relevant local skills with `mcptoon skills resolve "<task>" --k 5`. For code work, activate the project in Serena when available, read its initial instructions, and use scoped symbols and references. Fall back to targeted source searches or toolkit `inspect`, `slice`, `refs`, and `impact`. Delegate only independent work such as asset prep, reference research, review, regression testing, or runtime evidence analysis. Give each agent distinct file and subsystem ownership.
- Keep changes in the active dimension and preserve existing entry, exits, hazards, entities, horror systems, player state, persistence, and functional areas. Preserve registered block and structure IDs, source models, geometry exports, textures, materials, and original vanilla pixel provenance. Keep decor passive and add gameplay or monsters only under a separate task. Commit, push, merge, and open PRs only with explicit authorization.
- Packs live at `addon/BP` and `addon/RP`. Preserve Bedrock 1.26.50 compatibility, both manifest floors, the existing `@minecraft/server` and `@minecraft/server-ui` beta pins in the BP manifest and `package.json`, and the legal occupied Y range −64 through 319. Keep these seven dimension IDs:

  | Dimension | ID |
  | --- | --- |
  | Yellow Halls | `paradise:yellow_halls` |
  | Library | `library:the_library` |
  | Flat Flower | `paradise:flat_flower` |
  | Endless Staircase | `paradise:endless_staircase` |
  | Catacombs | `catacombs:catacomb_mazes` |
  | Burning Highway | `paradise:burning_highway` |
  | Heaven | `heaven:the_heaven` |

## Bedrock Live MCP

1. Discover the tools and input schemas exposed by the installed [Bedrock Live MCP](https://github.com/RedEagleStudios/bedrock-mcp). Check the running Minecraft build, active local world identity, installed BP/RP UUIDs and versions, world pack selection, and automation connection. Verify that the installed files match the development build and review content logs for script startup. Re-probe capabilities on resume before relying on historical results.
2. Reuse a verified disposable QA world with Cheats, Beta APIs, the correct Paradise packs, standard non-PBR lighting, and `vhs_off`. When necessary, create a disposable QA world with Cheats and Beta APIs enabled and activate both project packs. Enable further experiments only for a specific technical need and record it. Keep runtime changes confined to disposable QA worlds.
3. Prefer direct MCP operations for world/pack controls, screenshots, movement, block/structure inspection, content logs, commands, and profiling where supported. Check current command syntax. Use MCP screenshots and UI inspection for setup only where direct operations are unavailable. Reload existing development packs in the verified world where supported, then confirm the expected changes and log deltas. Verify optional Bridge or GameTest capabilities before relying on them.
4. Investigate the specific error after a failed operation. Retry when the inputs, state, or evidence changes. Record the current failure and next actionable step. Report only observed capabilities and runtime results.

## Minecraft Creator Tools

- Use Mojang’s Minecraft Creator Tools for scoped structure authoring, model and structure previews, and supplementary Bedrock pack diagnostics. Discover the current Creator Tools MCP schemas or use the `mct` CLI. The source checkout is the sibling folder `../minecraft-creator-tools-main`. See [setup and safe pack inputs](AI_TOOLS.md#minecraft-creator-tools). Stage authoring output in a scratch project and review it before bringing it into Paradise's packs. Use Bedrock Live MCP for playable verification and acceptance.

## Prototype before generation

1. Inspect the existing dimension in Minecraft and capture a baseline. Establish its architectural direction from that walk-through and the relevant archived design requirements.
2. Build one representative playable prototype. Capture and inspect in-game screenshots and walk the route. Correct issues with architecture, lighting, geometry, collision, and layout. Obtain explicit user approval of the prototype before expanding the design or integrating it into procedural generation.
3. Prefer authored modular `.mcstructure` assemblies where appropriate for corridors, junctions, rooms, supports, staircase stations, landmarks, and large decorative assemblies. Reuse registered blocks, textures, and custom models. Connect and vary modules using the dimension's own layout rules and preserve its gameplay routes. Verify the complete generated dimension in-game after integration.

## Generation and verification

- Reuse the visual job queue, lifecycle helpers, reservations, and deterministic planners. Budget work over ticks, keep required chunks loaded for pending writes, recheck reservations before writes, cancel stale jobs, and release jobs and ticking areas on completion or failure. Verify whole-asset and structure placement results. Distinguish required failures from intentional skips and optional decoration. Recover failed required writes before marking a region generated.
- Use focused regression tests during edits and relevant validators after meaningful changes. At integration checkpoints and before dimension acceptance, run the full applicable suite, including standard `preflight` and repository regressions. Preflight already runs `validate` and reports the V2 audit. Review other audit findings while retaining the intentional beta pins. For asset integration use toolkit `scaffold` on a scoped batch and review dry-run output before apply.
- Apply the tracker's [acceptance criteria](docs/IMPLEMENTATION_TODO.md#acceptance-evidence) using live evidence and regression results. Update the tracker after meaningful milestones with concise evidence and any current blocker.
