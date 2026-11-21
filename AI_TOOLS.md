# Paradise.exe developer tools

Run from the repo root. Use Python 3.10+ and Node.js 22+ (the CI versions are Python 3.12 and Node.js 22). The toolkit uses the Python standard library and the repository’s existing TypeScript install. The audio checks use FFmpeg/ffprobe for encoded assets.

```sh
npm install --ignore-scripts --no-audit --no-fund --no-package-lock
python3 tools/ai/cli.py --help
```

Each invocation emits a single compact JSON object by default, including when you pass `--json`. `--help` emits text. Exit `0` means pass, `1` means findings or conflicts, and `2` means bad input, a missing prerequisite, or an execution error. Warnings can accompany exit `0`. For lists, read `total` before fetching another page with `--offset N --limit N` (default 20, maximum 500). JSON examples below show selected fields.

Put `--root /path/to/checkout` before the subcommand to inspect another Paradise.exe checkout. The TypeScript parser is loaded from the toolkit’s checkout. Type-checking uses the target checkout’s compiler, configuration, and API typings. `scaffold` and `package` default to dry-run. Pass `--apply` to write after reviewing the plan.

## Choose a command

| If you need to… | Run |
| --- | --- |
| Locate a definition or callback before opening a long script | `python3 tools/ai/cli.py inspect --kind symbol --query registerStartupHooks --limit 5` |
| Trace startup and tick registrations | `python3 tools/ai/cli.py inspect --kind event --query startup` or `python3 tools/ai/cli.py inspect --kind schedule --query runInterval` |
| Find dynamic property reads and writes | `python3 tools/ai/cli.py inspect --kind state --query watcher_memory` |
| Find dimension registration, fog references, or direct sound calls | `python3 tools/ai/cli.py inspect --kind dimension` or use `--kind fog` or `--kind sound` |
| Inventory Bedrock model exports | `python3 tools/ai/cli.py catalog --directory /path/to/models --texture-dir /path/to/textures` |
| Preview a block and dimension batch | `python3 tools/ai/cli.py scaffold --spec /path/to/batch.json --dry-run` |
| Check the packs, structures, audio, and Script API | `python3 tools/ai/cli.py validate` |
| Review textures with no exact reference observed | `python3 tools/ai/cli.py assets --query textures/blocks/ --limit 10` |
| Check and plan a clean test archive | `python3 tools/ai/cli.py package --dry-run --output artifacts/Paradise.exe.mcaddon` |

`inspect` defaults to `--kind summary`. Use `--file watcher_stalker.js` to reduce results to one script. Locations are 1-based. `end` is returned for symbol declarations. A scheduler entry gives a literal `ticks` value where resolvable and otherwise gives an `expression` when present. State calls include the method, receiver and `resolved`. This is a static index of source expressions. Inspect the callback bodies and world data for actual frequency, state lifetime, and tick cost.

```json
{"command":"inspect","status":0,"total":3,"items":[{"kind":"state","name":"paradise:watcher_memory","line":1165,"method":"getDynamicProperty","receiver":"player","resolved":true}]}
```

`catalog` lists `*.geo.json` exports, geometry IDs, and textures with the same filename stem. Review multi-geometry exports and textures with alternate names before creating the batch. If needed, export raw `.bbmodel` files to Bedrock geometry first.

```sh
python3 tools/ai/cli.py catalog --directory 'addon/Genshin X Craft RP/models' --texture-dir 'addon/Genshin X Craft RP/textures' --query flashlight
```

```json
{"command":"catalog","status":0,"total":1,"items":[{"model":"addon/Genshin X Craft RP/models/blocks/flashlight.geo.json","geometries":["geometry.flashlight"],"textures":[]}]}
```

## Scaffold a batch

Save JSON like this to a scratch file such as `/tmp/paradise-batch.json`. Both arrays are optional. This preview uses a model and texture that already ship with 0.3.

```json
{
  "blocks": [
    {"id":"paradise:flashlight_display","geometry":"geometry.flashlight","texture_path":"textures/items/flashlight_off","render_method":"opaque"}
  ],
  "dimensions": [
    {"id":"paradise:preview_void","min_y":-64,"height_range":384}
  ]
}
```

