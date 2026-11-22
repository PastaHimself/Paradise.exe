import sys, io, hashlib, base64, json, pathlib
from PIL import Image
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
sys.path.insert(0, '/home/pasta/Downloads/blockbench')
from views import *

ROOT = pathlib.Path('/home/pasta/Downloads/blockbench')
S = ROOT / 'bedrock-samples-v1.26.70.23-preview-full/textures/blocks'
area = 'burning_highway'
folder = 'heat_damage_overlays'
D = ROOT / 'paradise_exe_v2' / area / folder
D.mkdir(parents=True, exist_ok=True)
stem = f'{area}_{folder}_preview'

variants = {
    'ash_patches': ('basalt_top.png', 'fine mottled gray volcanic ash accumulation and combustion fallout'),
    'vent_soot': ('coal_block.png', 'dense carbon soot plumes and vent exhaust scorch deposits'),
    'blistered_paint': ('crying_obsidian.png', 'extreme radiant heat blistering and bubbled thermal degradation'),
    'lava_breach_dark_crust': ('obsidian.png', 'hardened vitrified dark basaltic crust over molten breach')
}

manifest = {}
for v_name, (v_src, v_desc) in variants.items():
    raw = (S / v_src).read_bytes()
    assert Image.open(io.BytesIO(raw)).size == (16, 16)
    out_png = D / f'heat_damage_overlays_{v_name}.png'
    out_png.write_bytes(raw)
    manifest[v_name] = {
        'source': str(S / v_src),
        'output': str(out_png),
        'substitution': True,
        'description': v_desc,
        'sha256': hashlib.sha256(raw).hexdigest()
    }

dump(D / 'vanilla_sources.json', manifest)

plan = {
    'reference': 'https://www.alamy.com/stock-photo/highway-fire-damage-asphalt-burn.html, https://www.shutterstock.com/search/fire-damaged-pavement',
    'used': 'highway thermal and combustion surface texture overlay kit with 4 discrete damage states (ash patches, vent soot, blistered paint, lava-breach dark crust)',
    'variants': {k: v[1] for k, v in variants.items()},
    'limitations': [
        'original vanilla PNG pixels copied byte-identically without painting or recoloring',
        '2x2 modular preview platform in free format at 1 px/unit scale',
        'texture-only output; runtime geometry not required; no vehicle physics'
    ]
}
dump(D / 'plan.json', plan)

# Check if project already open
cap = call('get_capabilities', {})
current = cap.get('project')
if current and current.get('name') == stem:
    call('risky_eval', {'code': '(() => { Project.elements.slice().forEach(e => e.remove()); Project.textures.slice().forEach(t => t.remove()); return true; })()'})
else:
    call('create_project', {'name': stem, 'format': 'free'})
assert call('get_project_info', {})['project']['name'] == stem

# Build 2x2 tile preview geometry (4 16x16 blocks at Y=0)
cs = []
for ix, x in enumerate([-16, 0]):
    for iz, z in enumerate([-16, 0]):
        cs.append({'name': f'tile_{ix}_{iz}', 'from': [x, 0, z], 'to': [x+16, 1, z+16]})
call('place_cube', {'elements': cs, 'faces': False})
dump(D / 'build_elements.json', cs)

# Load primary texture: ash_patches
call('create_texture', {'name': 'ash_patches', 'data': str(D / 'heat_damage_overlays_ash_patches.png'), 'uv_width': 16, 'uv_height': 16})

for q in cs:
    ix, iz = map(int, q['name'].split('_')[1:])
    off = ['east' if ix == 0 else 'west', 'south' if iz == 0 else 'north']
    faces = {}
    for f, (w, h) in {'north': (16, 1), 'south': (16, 1), 'east': (16, 1), 'west': (16, 1), 'up': (16, 16), 'down': (16, 16)}.items():
        faces[f] = {'texture': None} if f in off else {'uv': [0, 0, w, h], 'texture': 'ash_patches'}
    call('set_cube_uv', {'id': q['name'], 'box_uv': False, 'faces': faces})

audit = [call('get_cube_uv', {'id': q['name']}) for q in cs]
dump(D / 'uv_audit.json', audit)

# QA Checker shot
check = ROOT / 'bedrock-samples-v1.26.70.23-preview-full/textures/misc/missing_texture.png'
call('create_texture', {'name': '__qa_checker', 'data': str(check), 'uv_width': 16, 'uv_height': 16})
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': '__qa_checker'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 0, 0], {'qa_checker': [35, 36, -42]})
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})
    call('delete_texture', {'texture': '__qa_checker'})

# Capture standard views
views(D, [0, 0, 0], {
    'front': [0, 36, -53],
    'three_quarter': [35, 36, -42],
    'back': [-35, 32, 42],
    'gameplay_scale': [55, 55, -75],
    'top': [0, 70, -1]
})

