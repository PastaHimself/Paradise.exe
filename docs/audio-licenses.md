# Audio license ledger

The audio pipeline treats every supplied file as blocked until the source file,
checksum, and license evidence are present in `tools/audio_assets.json`.
`tools/compress_audio.py` will not encode a pack marked `license_blocked` or
`pending_source`.

| Pack | Source | Recorded terms | Attribution |
| --- | --- | --- | --- |
| Old Locations | [Canvas Coven](https://canvas-coven.itch.io/old-locations-free-horror-ambiences-asset) | CC BY 4.0; integrated derivatives are allowed with attribution | Old Locations by Canvas Coven, licensed under CC BY 4.0. |
| 40 PSX Footsteps | [Hazard Pay](https://hazardpay.itch.io/40-free-psx-crunchy-footsteps) | Royalty-free project use; do not resell or repackage as a standalone pack | Credit appreciated. |
| Backrooms Entity | [Juanjo Sound](https://juanjosound.itch.io/backrooms-entity-sound-effects) | Commercial and noncommercial project use; do not resell as standalone files | Credit appreciated. |
| Ghost Voices | [PD Flattery](https://pd-flattery.itch.io/ghost-voices-sfx-pack) | Project use permitted; commercial kickback appreciated | Ghost Voices SFX Pack by PD Flattery. |
| Echoes of Horror | [Alex Jauk](https://alex-jauk.itch.io/free-sound-package-echoes-of-horror) | Commercial project use allowed; do not redistribute the source pack as-is | Credit appreciated. |
| Free PSX Wind Ambience | Source not verified | Blocked: the supplied archive contains no license/readme and no verified source URL | No attribution can be asserted yet. |

The current checkout contains an audit record for the three wind WAVs only;
their derived `.ogg` outputs intentionally do not exist. The other five source
archives must be staged again before their per-file SHA-256 records and output
paths can be generated. Run the strict gate with:

```bash
python tools/validate_audio_manifest.py --require-complete
```

Pull requests run the non-destructive audit and publish its report; manual and
tagged release workflows enforce the strict completion gate.

After the missing archives are available, place each pack under
`tools/audio-staging/<pack id>/` and run:

```bash
python tools/stage_audio_manifest.py --write
python tools/compress_audio.py --check-only --cleared-only
python tools/compress_audio.py --force --cleared-only
python tools/generate_sound_definitions.py --write
```

Looping beds are split into the declared maximum segment length, encoded as
44100 Hz Ogg Vorbis, and checked for the configured fade handoff and output
size limit. The definition generator updates both `sound_definitions.json` and
the runtime-ready registry only after a complete pack has encoded outputs. The
strict release gate also probes every encoded stream; it fails until all 127
source records are present, cleared, and generated outputs exist.
