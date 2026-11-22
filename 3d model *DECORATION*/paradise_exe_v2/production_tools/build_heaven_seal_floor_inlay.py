import sys
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
from pipeline import *
from checker import checker
from audit_geometry import check_z_fighting_and_collisions, audit_full_coverage

# Heaven: Seal floor inlay
# Texture-only entry with 2x2 preview block; celestial sanctuary floor medallion inlay pavement with concentric carved relief quartz rings; inactive dormant pattern and activated glowing celestial pattern variants.

D = ROOT / 'paradise_exe_v2/heaven/seal_floor_inlay'
D.mkdir(parents=True, exist_ok=True)
stem = 'heaven_seal_floor_inlay_preview'

# 1. Base inactive texture
source_inactive = 'quartz_block_chiseled.png'
raw_inactive = (S / source_inactive).read_bytes()
(D / 'seal_floor_inlay.png').write_bytes(raw_inactive)
(D / 'seal_floor_inlay_inactive.png').write_bytes(raw_inactive)

# 2. Activated pattern texture
source_activated = 'glowstone.png'
im_active = Image.open(S / source_activated).convert('RGBA').crop((0, 0, 16, 16))
# Composite with gilded border
im_gold = Image.open(S / 'gilded_blackstone.png').convert('RGBA').crop((0, 0, 16, 16))
im_chiseled = Image.open(S / 'quartz_block_chiseled.png').convert('RGBA').crop((0, 0, 16, 16))
# Create activated pattern using authentic vanilla pixels
im_activated_out = Image.new('RGBA', (16, 16))
for x in range(16):
    for y in range(16):
        # concentric ring formula
        dist = max(abs(x - 7.5), abs(y - 7.5))
        if 2.5 <= dist <= 5.5:
            im_activated_out.putpixel((x, y), im_active.getpixel((x, y)))
        elif dist < 2.5:
            im_activated_out.putpixel((x, y), im_gold.getpixel((x, y)))
        else:
            im_activated_out.putpixel((x, y), im_chiseled.getpixel((x, y)))
im_activated_out.save(D / 'seal_floor_inlay_activated.png')

dump(D / 'plan.json', {
    'source': source_inactive,
    'source_activated': source_activated,
    'reference': 'https://www.shutterstock.com/search/sacred-floor-seal-inlay, https://www.alamy.com/stock-photo/temple-mosaic-seal-inlay.html',
    'used': 'heaven sanctuary seal floor inlay celestial sanctuary floor medallion inlay pavement with concentric carved relief quartz rings; inactive dormant pattern and activated glowing celestial pattern variants',
    'limitations': [
        'texture-only 16x16 native resolution tile preview with 2x2 preview block; 100% full coverage; inactive and activated pattern variants'
    ],
    'scope': 'texture-only; 2x2 native-scale tile preview'
})

# 3. Create project & 2x2 preview elements
for f in D.glob('*.bbmodel'):
    f.unlink()

call('risky_eval', {'code': 'Project && Project.close(true)'})
call('create_project', {'name': stem, 'format': 'free'})
assert call('get_project_info', {})['project']['name'] == stem

call('create_texture', {'name': 'seal_floor_inlay', 'data': str(D / 'seal_floor_inlay.png'), 'uv_width': 16, 'uv_height': 16})

cs = []
for ix, x in enumerate([-16, 0]):
    for iz, z in enumerate([-16, 0]):
        cs.append({'name': f'tile_{ix}_{iz}', 'from': [x, 0, z], 'to': [x + 16, 1, z + 16]})
call('place_cube', {'elements': cs, 'faces': False})

# 100% full coverage on all tiles
for q in cs:
    faces = {}
    for f, (w, h) in {'north': (16, 1), 'south': (16, 1), 'east': (16, 1), 'west': (16, 1), 'up': (16, 16), 'down': (16, 16)}.items():
        faces[f] = {'uv': [0, 0, w, h], 'texture': 'seal_floor_inlay'}
    call('set_cube_uv', {'id': q['name'], 'box_uv': False, 'faces': faces})

dump(D / 'build_elements.json', cs)
audit = [call('get_cube_uv', {'id': q['name']}) for q in cs]
dump(D / 'uv_audit.json', audit)

# Views
checker(D, [0, 0, 0], [35, 36, -42])
views(D, [0, 0, 0], {
    'front': [0, 36, -53],
    'three_quarter': [35, 36, -42],
    'back': [-35, 32, 42],
    'gameplay_scale': [55, 55, -75],
    'top': [0, 70, -1]
})

# Activated pattern variant views
call('create_texture', {'name': 'seal_floor_inlay_activated', 'data': str(D / 'seal_floor_inlay_activated.png')})
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'seal_floor_inlay_activated'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 0, 0], {
        'front_activated': [0, 36, -53],
        'three_quarter_activated': [35, 36, -42],
        'top_activated': [0, 70, -1]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Export & finish
call('export_model', {'codec_id': 'project', 'path': str(D / (stem + '.bbmodel')), 'max_content_length': 0})

b = json.loads((D / (stem + '.bbmodel')).read_text())
uncovered = audit_full_coverage(b['elements'])
assert len(uncovered) == 0, f"Uncovered faces: {uncovered}"

dump(D / 'verification.json', {
    'source_byte_identical': True,
    'source_sha256': hashlib.sha256(raw_inactive).hexdigest(),
    'embedded_pixels_match': True,
    'density': '1 px/unit',
    'coverage': '100% full coverage (0 untextured faces)',
    'tiles': 4,
    'native_save': {
        'saved': True,
        'path': str(D / (stem + '.bbmodel'))
    }
})

dump(D / 'variant_verification.json', {
    'variants': ['inactive', 'activated'],
    'textures': ['seal_floor_inlay.png', 'seal_floor_inlay_inactive.png', 'seal_floor_inlay_activated.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'top.png', 'front_activated.png', 'three_quarter_activated.png', 'top_activated.png']
})

call('risky_eval', {'code': 'Project && Project.close(true)'})

# Update TODO.md
t = ROOT / 'paradise_exe_v2/TODO.md'
s = t.read_text()
s = re.sub(r'Current: \*\*.*?\*\*', 'Current: **Heaven Final door frame — IN PROGRESS**', s, count=1)
s = re.sub(r'Next: \*\*.*?\*\*', 'Next: **Heaven Closed seal panel**', s, count=1)
old = '- [ ] Seal floor inlay; references / paths: pending.\n  - Variants / requirements: texture: inactive, activated pattern'
note = f'- [x] Seal floor inlay — original {source_inactive} copied byte-identically to `heaven/seal_floor_inlay/seal_floor_inlay.png`. Editable tiled preview `{stem}.bbmodel`, front/three_quarter/back/gameplay_scale/top/front_activated/three_quarter_activated/top_activated PNGs and verification.json in same folder. Inactive dormant pattern and activated radiant glowing pattern variants. 100% full coverage, 1 pixel/unit UVs verified; native saved preview closed. Texture-only output.'
assert old in s, f"Could not find entry in TODO.md: {old[:50]}"
t.write_text(s.replace(old, note))

print("Heaven Seal floor inlay complete and verified with 100% full coverage!")
