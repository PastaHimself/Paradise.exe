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

1. Read `AI_TOOLS.md` before every code or asset task. Run its commands from the repository root and use the existing CLI in `tools/` for inspection, integration, validation, and packaging. Avoid throwaway scripts for work the toolkit already handles.
2. Resolve local skills with `mcptoon skills resolve "<task>" --k 5` and consult the relevant returned skills. For coding tasks, activate the project in Serena when available, read its initial instructions, and prefer scoped symbol and reference reads. Use targeted source searches when Serena or its index is unavailable.
3. Pass `--json` to `tools/ai/cli.py` commands. Use `inspect`, `slice`, `refs`, and `impact` to scope code changes, `structures` for placed blocks, and `catalog` to inventory décor exports and textures.
4. Run supported write commands with `--dry-run` before `--apply`. Review the planned paths and conflicts before applying the same scoped operation.
5. For bulk décor integration, use the asset integrator `scaffold`. Never hand-edit `addon/RP/textures/terrain_texture.json`, the RP `blocks.json`, or BP `blocks/*.json` in bulk when `scaffold` handles them. The latter two are scaffold outputs if absent. Review the geometry, vanilla texture provenance, and target IDs before applying.

## Bedrock 1.26.50 Technical Guardrails

- Set `min_engine_version` to `[1, 26, 50]` in both pack manifests for V2. Keep `@minecraft/server` and `@minecraft/server-ui` pinned to `"beta"` in `addon/BP/manifest.json` and `package.json`. Preserve these pins during manifest updates and in response to audit findings. Keep the zero-experimental-toggles rule.
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

## Verification Gate

Before finishing any task, run both documented checks from the repository root:

```sh
python3 tools/ai/cli.py validate --json
python3 tools/ai/cli.py preflight --json
```

Use standard preflight as the gate. The V2 audit's stable-API findings are expected for the intentional beta pins. Report them and review other findings. Report both check outcomes and any pre-existing blockers. For lighting, fog, and travel changes, also verify the affected behavior in a disposable Bedrock test world with standard lighting and `vhs_off`.
