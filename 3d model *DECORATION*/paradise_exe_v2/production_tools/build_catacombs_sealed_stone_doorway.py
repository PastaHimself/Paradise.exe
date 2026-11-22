import sys
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
from pipeline import *
from checker import checker
from audit_geometry import check_z_fighting_and_collisions

cs = []
a = {}
def c(n, lo, hi, m):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, [], False)

# Catacombs: Sealed stone doorway
# 1. Footings & Sill (Y: 0.0 to 1.5)
c('footing_l', [-9.5, 0.0, -2.8], [-5.0, 1.5, 2.8], 'ashlar_stone')
c('footing_r', [5.0, 0.0, -2.8], [9.5, 1.5, 2.8], 'ashlar_stone')
c('sill', [-5.0, 0.0, -2.0], [5.0, 1.5, 2.0], 'cracked_stone')

# 2. Portal Jambs (Y: 1.5 to 16.5)
c('jamb_l', [-9.0, 1.5, -2.5], [-5.5, 16.5, 2.5], 'ashlar_stone')
c('jamb_r', [5.5, 1.5, -2.5], [9.0, 16.5, 2.5], 'ashlar_stone')
c('reveal_l', [-5.5, 1.5, -2.2], [-4.5, 16.5, 2.2], 'cracked_stone')
c('reveal_r', [4.5, 1.5, -2.2], [5.5, 16.5, 2.2], 'cracked_stone')

# 3. Lintel & Cornice (Y: 16.5 to 20.0)
c('lintel', [-9.5, 16.5, -2.8], [9.5, 19.0, 2.8], 'ashlar_stone')
c('cornice', [-10.0, 19.0, -3.0], [10.0, 20.0, 3.0], 'ashlar_stone')

# 4. Sealed Door Slabs (Opening X: [-4.5, 4.5], Y: [1.5, 16.5], Z: [-1.2, 1.2])
c('slab_lower', [-4.5, 1.5, -1.2], [4.5, 6.0, 1.2], 'ashlar_stone')
c('slab_mid', [-4.5, 6.0, -1.2], [4.5, 11.5, 1.2], 'cracked_stone')
c('slab_upper', [-4.5, 11.5, -1.2], [4.5, 16.5, 1.2], 'ashlar_stone')

# 5. Crypt Seal Medallions (Front and Back)
c('seal_front', [-1.8, 7.2, 1.2], [1.8, 10.8, 1.8], 'carved_stone')
c('seal_back', [-1.8, 7.2, -1.8], [1.8, 10.8, -1.2], 'carved_stone')

# 6. Exterior Mortar Sealing Beaded Strips
c('mortar_strip_1_l', [-4.5, 5.8, 1.2], [-1.8, 6.2, 1.4], 'lime_mortar')
c('mortar_strip_1_r', [1.8, 5.8, 1.2], [4.5, 6.2, 1.4], 'lime_mortar')
c('mortar_strip_2_l', [-4.5, 11.3, 1.2], [-1.8, 11.7, 1.4], 'lime_mortar')
c('mortar_strip_2_r', [1.8, 11.3, 1.2], [4.5, 11.7, 1.4], 'lime_mortar')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'ashlar_stone': (0, 0, 'stonebrick.png', 16, 16),
    'cracked_stone': (16, 0, 'stonebrick_cracked.png', 16, 16),
    'carved_stone': (32, 0, 'stonebrick_carved.png', 16, 16),
    'lime_mortar': (48, 0, 'calcite.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/sealed-stone-crypt-door-catacombs, https://www.alamy.com/stock-photo/ancient-tomb-sealed-entrance.html',
    'used': 'ancient subterranean catacombs sealed stone doorway monumental crypt entrance sealed shut with dressed ashlar slabs, lime mortar joint caulking, molded jambs, heavy lintel cornice, and carved protective crypt seals',
    'limitations': [
        'modular 20-unit wide sealed crypt doorway portal fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original stonebrick, stonebrick_cracked, stonebrick_carved, calcite pixels unchanged; dry and damp/mossy variants'
    ]
}

D = build('sealed_stone_doorway', cs, a, regions, plan, area='catacombs')

checker(D, [0, 10.0, 0], [22, 22, 22])
views(D, [0, 10.0, 0], {
    'front': [0, 10.0, 22],
    'three_quarter': [18, 16, 18],
    'back': [-18, 16, -18],
    'gameplay_scale': [26, 22, 26],
    'seal_close': [0, 9.0, 6.0],
    'lintel_close': [0, 18.0, 7.0]
})

# Create damp / mossy variant texture and views
im_mossy = Image.open(D/'sealed_stone_doorway.png').convert('RGBA')
im_mossy.paste(Image.open(S/'stonebrick_mossy.png').convert('RGBA'), (0, 0))
im_mossy.paste(Image.open(S/'stonebrick_mossy.png').convert('RGBA'), (16, 0))
im_mossy.paste(Image.open(S/'stonebrick_carved.png').convert('RGBA'), (32, 0))
im_mossy.paste(Image.open(S/'calcite.png').convert('RGBA'), (48, 0))
im_mossy.save(D/'sealed_stone_doorway_damp.png')
(D/'sealed_stone_doorway_dry.png').write_bytes((D/'sealed_stone_doorway.png').read_bytes())

call('create_texture', {'name': 'sealed_stone_doorway_damp', 'data': str(D/'sealed_stone_doorway_damp.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'sealed_stone_doorway_damp'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 10.0, 0], {
        'front_damp': [0, 10.0, 22],
        'three_quarter_damp': [18, 16, 18]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Normal finish (exports models, verifies UVs, closes project tab)
finish('sealed_stone_doorway', 'Sealed stone doorway', 'Cracked clue panel', 'Open-passage frame', area='catacombs')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['dry', 'damp_mossy'],
    'textures': ['sealed_stone_doorway.png', 'sealed_stone_doorway_damp.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'seal_close.png', 'lintel_close.png', 'front_damp.png', 'three_quarter_damp.png']
}, indent=2))

print("Catacombs Sealed stone doorway complete and verified with 100% full coverage!")
