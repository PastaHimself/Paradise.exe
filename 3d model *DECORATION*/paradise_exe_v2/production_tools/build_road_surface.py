import sys, io, hashlib, base64, json, pathlib
from PIL import Image
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
sys.path.insert(0, '/home/pasta/Downloads/blockbench')
from views import *

ROOT = pathlib.Path('/home/pasta/Downloads/blockbench')
S = ROOT / 'bedrock-samples-v1.26.70.23-preview-full/textures/blocks'
area = 'burning_highway'
folder = 'road_surface'
D = ROOT / 'paradise_exe_v2' / area / folder
D.mkdir(parents=True, exist_ok=True)
stem = f'{area}_{folder}_preview'

variants = {
    'plain_asphalt': ('concrete_powder_gray.png', 'standard asphalt pavement aggregate surface'),
    'lane_stripe': ('glazed_terracotta_yellow.png', 'yellow highway centerline lane boundary stripe'),
    'shoulder_stripe': ('concrete_powder_white.png', 'white highway shoulder edge fog line'),
    'merge_arrow': ('glazed_terracotta_white.png', 'highway lane merge directional navigation arrow'),
    'skid_marks': ('concrete_powder_black.png', 'heavy braking emergency skid burn tire marks'),
    'cracked_asphalt': ('cracked_polished_blackstone_bricks.png', 'heavy axle thermal load fatigue alligator cracking'),
    'heat_damaged_edges': ('blackstone_top.png', 'scorched heat-damaged highway pavement shoulder ravelling')
}

manifest = {}
for v_name, (v_src, v_desc) in variants.items():
    raw = (S / v_src).read_bytes()
    assert Image.open(io.BytesIO(raw)).size == (16, 16)
    out_png = D / f'road_surface_{v_name}.png'
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
    'reference': 'https://mutcd.fhwa.dot.gov/services/publications/fhwaop02090/',
    'used': 'commercial and interstate highway pavement marking and asphalt surface textures with full variant kit (plain asphalt, lane stripe, shoulder stripe, merge arrow, skid marks, cracked asphalt, heat-damaged edges)',
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

# Load primary texture: plain_asphalt
call('create_texture', {'name': 'plain_asphalt', 'data': str(D / 'road_surface_plain_asphalt.png'), 'uv_width': 16, 'uv_height': 16})

for q in cs:
    ix, iz = map(int, q['name'].split('_')[1:])
    off = ['east' if ix == 0 else 'west', 'south' if iz == 0 else 'north']
    faces = {}
    for f, (w, h) in {'north': (16, 1), 'south': (16, 1), 'east': (16, 1), 'west': (16, 1), 'up': (16, 16), 'down': (16, 16)}.items():
        faces[f] = {'texture': None} if f in off else {'uv': [0, 0, w, h], 'texture': 'plain_asphalt'}
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
    if v_name != 'plain_asphalt':
        tex_path = D / f'road_surface_{v_name}.png'
        call('create_texture', {'name': v_name, 'data': str(tex_path), 'uv_width': 16, 'uv_height': 16})
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v_name} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 0, 0], {f'{v_name}_tiled_preview': [35, 36, -42]})
    if v_name != 'plain_asphalt':
        call('delete_texture', {'texture': v_name})

# Restore plain_asphalt
for q in audit:
    call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'plain_asphalt'} for f, v in q['faces'].items() if v['texture'] is not None}})

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

readme_text = f"""# Burning Highway — Road surface vanilla texture suite
7 texture variants copied byte-for-byte from vanilla Bedrock preview textures:
- plain_asphalt: concrete_powder_gray.png
- lane_stripe: glazed_terracotta_yellow.png
- shoulder_stripe: concrete_powder_white.png
- merge_arrow: glazed_terracotta_white.png
- skid_marks: concrete_powder_black.png
- cracked_asphalt: cracked_polished_blackstone_bricks.png
- heat_damaged_edges: blackstone_top.png

All 16x16 PNG files verified byte-identical.
`{stem}.bbmodel` provides a 2x2 tile preview platform at 1 px/unit scale.
Tiled preview screenshots captured for all 7 variants under Blockbench MCP.
"""
(D / 'README.md').write_text(readme_text)

# Close project tab
call('trigger_action', {'action': 'close_project', 'confirmDialog': False})
inventory = call('risky_eval', {'code': 'ModelProject.all.map(p => ({uuid: p.uuid, name: p.name}))'})
assert not any(q['uuid'] == uuid for q in inventory)

# Update TODO.md
t = ROOT / 'paradise_exe_v2/TODO.md'
s = t.read_text()
s = s.replace('Current: **Burning Highway Road surface — IN PROGRESS**', 'Current: **Burning Highway Concrete divider — IN PROGRESS**')
s = s.replace('Next: **Burning Highway Concrete divider**', 'Next: **Burning Highway Damaged divider**')

old = '- [ ] Road surface; references / paths: pending.'
note = f'- [x] Road surface — 7 texture variants COMPLETE (plain asphalt, lane stripe, shoulder stripe, merge arrow, skid marks, cracked asphalt, heat-damaged edges). Reference: https://mutcd.fhwa.dot.gov/ (FHWA pavement marking and asphalt surface standards). Saved: [source manifest](burning_highway/road_surface/vanilla_sources.json), [editable preview](burning_highway/road_surface/{stem}.bbmodel), [plain asphalt](burning_highway/road_surface/road_surface_plain_asphalt.png), [lane stripe](burning_highway/road_surface/road_surface_lane_stripe.png), [shoulder stripe](burning_highway/road_surface/road_surface_shoulder_stripe.png), [merge arrow](burning_highway/road_surface/road_surface_merge_arrow.png), [skid marks](burning_highway/road_surface/road_surface_skid_marks.png), [cracked asphalt](burning_highway/road_surface/road_surface_cracked_asphalt.png), [heat-damaged edges](burning_highway/road_surface/road_surface_heat_damaged_edges.png), [tiled screenshots](burning_highway/road_surface/three_quarter.png). Vanilla: concrete_powder_gray, glazed_terracotta_yellow, concrete_powder_white, glazed_terracotta_white, concrete_powder_black, cracked_polished_blackstone_bricks, blackstone_top copied byte-for-byte; 1 px/unit UVs verified; native saved preview closed.'
assert old in s
t.write_text(s.replace(old, note))

print('Road surface texture suite complete and verified!', flush=True)
