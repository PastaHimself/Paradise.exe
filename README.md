# Paradise.exe - Genshin Impact x Minecraft Bedrock Add-on

[![Full Add-on Check](https://github.com/Paradise-exe/paradise-exe-addon-checks/actions/workflows/full-addon-check.yml/badge.svg)](https://github.com/Paradise-exe/paradise-exe-addon-checks/actions/workflows/full-addon-check.yml)

A comprehensive **Genshin Impact × Minecraft Bedrock** crossover add-on that brings elements from Genshin Impact into Minecraft Bedrock Edition. This repository includes the add-on source code along with a robust validation and testing framework to ensure quality and compatibility.

## 📦 Contents

- **addon/Genshin X Craft BP** – Behavior Pack containing game logic and scripts
- **addon/Genshin X Craft RP** – Resource Pack containing assets, models, and textures
- **tools/** – Validation scripts for add-on integrity, structure checks, and resource linking
- **tests/** – Unit tests for validators and add-on functionality

## 🚀 Features

- Genshin Impact-themed content for Minecraft Bedrock
- Custom entities, items, and mechanics
- Fully validated against Minecraft Bedrock standards
- Automated CI/CD pipeline for quality assurance

## 🛠️ Development

### Prerequisites

- **Node.js 22+**
- **Python 3.12+**
- **Minecraft Bedrock Script API** (beta typings installed via npm)

### Installation

```bash
# Install dependencies
npm install --ignore-scripts --no-audit --no-fund
```

### Available Scripts

```bash
# Run JavaScript unit tests
npm test

# Type-check behavior pack scripts against Bedrock beta APIs
npm run typecheck
```

### Validation Tools

This project includes several validation tools to ensure add-on quality:

| Tool | Description |
|------|-------------|
| `validate_addon.py` | Complete add-on structure and content validation |
| `validate_resource_links.py` | Checks Bedrock resource identifier links |
| `validate_mcstructures.py` | Validates all Bedrock structures |
| `run_blockception_lsp_check.mjs` | Runs Blockception language server diagnostics |
| `package_mcaddon.py` | Builds installable `.mcaddon` package |

#### Running Validators

```bash
# Validate complete add-on
python tools/validate_addon.py --report artifacts/addon-validation.json

# Validate resource links
python tools/validate_resource_links.py --report artifacts/resource-link-validation.json

# Validate structures
python tools/validate_mcstructures.py --report artifacts/mcstructure-validation.json

# Check JavaScript syntax
find "addon/Genshin X Craft BP/scripts" -type f -name '*.js' -exec node --check {} \;

# Build .mcaddon package
python tools/package_mcaddon.py --output artifacts/Paradise.exe.mcaddon
```

### Running Tests

```bash
# Run Python validator unit tests
python -m unittest discover -s tests -p 'test_*.py' -v

# Run JavaScript tests
npm test
```

## 🏗️ CI/CD Pipeline

The repository uses GitHub Actions to automatically:

- ✅ Run all validator unit tests
- ✅ Validate add-on structure and content
- ✅ Check resource identifier links
- ✅ Validate all Bedrock structures
- ✅ Verify JavaScript syntax
- ✅ Type-check scripts against Bedrock beta APIs
- ✅ Run JavaScript regression tests
- ✅ Run Blockception language server diagnostics
- ✅ Build and package `.mcaddon` file
- ✅ Upload build artifacts and validation reports

## 📁 Project Structure

```
paradise-exe-addon-checks/
├── addon/
│   ├── Genshin X Craft BP/    # Behavior Pack (scripts, entities)
│   └── Genshin X Craft RP/    # Resource Pack (assets, models)
├── tests/                     # Unit tests for validators
├── tools/                     # Validation and packaging scripts
├── .github/workflows/         # CI/CD pipeline configuration
├── package.json               # Node.js dependencies and scripts
└── tsconfig.json              # TypeScript configuration for type checking
```

## 📄 License

This project is private and proprietary.

## 🤝 Contributing

This is a private repository. For issues or questions, please contact the maintainers directly.

---

**Made with ❤️ for Minecraft Bedrock and Genshin Impact fans**