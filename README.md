# Paradise.exe

[![CI](https://github.com/PastaHimself/Paradise.exe/actions/workflows/check.yml/badge.svg)](https://github.com/PastaHimself/Paradise.exe/actions/workflows/check.yml)

> **don't enjoy**

A psychological horror addon for Minecraft Bedrock Edition featuring an extreme visual upgrade atmosphere bootstrap and multiple terrifying horror scenarios.

## ⚠️ Warning

This addon contains disturbing imagery, intense atmospheric effects, and horror elements. Player discretion is advised.

## 📦 Contents

- **Behavior Pack** (`addon/Genshin X Craft BP`) - Horror scenario logic, entity behaviors, and dimension mechanics
- **Resource Pack** (`addon/Genshin X Craft RP`) - Visual assets, VHS effects, and atmospheric textures
  - Includes optional VHS filter subpacks (On/Off)
  - PBR (Physically Based Rendering) support

## 👻 Features

- **Multiple Horror Dimensions & Scenarios:**
  - Burning Highway
  - Catacombs
  - Endless Staircase
  - Flat Flower
  - Heaven
  - Library
  - Watcher Stalker
  - Yellow Halls
  - Paradise Dimension

- **Extreme Visual Upgrade** - Atmospheric bootstrap with enhanced horror aesthetics
- **VHS Effects** - Optional retro VHS filter overlay (toggleable via subpacks)
- **Player Configuration** - Customizable horror experience settings
- **Dynamic Player Light** - Adaptive lighting system for heightened tension
- **Horror Events V2** - Generic horror scenario framework
- **Per-Player Horror Coordinator** - Separates multiplayer pacing and cleans up active scares on death, leaving, and dimension changes.
- **Watcher Encounter Phases** - Observe, Shadow, Pressure, Ambush, and Vanish behavior with warning evidence before attacks.
- **Curated Horror Audio** - Supplied horror sounds are converted to compressed OGG variants and used for private Watcher cues, ambience, and dimension tension.
- **No Safe Rooms** - No location, bed, shelter, or lodestone grants immunity or suppresses horror events; relief is temporary pacing only.

## 🛠️ Development Setup

### Prerequisites

- Python 3.12+
- Node.js 22+
- Minecraft Bedrock Editor (optional, for testing)

### Installation

```bash
# Install Node.js dependencies (Minecraft Bedrock Script API typings)
npm install --ignore-scripts --no-audit --no-fund
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm test` | Run JavaScript regression tests |
| `npm run typecheck` | Type-check behavior scripts against Bedrock beta APIs |
| `npm run prepare:audio` | Convert and validate supplied horror audio as compressed OGG assets |

## 🔍 Validation Tools

This repository includes comprehensive validation tools for addon development:

| Tool | Purpose |
|------|---------|
| `validate_addon.py` | Complete add-on structure and content validation |
| `validate_resource_links.py` | Validate Bedrock resource identifier links |
| `validate_mcstructures.py` | Validate all Bedrock structure files (.mcstructure) |
| `run_blockception_lsp_check.mjs` | Run Blockception language server diagnostics |
| `package_mcaddon.py` | Package addon into .mcaddon format |

### Audio Preparation

The audio pipeline reads the manifest at `docs/audio/paradise-sound-assets.json`, converts positional cues to mono OGG Vorbis and ambience to stereo OGG Vorbis, then writes a size report. Source archives are development inputs only; the resource pack ships normalized OGG outputs. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for credits and license restrictions.

### Usage Examples

```bash
# Full addon validation with JSON report
python tools/validate_addon.py --report artifacts/addon-validation.json

# Resource link validation
python tools/validate_resource_links.py --report artifacts/resource-link-validation.json

# Structure validation
python tools/validate_mcstructures.py --report artifacts/mcstructure-validation.json

# Run all unit tests
python -m unittest discover -s tests -p 'test_*.py' -v
```

## 🚀 CI/CD Pipeline

The GitHub Actions workflow automatically runs on every push and pull request:

- ✅ Python & Node.js environment setup
- ✅ Validator unit tests
- ✅ Complete addon validation
- ✅ Resource link validation
- ✅ Structure file validation
- ✅ JavaScript syntax checking
- ✅ TypeScript type checking
- ✅ Blockception language server diagnostics

## 📁 Project Structure

```
paradise-exe/
├── addon/
│   ├── Genshin X Craft BP/     # Behavior Pack
│   │   └── scripts/            # JavaScript modules for horror scenarios
│   └── Genshin X Craft RP/     # Resource Pack
│       ├── textures/           # Horror assets & VHS effects
│       └── subpacks/           # VHS On/Off variants
├── tools/                      # Validation & packaging scripts
├── tests/                      # Unit tests (Python & JavaScript)
├── .github/workflows/          # CI/CD pipeline
├── package.json                # Node.js dependencies & scripts
└── tsconfig.json               # TypeScript configuration
```

## 📄 License

All rights reserved. This addon and its assets are proprietary.

## 🤝 Contributing

This is a personal project. For issues or suggestions, please open an issue on the repository.

---

**Paradise.exe** - *Enter at your own risk.*
