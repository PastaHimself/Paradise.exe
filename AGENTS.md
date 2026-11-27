# Paradise.exe V2

## Repository Map

| Area | Repo-relative path |
| --- | --- |
| Behavior Pack (BP) | `addon/BP/` |
| Resource Pack (RP) | `addon/RP/` |
| Gameplay source and entry point | `addon/BP/scripts/`, entry `addon/BP/scripts/main.js`. Source is JavaScript with TypeScript checking configured in `tsconfig.json`. |
| Bedrock structures | `addon/BP/structures/paradise/`, with `.mcstructure` files in `burning_highway/`, `catacombs/`, `endless_staircase/`, `flat_flower/`, `heaven/`, `library/`, and `yellow_halls/`. |
| Runtime models, textures, and fogs | `addon/RP/models/`, `addon/RP/textures/`, and `addon/RP/fogs/` |
| VHS subpacks | `addon/RP/subpacks/vhs_off/` and `addon/RP/subpacks/vhs_on/` |
| Developer toolkit and reference | `tools/`, CLI at `tools/ai/cli.py`, command reference at `AI_TOOLS.md` |
| Décor workspace | `3d model *DECORATION*/paradise_exe_v2/`. Quote the path in shell commands because the asterisks are literal. |
| Décor exports and textures | Under the décor workspace, look in `yellow_halls/`, `library/`, `flat_flower/`, `endless_staircase/`, `burning_highway/`, `catacombs/`, `heaven/`, and `shared/`. Per-asset folders hold `.bbmodel` sources, applicable `.geo.json` exports, and PNG atlases or previews. |
| Décor index and supporting files | `3d model *DECORATION*/paradise_exe_v2/TODO.md` indexes assets and exports. The same directory contains `closed_projects.json`, `production_tools/`, and `references/`. |

The checkout uses the pack paths above. `README.md`, `AI_TOOLS.md`, `tsconfig.json`, and toolkit path constants still reference the former pack names. Check those assumptions if a command reports missing packs or no inputs. Keep any path migration within the task's scope.

## Tool-First Workflow

Before starting or resuming implementation, read `docs/IMPLEMENTATION_TODO.md` and the relevant complete ticket in `docs/GLM_FLASH_7DIM_MASTER_PLAN.md`. Maintain the tracker through all seven dimensions and Ticket 8; a partial static pass is not ticket acceptance.

1. Read `AI_TOOLS.md` before every code or asset task. Run its commands from the repository root and use the existing CLI in `tools/` for inspection, integration, validation, and packaging. Avoid throwaway scripts for work the toolkit already handles.
2. Resolve local skills with `mcptoon skills resolve "<task>" --k 5` and consult the relevant returned skills. For coding tasks, activate the project in Serena when available, read its initial instructions, and prefer scoped symbol and reference reads. Use targeted source searches when Serena or its index is unavailable.
3. Pass `--json` to `tools/ai/cli.py` commands. Use `inspect`, `slice`, `refs`, and `impact` to scope code changes, `structures` for placed blocks, and `catalog` to inventory décor exports and textures.
4. Run supported write commands with `--dry-run` before `--apply`. Review the planned paths and conflicts before applying the same scoped operation.
5. For bulk décor integration, use the asset integrator `scaffold`. Never hand-edit `addon/RP/textures/terrain_texture.json`, the RP `blocks.json`, or BP `blocks/*.json` in bulk when `scaffold` handles them. The latter two are scaffold outputs if absent. Review the geometry, vanilla texture provenance, and target IDs before applying.

## Bedrock 1.26.50 Technical Guardrails

- Set `min_engine_version` to `[1, 26, 50]` in both pack manifests for V2. Keep `@minecraft/server` and `@minecraft/server-ui` pinned to `"beta"` in `addon/BP/manifest.json` and `package.json`. Preserve these pins during manifest updates and in response to audit findings. For MCP runtime QA, create a fresh disposable world with Cheats enabled and the **Beta APIs** experiment enabled, which the pinned beta Script API dependencies require. Enable another experiment only when a specific API or test requires it, and record the reason. These are QA-world settings; do not change an existing user world or the main world, and do not change pack API pins as a workaround.
- Preserve all seven canonical dimension IDs and keep their build heights within `-64` to `320`:
  - `paradise:yellow_halls`
  - `library:the_library`
  - `paradise:flat_flower`
  - `paradise:endless_staircase`
  - `paradise:burning_highway`
  - `catacombs:catacomb_mazes`
  - `heaven:the_heaven`
