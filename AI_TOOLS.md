# Paradise.exe developer tools

Run from the repo root. Use Python 3.10+ and Node.js 22+ (the CI versions are Python 3.12 and Node.js 22). The toolkit uses the Python standard library and the repository’s existing TypeScript install. The audio checks use FFmpeg/ffprobe for encoded assets.

```sh
npm install --ignore-scripts --no-audit --no-fund --no-package-lock
python3 tools/ai/cli.py --help
```

Each invocation emits a single compact JSON object by default, including when you pass `--json`. `--help` emits text. Exit `0` means pass, `1` means findings or conflicts, and `2` means bad input, a missing prerequisite, or an execution error. Warnings can accompany exit `0`. For lists, read `total` before fetching another page with `--offset N --limit N` (default 20, maximum 500). JSON examples below show selected fields.

Put `--root /path/to/checkout` before the subcommand to inspect another Paradise.exe checkout. The TypeScript parser is loaded from the toolkit’s checkout. Type-checking uses the target checkout’s compiler, configuration, and API typings. `scaffold`, `manifest`, and `package` default to dry-run. Pass `--apply` to write after reviewing the plan.

## Choose a command

| If you need to… | Run |
| --- | --- |
| Locate a definition or callback before opening a long script | `python3 tools/ai/cli.py inspect --kind symbol --query registerStartupHooks --limit 5` |
| Trace startup and tick registrations | `python3 tools/ai/cli.py inspect --kind event --query startup` or `python3 tools/ai/cli.py inspect --kind schedule --query runInterval` |
| Find dynamic property reads and writes | `python3 tools/ai/cli.py inspect --kind state --query watcher_memory` |
| Find dimension registration, fog references, or direct sound calls | `python3 tools/ai/cli.py inspect --kind dimension` or use `--kind fog` or `--kind sound` |
| Find every literal occurrence before editing an ID or asset path | `python3 tools/ai/cli.py refs geometry.flashlight` |
| Check what imports a script or what a Git change affects | `python3 tools/ai/cli.py impact --file paradise_dimension_visual_profiles.js` or `impact --base origin/main` |
| Find which structures place a block | `python3 tools/ai/cli.py structures --block minecraft:bone_block` |
| Rank observed script time | `python3 tools/ai/cli.py profile /path/to/session.cpuprofile --file scripts/ --limit 10` |
| Compare Blockception regressions | `python3 tools/ai/cli.py diagnostics --current /tmp/current.json --baseline /tmp/baseline.json --warnings` |
| Preview a version bump or inspect the installed manifest versions | `python3 tools/ai/cli.py manifest --bp-version 1.2.15 --rp-version 1.0.16` |
| Inventory Bedrock model exports | `python3 tools/ai/cli.py catalog --directory /path/to/models --texture-dir /path/to/textures` |
| Preview a folder of paired décor exports | `python3 tools/ai/cli.py scaffold --from-directory /path/to/exports --namespace decor` |
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

## Trace changes before editing

`refs` reads both packs’ JSON keys and values and JS string literals. Use the default case-sensitive exact match before renaming an ID. Use `--contains` for near matches or static segments in a templated command. `--file SUBSTRING` scopes results by path. JSON locations are RFC 6901 pointers. `definition:true` marks a likely declaration under an `identifier` field or known registry. Computed strings and IDs inside binary NBT need their own checks.

```sh
python3 tools/ai/cli.py refs geometry.flashlight --limit 4
python3 tools/ai/cli.py refs 'paradise:catacombs/' --contains --file scripts
```

```json
{"command":"refs","status":0,"total":4,"items":[{"kind":"json-value","pointer":"/minecraft:geometry/0/description/identifier","definition":true}]}
```

`impact` finds direct and transitive importers through static imports, re-exports, and literal dynamic imports. It reports reachability from the current BP manifest’s script entries. Use `--file` repeatedly to seed known scripts or `--base REV` to include tracked and untracked add-on changes relative to a Git commit. With neither flag it compares against `HEAD`. Deleted script paths can still appear as seeds when an importer refers to them. `depth:0` means selected, and `via` names the next file on one shortest path to a selected script. Git mode lists all changed add-on files in `changed`. The graph traces JS only and treats literal dynamic imports as possible edges.

```sh
python3 tools/ai/cli.py impact --file paradise_dimension_visual_profiles.js --limit 5
python3 tools/ai/cli.py impact --base origin/main --limit 10
```

```json
{"command":"impact","status":0,"reachable_scripts":44,"unreachable_scripts":3,"total":4,"items":[{"file":"addon/Genshin X Craft BP/scripts/main.js","depth":2,"entry_reachable":true,"exists":true}]}
```