For new models supply a `model` source path and a `geometry` ID exported by it. For each block supply either `texture` (a PNG/TGA/JPEG source path) or `texture_path` (an extensionless existing base-RP path). Source paths are absolute or relative to the repo root. The scaffold copies supplied assets, creates a BP block, and merges the `namespace__name` key into the terrain atlas. It uses one wildcard material and defaults to `opaque`. The supported `render_method` values follow the Bedrock material instance component. [Material instances](https://learn.microsoft.com/minecraft/creator/reference/content/blockreference/examples/blockcomponents/minecraftblock_material_instances?view=minecraft-bedrock-stable)

Dimensions accept `id`, optional `min_y`, `height_range`, and a namespaced `biome`. The generated dimension starts as a void. Use this only for a Bedrock 1.26.50+ target. The current BP minimum is 1.26.20, so dimension previews surface an engine warning. Existing script-registered IDs are rejected. The scaffold leaves manifest versions and startup scripts to the caller. Review the block and dimension formats against the target version. [Custom blocks](https://learn.microsoft.com/minecraft/creator/documents/advancedcustomblocks?view=minecraft-bedrock-stable) · [Custom dimensions](https://learn.microsoft.com/minecraft/creator/documents/scripting/custom-dimension-api-tutorial?view=minecraft-bedrock-stable)

```sh
python3 tools/ai/cli.py scaffold --spec /tmp/paradise-batch.json --dry-run
# After approving the changes for this implementation branch:
python3 tools/ai/cli.py scaffold --spec /tmp/paradise-batch.json --apply
python3 tools/ai/cli.py validate
```

```json
{"command":"scaffold","status":0,"mode":"dry-run","total":3,"items":[{"path":"addon/Genshin X Craft BP/blocks/paradise__flashlight_display.json","action":"create"}]}
```

Exact repeats are `unchanged`. Conflicting IDs, changed assets, or conflicting atlas keys produce exit `1`; inspect the diff before editing existing content. The plan is built before writing. Apply uses a repo-local lock and atomic file replacements. If a process was forcibly killed, confirm it has exited before removing an empty `.paradise-ai-scaffold.lock` directory and rerunning the same spec.

## Pre-flight, cleanup, and export

`validate` runs the existing add-on, resource-link, structure, and audio manifest validators, parses scripts, and checks installed Script API versions and the existing TypeScript project. It adds local block geometry and managed terrain-atlas links, client biome and statically recognized script fog IDs, and direct custom sound IDs. Data-driven sound candidates behind the existing audio fallback are handled by the audio pipeline. Computed references, external packs, and actual Bedrock execution need separate verification.

```sh
python3 tools/ai/cli.py validate --limit 12
python3 tools/ai/cli.py validate --release-audio
python3 tools/ai/cli.py package --output artifacts/Paradise.exe.mcaddon --dry-run
python3 tools/ai/cli.py package --output artifacts/Paradise.exe.mcaddon --apply
```

```json
{"command":"validate","status":0,"checks":{"structures":{"errors":0,"warnings":0,"structure_count":28},"audio":{"errors":0,"warnings":8,"asset_count":3}}}
```

```json
{"command":"package","status":0,"mode":"dry-run","output":"artifacts/Paradise.exe.mcaddon","excluded":{"total":0,"offset":0,"items":[]},"action":"plan"}
```

Both commands accept `--release-audio` for the strict release gate. Use `--skip-typecheck` only for targeted pack checks or when you have already type-checked separately. It still parses JS with the existing TypeScript dependency. Package apply requires valid pre-flight checks, filters common editor/archive/source-model debris, and verifies the two nested packs. It preserves an existing archive with matching bytes. Use `--apply --replace` to publish different bytes at the same destination, or choose a new output path. Use a path under `artifacts/` or outside the checkout.

`assets` reports bitmap paths with no exact JSON or script literal reference observed. It also recognizes relative PBR texture-set references and matches subpack textures by their in-game path. Treat its rows as leads. Bedrock can load textures through vanilla identifiers, implicit paths, and overlays. Confirm absence in the target client before removing an asset. The tool has no delete operation.

```json
{"command":"assets","status":0,"matched":1571,"unmatched":2145,"items":[{"path":"addon/Genshin X Craft RP/textures/blocks/bed_feet_end.png","scope":".","bytes":384}]}
```

## Existing tools

Use the direct commands when you need their complete reports, CI parity, or their specialized workflow. These commands retain their original output and write flags. `--report` and `--write` write files, and the legacy packager writes on invocation.

| Purpose | Exact command | Minimal output |
| --- | --- | --- |
| Full add-on validator | `python3 tools/validate_addon.py` | `{"ok":true,"errors":[],"counts":{"javascript_files":47}}` |
| RP semantic links | `python3 tools/validate_resource_links.py` | `{"ok":true,"counts":{"geometry_definitions":17}}` |
| NBT structures and metadata | `python3 tools/validate_mcstructures.py` | `{"ok":true,"structure_count":28}` |
| Audio manifest audit | `python3 tools/validate_audio_manifest.py --json` | `{"ok":true,"asset_count":3,"required_total_files":127}` |
| Preview audio staging | `python3 tools/stage_audio_manifest.py --allow-partial` | `{"required_total_files":127,"assets":[]}` with no staged sources. Use `--write` with staged sources to update the manifest. |
| Verify generated audio registry and definitions | `python3 tools/generate_sound_definitions.py --check` | `{"ok":true,"generated":[],"updated":[]}` |
| Verify cleared audio encodes | `python3 tools/compress_audio.py --check-only --cleared-only --verify-output` | `{"ok":true,"assets":[],"status":"no_cleared_assets"}` |
| Syntax-check a script | `node --check "addon/Genshin X Craft BP/scripts/main.js"` | Empty stdout on success. |
| Type-check and JS regressions | `npm run typecheck` and `npm test` | Text compiler and test output. |
| Validator regressions | `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p 'test_*.py'` | Text unittest results. |
| Toolkit integration tests | `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tools/ai -p 'test_*.py'` | Text unittest results. Apply tests use temporary copies of Git HEAD’s packs. |
| Blockception LSP | `node tools/run_blockception_lsp_check.mjs --server .blockception/minecraft-bedrock-language-server/ide/vscode/lsp/server.js --workspace addon --report artifacts/blockception-lsp-diagnostics.json` | JSON report file. Install/build the server as in `.github/workflows/full-addon-check.yml`. |
| Direct CI packaging | `python3 tools/package_mcaddon.py --output artifacts/Paradise.exe.mcaddon` | Text path and byte count. |
| In-game runtime harness | `/p:debug` as a player with Game Directors permission and cheats enabled | In-game diagnostics. Use a disposable test world. |

## 0.3 baseline at `e4eb8d5`

- Scanned 47 JS files and 385 pack JSON documents. The index found 99 event registrations, 26 interval calls, and seven script-registered dimensions. All 28 structures and the toolkit’s default pre-flight pass.
- The regular audio gate passes with eight warnings. Three wind sources are absent and five source-pack manifests are incomplete. The strict gate fails with eight errors, including the three wind entries awaiting license clearance. The manifest has 3 of 127 required source records.
- Separately, Blockception at `32fba1e` reported three unresolved animation IDs in the vanilla cat/sheep client overrides (`animation.cat.baby_transform`, `animation.sheep.setup.v2`, `animation.sheep.baby_transform`) and two `common.base_screen` inheritance warnings. The same animation IDs are referenced in Mojang’s client entity samples. Check resolution in the target Bedrock client. [Mojang Bedrock samples](https://github.com/Mojang/bedrock-samples/tree/15701fa9/resource_pack/entity)
- Three geometry files ship in this checkout. Bring the separately staged décor exports to `catalog` when they are available.
- The texture inventory found 2,145 paths with no exact reference observed. Use these as inspection candidates, with vanilla fallback, implicit references, and subpacks in mind.