- Make every lighting state, fog, and visual cue readable in standard non-PBR Bedrock lighting. Keep `vhs_off` as the default subpack. Use `Player.fogSettings` as the primary fog path and `/fog` as the fallback.
- Use only vanilla Bedrock texture references and atlases assembled from original vanilla pixels. AI-generated and repainted textures are prohibited.
- Persist campaign, loop, and timer state in versioned, namespaced Dynamic Properties. Route all dimension travel through one safe-teleport helper that uses a ticking area to load the destination and cleans it up after use.

## Creative & Entity Rules

- Use established Backrooms lore entities only. The V2 entity roster is The Watcher (`paradise:watcher`) and Entity 8 — The Hound. Do not invent monsters.
- Roll out changes in phased slices. Deliver and verify **Yellow Halls → Library** first, then expand to subsequent slices.

## Debugging · Bedrock Live MCP

- A Minecraft Bedrock Live MCP is registered for debugging in `.vscode/mcp.json` (`bedrock-mcp`, stdio, `/home/pasta/.local/bin/bedrock-mcp`).
- Use the Microsoft Learn MCP for API and engine documentation while debugging, and the Bedrock samples at `/home/pasta/Downloads/paradise.exe reserection/Paradise.exe/bedrock-samples-v1.26.60.5-full` when reference material is needed.
- Use the MCP for world setup, live debugging and visual verification. Inspect the current tool descriptions and schemas each session. Relevant tools include `game_launch`, `game_status`, `worlds_list`, `world_open`, `world_leave`, `automation_connect`, `ui_tree`, `ui_click`, `input_send`, `frame_capture`, `command_execute`, `command_docs`, `player_get`, `world_info`, `pack_check` and `pack_validate`.
- The current tool catalog has no dedicated `world_create` operation. Create a new QA world through Minecraft's UI using MCP: launch/attach with `game_launch`, inspect each screen with `ui_tree` and `frame_capture`, and navigate with `ui_click` or `input_send`. Re-inspect after each navigation step; do not guess coordinates or assume a menu layout.
- During creation, enable **Cheats** and the **Beta APIs** experiment. Enable any additional experiment only when the current API documentation or a specific test requires it. Keep `vhs_off` selected. Give the world a unique QA name, enable the project's BP/RP, create it, and verify its folder ID and pack list with `worlds_list`.
- After creation, confirm the active world with `game_status`, then call `automation_connect` before using WebSocket-backed tools. If world creation leaves Minecraft at the menu, open the exact new world by folder ID with `world_open` before connecting. Use `command_execute` for test setup and diagnostics; check unfamiliar command syntax with `command_docs` first. Cheats are enabled so MCP command-based diagnostics and actions can run.
- Keep all experiments and Cheats confined to newly created disposable QA worlds. Do not toggle settings in an existing QA world, the user's main world, or another user's world. Do not use an existing world merely because new-world setup failed. Do not install the MCP Bridge or GameTest packs unless the user separately authorizes that installation.
- Capture and inspect before/after screenshots for each dimension and relevant fix. Save evidence under the project's QA evidence area when the MCP supports a destination path. Record the world name/folder ID, dimension, coordinates, enabled experiments, Cheats state, pack versions and screenshot paths. A static test is not runtime proof.
- Historical probes reported an empty world list, a missing `ReworkV2` world, an unavailable `ui_tree` capability (`UIScene has no RTTI`), an inactivity overlay and Beta APIs-disabled content-log errors. These are historical observations, not current state. Re-probe the game, UI, world list and WebSocket on every resumed session; if a capability remains unavailable, record its exact current error and continue independent work.

## Verification Gate

Before finishing any task, run both documented checks from the repository root:

```sh
python3 tools/ai/cli.py validate --json
python3 tools/ai/cli.py preflight --json
```

Use standard preflight as the gate. The V2 audit's stable-API findings are expected for the intentional beta pins. Report them and review other findings. Report both check outcomes and any pre-existing blockers. For lighting, fog, and travel changes, also verify the affected behavior in a disposable Bedrock test world with standard lighting and `vhs_off`.