## Inspect placed blocks

`structures` uses the existing NBT reader and validator. Use `--query SUBSTRING` for a dimension or structure, `--palette` for observed block counts by layer, or `--block ID` to find structures where an exact block ID is placed. Counts include named air entries if present and exclude empty cells (`-1`). `--check-blocks` checks placed custom IDs against this BP’s block definitions. Leave it off when intentionally depending on another pack’s blocks.

```sh
python3 tools/ai/cli.py structures --query catacombs --palette --limit 4
python3 tools/ai/cli.py structures --block minecraft:bone_block --check-blocks --limit 4
```

```json
{"command":"structures","status":0,"blocks":{"items":[{"structure":"paradise:catacombs/collapsed_crypt","block":"minecraft:bone_block","by_layer":[2,0]}]}}
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

For a staging folder where each model has one geometry and one same-stem texture, skip hand-authoring the spec.

```sh
python3 tools/ai/cli.py scaffold --from-directory /path/to/models --texture-dir /path/to/textures --namespace decor --render-method alpha_test --dry-run
```

The file `desk_lamp.geo.json` becomes `decor:desk_lamp`. The namespace defaults to `paradise`, and the texture directory defaults to the model directory. Any unpaired model, ambiguous texture, or repeated generated ID stops the whole batch before files are written. Use a reviewed JSON spec for alternate filenames and multi-geometry exports. Once the plan is correct, rerun with `--apply` in place of `--dry-run`.

```json
{"command":"scaffold","status":0,"mode":"dry-run","paired_blocks":1,"total":4}
```

For new models in a JSON spec supply a `model` source path and a `geometry` ID exported by it. For each block supply either `texture` (a PNG/TGA/JPEG source path) or `texture_path` (an extensionless existing base-RP path). Source paths are absolute or relative to the repo root. The scaffold copies supplied assets, creates a BP block, and merges the `namespace__name` key into the terrain atlas. It uses one wildcard material and defaults to `opaque`. The supported `render_method` values follow the Bedrock material instance component. [Material instances](https://learn.microsoft.com/minecraft/creator/reference/content/blockreference/examples/blockcomponents/minecraftblock_material_instances?view=minecraft-bedrock-stable)

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

## Use runtime evidence and compare diagnostics

Run `/script profiler start` and `/script profiler stop` in a test world around the behavior you want to measure. Feed the resulting file to `profile`. `--sort self` ranks time spent in the sampled function and `--sort total` includes descendants. Rows represent call-tree nodes, so a function can appear in more than one calling context. Timing fields are microseconds when `timeDeltas` is present. Profiles without timings are ranked by sample counts. [Bedrock script profiling](https://learn.microsoft.com/minecraft/creator/documents/scripting/script-performance?view=minecraft-bedrock-stable#script-profiling)

```sh
python3 tools/ai/cli.py profile /path/to/session.cpuprofile --sort self --limit 10
```

```json
{"command":"profile","status":0,"samples":94,"sampled_us":126507,"items":[{"function":"measure","self_us":87847,"total_us":87847}]}
```

Run the existing Blockception helper on the base and current revisions using the same server version. `diagnostics` compares report entries by severity, path, diagnostic code, and message. Line shifts leave identity intact, and duplicate counts are preserved. It exits `1` for added findings. Omit `--baseline` to report all current errors. Pass `--warnings` to include warnings. This comparison leaves the standalone CI gate in place.

```sh
python3 tools/ai/cli.py diagnostics --current /tmp/current.json --baseline /tmp/baseline.json --warnings
```

```json
{"command":"diagnostics","status":0,"current":5,"baseline":5,"added":{"total":0,"items":[]},"resolved":{"total":0,"items":[]}}
```

## Plan pack version changes

Call `manifest` with no flags to inspect both manifest versions and BP Script API declarations. `--bp-version` sets the BP header and modules, `--rp-version` sets the RP header, modules, and linked version in the BP dependency, and `--engine` sets the minimum engine version in both. Pack version downgrades are rejected. UUIDs and API dependency values are preserved. After reviewing a planned bump, rerun with `--apply`. [Bedrock pack manifests](https://learn.microsoft.com/minecraft/creator/reference/content/manifestreference/header?view=minecraft-bedrock-stable)

```sh
python3 tools/ai/cli.py manifest
python3 tools/ai/cli.py manifest --bp-version 1.2.15 --rp-version 1.0.16 --engine 1.26.50 --dry-run
```

```json
{"command":"manifest","status":0,"mode":"dry-run","versions":{"bp_rp_dependency":{"before":[1,0,15],"after":[1,0,16]}}}
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
