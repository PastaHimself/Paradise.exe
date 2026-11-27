# Paradise.exe renovation tracker

Use the order below. Keep at most one dimension in active implementation, including while it is **BLOCKED** or **AWAITING VISUAL APPROVAL**. Use only **NOT STARTED**, **IN PROGRESS**, **BLOCKED**, **AWAITING VISUAL APPROVAL**, and **ACCEPTED**. Record each blocker with its exact cause and next actionable step. Update this tracker after meaningful milestones with a short evidence link or note so resumed sessions can pick up where work stopped.

The [archived design plan](archive/GLM_FLASH_7DIM_MASTER_PLAN.md) preserves the seven designs, placement ledgers, deferred features, gameplay requirements, and technical constraints. Read the applicable dimension and shared sections for design. The active workflow is defined by [AGENTS.md](../AGENTS.md) and this tracker. The [archived implementation tracker](archive/IMPLEMENTATION_TODO.md#integrated-implementation-checkpoint--2026-11-26) preserves the existing static implementation across all seven dimensions and shared systems, including tests, asset repairs, and outstanding live checks. The statuses below track the new renovation workflow. Existing static work is the starting point. Runtime acceptance is open.

## 0. Development environment and shared runtime readiness — IN PROGRESS

- [x] Documentation workflow prepared on the renovation branch. The local Bedrock MCP 0.3.0 answered tool discovery and read-only status calls.
- [ ] Verify the target Minecraft build, active disposable world, Cheats, Beta APIs, standard non-PBR lighting, `vhs_off`, matching BP/RP, and live connection.
- [ ] Confirm pack startup and a basic live evidence loop (movement, screenshot, inspection, content logs, and reload where supported). Spot-check existing shared-kit rendering and review any current content-log errors.

**Latest readiness check (2026-11-27).** Minecraft was running. `worlds_list` listed `Paradise.exe QA 20261127` (folder `+pH-L48c+Uw=`) with both Paradise packs by name. The read-only MCP session returned `world: null` and a disconnected WebSocket. Next, attach to the client through the discovered MCP tools and verify which QA world is active, its settings and loaded pack versions, and whether automation connects. Reuse it if suitable. No live startup or dimension acceptance has been recorded in this workflow.

**Creator Tools.** Published CLI 0.21.0 identified both packs under `addon/`, and its isolated MCP advertised `designStructure` and `validateFile`. The render smoke test found the existing Yellow Halls structure and reported no compatible headless browser. Offline previews are optional. Use Bedrock Live MCP screenshots for acceptance. See [tool setup](../AI_TOOLS.md#minecraft-creator-tools).

**Next dimension.** [Yellow Halls](renovation/01_YELLOW_HALLS.md), after readiness is verified and implementation is authorized.

## 1. Yellow Halls — NOT STARTED

`paradise:yellow_halls`

- [ ] Existing environment inspected through MCP.
- [ ] Architectural direction established.
- [ ] Representative prototype implemented.
- [ ] Prototype verified in Minecraft.
- [ ] Prototype visually approved by the user.
- [ ] Procedural generation integrated.
- [ ] Decoration and structure placement verified.
- [ ] Original gameplay and exits verified.
- [ ] Performance and lifecycle verified.
- [ ] Relevant regression tests passed.
- [ ] Final acceptance evidence recorded.

## 2. Library — NOT STARTED

`library:the_library`

- [ ] Existing environment inspected through MCP.
- [ ] Architectural direction established.
- [ ] Representative prototype implemented.
- [ ] Prototype verified in Minecraft.
- [ ] Prototype visually approved by the user.
- [ ] Procedural generation integrated.
- [ ] Decoration and structure placement verified.
- [ ] Original gameplay and exits verified.
- [ ] Performance and lifecycle verified.
- [ ] Relevant regression tests passed.
- [ ] Final acceptance evidence recorded.

## 3. Flat Flower — NOT STARTED

`paradise:flat_flower`

- [ ] Existing environment inspected through MCP.
- [ ] Architectural direction established.
- [ ] Representative prototype implemented.
- [ ] Prototype verified in Minecraft.
- [ ] Prototype visually approved by the user.
- [ ] Procedural generation integrated.
- [ ] Decoration and structure placement verified.
- [ ] Original gameplay and exits verified.
- [ ] Performance and lifecycle verified.
- [ ] Relevant regression tests passed.
- [ ] Final acceptance evidence recorded.

## 4. Endless Staircase — NOT STARTED

`paradise:endless_staircase`

- [ ] Existing environment inspected through MCP.
- [ ] Architectural direction established.
- [ ] Representative prototype implemented.
- [ ] Prototype verified in Minecraft.
- [ ] Prototype visually approved by the user.
- [ ] Procedural generation integrated.
- [ ] Decoration and structure placement verified.
- [ ] Original gameplay and exits verified.
- [ ] Performance and lifecycle verified.
- [ ] Relevant regression tests passed.
- [ ] Final acceptance evidence recorded.

## 5. Catacombs — NOT STARTED

`catacombs:catacomb_mazes`

- [ ] Existing environment inspected through MCP.
- [ ] Architectural direction established.
- [ ] Representative prototype implemented.
- [ ] Prototype verified in Minecraft.
- [ ] Prototype visually approved by the user.
- [ ] Procedural generation integrated.
- [ ] Decoration and structure placement verified.
- [ ] Original gameplay and exits verified.
- [ ] Performance and lifecycle verified.
- [ ] Relevant regression tests passed.
- [ ] Final acceptance evidence recorded.

## 6. Burning Highway — NOT STARTED

`paradise:burning_highway`

- [ ] Existing environment inspected through MCP.
- [ ] Architectural direction established.
- [ ] Representative prototype implemented.
- [ ] Prototype verified in Minecraft.
- [ ] Prototype visually approved by the user.
- [ ] Procedural generation integrated.
- [ ] Decoration and structure placement verified.
- [ ] Original gameplay and exits verified.
- [ ] Performance and lifecycle verified.
- [ ] Relevant regression tests passed.
- [ ] Final acceptance evidence recorded.

## 7. Heaven — NOT STARTED

`heaven:the_heaven`

- [ ] Existing environment inspected through MCP.
- [ ] Architectural direction established.
- [ ] Representative prototype implemented.
- [ ] Prototype verified in Minecraft.
- [ ] Prototype visually approved by the user.
- [ ] Procedural generation integrated.
- [ ] Decoration and structure placement verified.
- [ ] Original gameplay and exits verified.
- [ ] Performance and lifecycle verified.
- [ ] Relevant regression tests passed.
- [ ] Final acceptance evidence recorded.

## 8. Cross-dimension integration and final release verification — NOT STARTED

- [ ] Verify canonical IDs and build bounds, travel and return paths, pack startup/reload, and shared generation lifecycle across all seven accepted dimensions.
- [ ] Verify shared fog ownership and restoration, particle and workload budgets, concurrent players, and mobile/desktop visual and performance checks from the archived integration section.
- [ ] Run the full repository regressions and standard preflight, validate the paired packs and release artifact as applicable, and record final live evidence and any open release constraints.

## Acceptance evidence

Mark a dimension **ACCEPTED** only after its milestones are complete and the recorded evidence shows that:

- Intended architecture is present in Minecraft. Required models and structures render correctly, segmented assets are complete, lighting is readable in standard non-PBR mode with `vhs_off`, and there is no unintended floating geometry or blocked route.
- Required paths and functional areas are accessible, and existing entry, exit, travel, and gameplay work through their normal interactions.
- Generation and cleanup work through repeat visits and relevant failure/recovery and concurrency cases. Relevant content-log errors are resolved, observed performance meets existing project constraints, and relevant regressions and dimension-level integration checks pass. Stage 8 handles cross-dimension release verification after all seven dimensions are accepted.
- The user explicitly approved the representative visual design before procedural rollout.

Record the tested commit and any uncommitted changes in the tested build, client build, world name/folder ID, pack versions, QA settings, seed or relevant coordinates, and links or paths to inspected in-game screenshots of the procedurally generated dimension on that build. Record test outcomes, content-log findings, the measured performance evidence and test conditions, and the approved prototype screenshots and user approval reference. Keep unsupported or unverified checks open and record their exact cause.
