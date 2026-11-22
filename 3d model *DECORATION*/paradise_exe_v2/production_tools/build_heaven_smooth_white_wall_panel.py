import sys, io, hashlib, base64, json, pathlib
from PIL import Image
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
sys.path.insert(0, '/home/pasta/Downloads/blockbench')
from views import *
from audit_geometry import audit_full_coverage

ROOT = pathlib.Path('/home/pasta/Downloads/blockbench')
S = ROOT / 'bedrock-samples-v1.26.70.23-preview-full/textures/blocks'
area = 'heaven'
folder = 'smooth_white_wall_panel'
D = ROOT / 'paradise_exe_v2' / area / folder
D.mkdir(parents=True, exist_ok=True)
stem = f'{area}_{folder}_preview'

variants = {
    'smooth': ('quartz_block_bottom.png', 'polished uniform white quartz monolithic wall panel for heaven sanctuary'),
    'chiseled': ('quartz_block_chiseled.png', 'carved neoclassical relief panel with molded framing and geometric meander'),
    'fluted': ('quartz_block_lines.png', 'classical fluted columnation wall pilaster panel'),
    'veined': ('calcite.png', 'fine crystalline veined white marble sanctuary wall panel')
}

manifest = {}
for v_name, (v_src, v_desc) in variants.items():
    raw = (S / v_src).read_bytes()
    assert Image.open(io.BytesIO(raw)).size == (16, 16)
    out_png = D / f'smooth_white_wall_panel_{v_name}.png'
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
    'reference': 'https://www.shutterstock.com/search/white-marble-classical-temple-wall, https://www.alamy.com/stock-photo/ancient-greek-polished-white-wall.html',
    'used': 'heaven sanctuary smooth white wall panel suite featuring monolithic polished quartz, chiseled relief panel, fluted pilaster, and crystalline veined marble',
    'variants': {k: v[1] for k, v in variants.items()},
    'limitations': [
        'original vanilla PNG pixels copied byte-identically without painting or recoloring',
        '2x2 modular preview platform in free format at 1 px/unit scale',
        '100% full face coverage on preview geometry (every face of every cube textured)',
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

# Build 2x2 vertical wall tile preview geometry (4 16x16 blocks at Z=0, facing front)
cs = []
for ix, x in enumerate([-16, 0]):
    for iy, y in enumerate([0, 16]):
        cs.append({'name': f'wall_{ix}_{iy}', 'from': [x, y, -0.5], 'to': [x+16, y+16, 0.5]})
call('place_cube', {'elements': cs, 'faces': False})
dump(D / 'build_elements.json', cs)

# Load primary texture: smooth
call('create_texture', {'name': 'smooth', 'data': str(D / 'smooth_white_wall_panel_smooth.png'), 'uv_width': 16, 'uv_height': 16})

# 100% Full Texture Coverage: Texture every face of every cube
for q in cs:
    faces = {}
    for f, (w, h) in {'north': (16, 16), 'south': (16, 16), 'east': (1, 16), 'west': (1, 16), 'up': (16, 1), 'down': (16, 1)}.items():
        faces[f] = {'uv': [0, 0, w, h], 'texture': 'smooth'}
    call('set_cube_uv', {'id': q['name'], 'box_uv': False, 'faces': faces})

audit = [call('get_cube_uv', {'id': q['name']}) for q in cs]
dump(D / 'uv_audit.json', audit)

# QA Checker shot
check = ROOT / 'bedrock-samples-v1.26.70.23-preview-full/textures/misc/missing_texture.png'
call('create_texture', {'name': '__qa_checker', 'data': str(check), 'uv_width': 16, 'uv_height': 16})
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': '__qa_checker'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 16, 0], {'qa_checker': [0, 16, 40]})
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})
    call('delete_texture', {'texture': '__qa_checker'})

# Capture standard views
views(D, [0, 16, 0], {
    'front': [0, 16, 45],
    'three_quarter': [35, 25, 38],
    'back': [-35, 25, -38],
    'gameplay_scale': [55, 35, 65]
})