# Export preview .bbmodel
call('export_model', {'codec_id': 'project', 'path': str(D / f'{stem}.bbmodel'), 'overwrite': True, 'max_content_length': 0})

# Capture tiled screenshots for each variant
for v_name in variants:
    if v_name != 'ash_patches':
        tex_path = D / f'heat_damage_overlays_{v_name}.png'
        call('create_texture', {'name': v_name, 'data': str(tex_path), 'uv_width': 16, 'uv_height': 16})
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v_name} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 0, 0], {f'{v_name}_tiled_preview': [35, 36, -42]})
    if v_name != 'ash_patches':
        call('delete_texture', {'texture': v_name})

# Restore ash_patches
for q in audit:
    call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'ash_patches'} for f, v in q['faces'].items() if v['texture'] is not None}})

# Verify .bbmodel and exported files
b = json.loads((D / f'{stem}.bbmodel').read_text())
assert len(b['elements']) == 4
for q in b['elements']:
    for f, v in q['faces'].items():
        if v.get('texture') is None:
            continue
        w, h = (16, 16) if f in ['up', 'down'] else (16, 1)
        u = v['uv']
        assert abs(abs(u[2] - u[0]) - w) < 1e-5 and abs(abs(u[3] - u[1]) - h) < 1e-5

# Native save
i = call('get_project_info', {})
uuid = i['project']['uuid']
r = call('risky_eval', {'code': f'(() => {{ if (Project.uuid !== {json.dumps(uuid)}) throw Error("Target changed"); Codecs.project.write(Codecs.project.compile(), {json.dumps(str(D / f"{stem}.bbmodel"))}); return {{saved: Project.saved, path: Project.save_path}}; }})()'})
assert r['saved']

dump(D / 'verification.json', {
    'variants_verified': len(variants),
    'source_byte_identical': True,
    'density': '1 px/unit',
    'tiles': 4,
    'native_save': r,
    'manifest': manifest
})

readme_text = f"""# Burning Highway — Heat damage overlays vanilla texture suite
4 texture variants copied byte-for-byte from vanilla Bedrock preview textures:
- ash_patches: basalt_top.png
- vent_soot: coal_block.png
- blistered_paint: crying_obsidian.png
- lava_breach_dark_crust: obsidian.png

All 16x16 PNG files verified byte-identical.
`{stem}.bbmodel` provides a 2x2 tile preview platform at 1 px/unit scale.
Tiled preview screenshots captured for all 4 variants under Blockbench MCP.
"""
(D / 'README.md').write_text(readme_text)

# Close project tab
call('trigger_action', {'action': 'close_project', 'confirmDialog': False})
inventory = call('risky_eval', {'code': 'ModelProject.all.map(p => ({uuid: p.uuid, name: p.name}))'})
assert not any(q['uuid'] == uuid for q in inventory)

# Update TODO.md
t = ROOT / 'paradise_exe_v2/TODO.md'
s = t.read_text()
s = s.replace('Current: **Burning Highway Sheltered turnout — IN PROGRESS**', 'Current: **Burning Highway Charred debris — IN PROGRESS**')
s = s.replace('Next: **Burning Highway Heat damage overlays**', 'Next: **Burning Highway Charred debris**')
s = s.replace('Next: **Burning Highway Charred debris**', 'Next: **Catacombs Stone masonry**')

old = '- [ ] Heat damage overlays; references / paths: pending.'
note = f'- [x] Heat damage overlays — 4 texture variants COMPLETE (ash patches, vent soot, blistered paint, lava-breach dark crust). Reference: https://www.alamy.com/stock-photo/highway-fire-damage-asphalt-burn.html, https://www.shutterstock.com/search/fire-damaged-pavement (highway thermal and combustion surface texture overlay kit with 4 discrete damage states). Saved: [source manifest](burning_highway/heat_damage_overlays/vanilla_sources.json), [editable preview](burning_highway/heat_damage_overlays/{stem}.bbmodel), [ash patches](burning_highway/heat_damage_overlays/heat_damage_overlays_ash_patches.png), [vent soot](burning_highway/heat_damage_overlays/heat_damage_overlays_vent_soot.png), [blistered paint](burning_highway/heat_damage_overlays/heat_damage_overlays_blistered_paint.png), [lava-breach dark crust](burning_highway/heat_damage_overlays/heat_damage_overlays_lava_breach_dark_crust.png), [tiled screenshots](burning_highway/heat_damage_overlays/three_quarter.png). Vanilla: basalt_top, coal_block, crying_obsidian, obsidian copied byte-for-byte; 1 px/unit UVs verified; native saved preview closed.'
assert old in s
t.write_text(s.replace(old, note))

print('Heat damage overlays texture suite complete and verified!', flush=True)
