import sys
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
from pipeline import *
from checker import checker
from audit_geometry import check_z_fighting_and_collisions

cs = []
a = {}
def c(n, lo, hi, m, off=[]):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, off, False)

# Catacombs: Low archway
# Heavy, low subterranean stone masonry archway connecting cramped crypt galleries.
# 1. Low thick masonry jambs (Y: 0.0 to 9.0)
c('jamb_l', [-9.0, 0.0, -3.0], [-5.0, 9.0, 3.0], 'ashlar_stone')
c('jamb_r', [5.0, 0.0, -3.0], [9.0, 9.0, 3.0], 'ashlar_stone')

# 2. Impost springer bands (Y: 9.0 to 10.0)
c('impost_l', [-9.5, 9.0, -3.2], [-4.5, 10.0, 3.2], 'carved_stone')
c('impost_r', [4.5, 9.0, -3.2], [9.5, 10.0, 3.2], 'carved_stone')

# 3. Stepped low arch voussoirs (Y: 10.0 to 14.5)
c('springer_l', [-6.5, 10.0, -2.8], [-3.5, 12.0, 2.8], 'cracked_stone')
c('springer_r', [3.5, 10.0, -2.8], [6.5, 12.0, 2.8], 'cracked_stone')
c('arch_crown', [-3.5, 12.0, -2.8], [3.5, 14.5, 2.8], 'ashlar_stone')

# 4. Keystone bosses (Front and Back up to Y: 14.5)
c('keystone_front', [-1.4, 11.5, 2.8], [1.4, 14.5, 3.4], 'carved_stone')
c('keystone_back', [-1.4, 11.5, -3.4], [1.4, 14.5, -2.8], 'carved_stone')

# 5. Spandrel walls above jambs
c('spandrel_l', [-9.0, 10.0, -2.5], [-6.5, 14.5, 2.5], 'cracked_stone')
c('spandrel_r', [6.5, 10.0, -2.5], [9.0, 14.5, 2.5], 'cracked_stone')
c('spandrel_mid_l', [-6.5, 12.0, -2.5], [-3.5, 14.5, 2.5], 'ashlar_stone')
c('spandrel_mid_r', [3.5, 12.0, -2.5], [6.5, 14.5, 2.5], 'ashlar_stone')

# 6. Top cornice beam (Y: 14.5 to 16.0)
c('cornice', [-9.5, 14.5, -3.0], [9.5, 16.0, 3.0], 'ashlar_stone')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'ashlar_stone': (0, 0, 'stonebrick.png', 16, 16),
    'cracked_stone': (16, 0, 'stonebrick_cracked.png', 16, 16),
    'carved_stone': (32, 0, 'stonebrick_carved.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/low-stone-archway-catacomb-crypt, https://www.alamy.com/stock-photo/ancient-underground-tunnel-vault.html',
    'used': 'ancient subterranean catacombs low archway heavy squat masonry passage portal connecting narrow burial corridors with massive ashlar jambs, molded impost blocks, stepped segmental arch ring, carved keystones, and top lintel cornice',
    'limitations': [
        'modular 19-unit wide low archway portal fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original stonebrick, stonebrick_cracked, stonebrick_carved pixels unchanged; dry and damp/mossy variants'
    ]
}

D = build('low_archway', cs, a, regions, plan, area='catacombs')

checker(D, [0, 8.0, 0], [22, 18, 22])
views(D, [0, 8.0, 0], {
    'front': [0, 8.0, 20],
    'three_quarter': [18, 14, 18],
    'back': [-18, 14, -18],
    'gameplay_scale': [26, 20, 26],
    'keystone_close': [0, 13.0, 7.0],
    'jamb_close': [-7.0, 5.0, 7.0]
})

# Create damp / mossy variant texture and views
im_mossy = Image.open(D/'low_archway.png').convert('RGBA')
im_mossy.paste(Image.open(S/'stonebrick_mossy.png').convert('RGBA'), (0, 0))
im_mossy.paste(Image.open(S/'stonebrick_mossy.png').convert('RGBA'), (16, 0))
im_mossy.paste(Image.open(S/'stonebrick_carved.png').convert('RGBA'), (32, 0))
im_mossy.save(D/'low_archway_damp.png')
(D/'low_archway_dry.png').write_bytes((D/'low_archway.png').read_bytes())

call('create_texture', {'name': 'low_archway_damp', 'data': str(D/'low_archway_damp.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'low_archway_damp'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 8.0, 0], {
        'front_damp': [0, 8.0, 20],
        'three_quarter_damp': [18, 14, 18]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Normal finish (exports models, verifies UVs, closes project tab)
finish('low_archway', 'Low archway', 'Blocked arch with loose stones', 'Sealed stone doorway', area='catacombs')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['dry', 'damp_mossy'],
    'textures': ['low_archway.png', 'low_archway_damp.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'keystone_close.png', 'jamb_close.png', 'front_damp.png', 'three_quarter_damp.png']
}, indent=2))

print("Catacombs Low archway complete and verified with 100% full coverage!")