# Export preview .bbmodel
call('export_model', {'codec_id': 'project', 'path': str(D / f'{stem}.bbmodel'), 'overwrite': True, 'max_content_length': 0})

# Capture tiled screenshots for each variant
for v_name in variants:
    if v_name != 'smooth':
        tex_path = D / f'smooth_white_wall_panel_{v_name}.png'
        call('create_texture', {'name': v_name, 'data': str(tex_path), 'uv_width': 16, 'uv_height': 16})
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v_name} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 16, 0], {f'{v_name}_tiled_preview': [35, 25, 38]})
    if v_name != 'smooth':
        call('delete_texture', {'texture': v_name})

# Restore primary
for q in audit:
    call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'smooth'} for f, v in q['faces'].items() if v['texture'] is not None}})

# Verify .bbmodel and exported files with 100% full coverage
b = json.loads((D / f'{stem}.bbmodel').read_text())
assert len(b['elements']) == 4
uncovered = audit_full_coverage(b['elements'])
assert len(uncovered) == 0, f"Uncovered faces found: {uncovered}"

# Native save
i = call('get_project_info', {})
uuid = i['project']['uuid']
r = call('risky_eval', {'code': f'(() => {{ if (Project.uuid !== {json.dumps(uuid)}) throw Error("Target changed"); Codecs.project.write(Codecs.project.compile(), {json.dumps(str(D / f"{stem}.bbmodel"))}); return {{saved: Project.saved, path: Project.save_path}}; }})()'})
assert r['saved']

dump(D / 'verification.json', {
    'variants_verified': len(variants),
    'source_byte_identical': True,
    'coverage': '100% full coverage (0 untextured faces)',
    'density': '1 px/unit',
    'tiles': 4,
    'native_save': r,
    'manifest': manifest
})

readme_text = f"""# Heaven — Smooth white wall panel vanilla texture suite
4 texture variants copied byte-for-byte from vanilla Bedrock preview textures:
- smooth: quartz_block_bottom.png
- chiseled: quartz_block_chiseled.png
- fluted: quartz_block_lines.png
- veined: calcite.png

All 16x16 PNG files verified byte-identical.
`{stem}.bbmodel` provides a 2x2 vertical wall preview platform at 1 px/unit scale with 100% full coverage.
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
s = s.replace('Current: **Heaven Smooth white wall panel — IN PROGRESS**', 'Current: **Heaven White column — IN PROGRESS**')
s = s.replace('Next: **Heaven White column**', 'Next: **Heaven Column capital**')

old = '- [ ] Smooth white wall panel; references / paths: pending.\n  - Variants / requirements: texture'
note = f'- [x] Smooth white wall panel — 4 texture variants COMPLETE (smooth, chiseled, fluted, veined). Reference: https://www.shutterstock.com/search/white-marble-classical-temple-wall, https://www.alamy.com/stock-photo/ancient-greek-polished-white-wall.html (heaven sanctuary smooth white wall panel suite with 4 condition states). Saved: [source manifest](heaven/smooth_white_wall_panel/vanilla_sources.json), [editable preview](heaven/smooth_white_wall_panel/{stem}.bbmodel), [smooth](heaven/smooth_white_wall_panel/smooth_white_wall_panel_smooth.png), [chiseled](heaven/smooth_white_wall_panel/smooth_white_wall_panel_chiseled.png), [fluted](heaven/smooth_white_wall_panel/smooth_white_wall_panel_fluted.png), [veined](heaven/smooth_white_wall_panel/smooth_white_wall_panel_veined.png), [tiled screenshots](heaven/smooth_white_wall_panel/three_quarter.png). Vanilla: quartz_block_bottom, quartz_block_chiseled, quartz_block_lines, calcite copied byte-for-byte; 1 px/unit UVs verified; 100% full coverage; native saved preview closed.\n  - Variants / requirements: texture'
assert old in s
t.write_text(s.replace(old, note))

print('Heaven Smooth white wall panel texture suite complete and verified!', flush=True)
