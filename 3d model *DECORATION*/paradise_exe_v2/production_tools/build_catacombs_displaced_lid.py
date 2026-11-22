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

# Catacombs: Displaced lid
# 1. Base footing plinth (Y: 0.0 to 1.5)
c('base_plinth', [-11.5, 0.0, -6.5], [11.5, 1.5, 6.5], 'ashlar_stone')

# 2. Sarcophagus Chest (hollow open basin, walls Y: 1.5 to 9.5)
c('basin_bottom', [-11.0, 1.5, -6.0], [11.0, 3.0, 6.0], 'ashlar_stone')
c('wall_front', [-11.0, 3.0, 4.5], [11.0, 9.5, 6.0], 'ashlar_stone')
c('wall_back', [-11.0, 3.0, -6.0], [11.0, 9.5, -4.5], 'ashlar_stone')
c('wall_left', [-11.0, 3.0, -4.5], [-9.5, 9.5, 4.5], 'ashlar_stone')
c('wall_right', [9.5, 3.0, -4.5], [11.0, 9.5, 4.5], 'ashlar_stone')

# 3. Relics in bottom of open basin
c('relic_skull', [-7.0, 3.0, -1.2], [-4.2, 5.6, 1.6], 'bone_relic')
c('coffin_bones', [-3.5, 3.0, -2.0], [6.0, 3.8, 2.0], 'bone_relic')

# 4. Displaced Sarcophagus Lid (slid diagonally across right / front rim: X: [-4.0, 13.5], Z: [-2.0, 7.5])
c('lid_cornice', [-4.0, 9.5, -2.0], [13.5, 11.2, 7.5], 'ashlar_stone')
c('lid_mid_tier', [-2.8, 11.2, -0.8], [12.2, 12.6, 6.2], 'cracked_stone')
c('lid_ridge', [-2.0, 12.6, 0.0], [11.5, 13.8, 5.5], 'ashlar_stone')

# 5. Lid finials at corners
c('finial_nw', [-4.0, 11.2, -2.0], [-2.8, 12.8, -0.8], 'carved_stone')
c('finial_ne', [12.2, 11.2, -2.0], [13.5, 12.8, -0.8], 'carved_stone')
c('finial_sw', [-4.0, 11.2, 6.2], [-2.8, 12.8, 7.5], 'carved_stone')
c('finial_se', [12.2, 11.2, 6.2], [13.5, 12.8, 7.5], 'carved_stone')

# 6. Chipped stone fragments on floor
c('chip_1', [8.0, 0.0, 7.0], [9.8, 0.9, 8.5], 'cracked_stone')
c('chip_2', [-8.5, 0.0, 6.8], [-7.0, 0.7, 8.0], 'cracked_stone')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'ashlar_stone': (0, 0, 'stonebrick.png', 16, 16),
    'cracked_stone': (16, 0, 'stonebrick_cracked.png', 16, 16),
    'carved_stone': (32, 0, 'stonebrick_carved.png', 16, 16),
    'bone_relic': (48, 0, 'bone_block_side.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/open-ancient-sarcophagus-crypt-tomb, https://www.alamy.com/stock-photo/opened-stone-sarcophagus-displaced-lid.html',
    'used': 'ancient subterranean catacombs displaced lid opened and looted stone burial sarcophagus with heavy lid slid askew diagonally across the rim revealing dark interior cavity and resting bone cranium relics within',
    'limitations': [
        'modular 25-unit wide open sarcophagus with displaced lid fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original stonebrick, stonebrick_cracked, stonebrick_carved, bone_block_side pixels unchanged; dry and damp/mossy variants'
    ]
}

D = build('displaced_lid', cs, a, regions, plan, area='catacombs')

checker(D, [0, 7.0, 0], [28, 20, 22])
views(D, [0, 7.0, 0], {
    'front': [0, 7.0, 24],
    'three_quarter': [20, 16, 20],
    'back': [-20, 16, -20],
    'gameplay_scale': [28, 22, 28],
    'open_cavity_close': [0, 8.0, 8.0],
    'slid_lid_close': [8.0, 12.0, 8.0]
})

# Create damp / mossy variant texture and views
im_mossy = Image.open(D/'displaced_lid.png').convert('RGBA')
im_mossy.paste(Image.open(S/'stonebrick_mossy.png').convert('RGBA'), (0, 0))
im_mossy.paste(Image.open(S/'stonebrick_mossy.png').convert('RGBA'), (16, 0))
im_mossy.paste(Image.open(S/'stonebrick_carved.png').convert('RGBA'), (32, 0))
im_mossy.save(D/'displaced_lid_damp.png')
(D/'displaced_lid_dry.png').write_bytes((D/'displaced_lid.png').read_bytes())

call('create_texture', {'name': 'displaced_lid_damp', 'data': str(D/'displaced_lid_damp.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'displaced_lid_damp'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 7.0, 0], {
        'front_damp': [0, 7.0, 24],
        'three_quarter_damp': [20, 16, 20]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Normal finish (exports models, verifies UVs, closes project tab)
finish('displaced_lid', 'Displaced lid', 'Urn', 'Inscription slab', area='catacombs')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['dry', 'damp_mossy'],
    'textures': ['displaced_lid.png', 'displaced_lid_damp.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'open_cavity_close.png', 'slid_lid_close.png', 'front_damp.png', 'three_quarter_damp.png']
}, indent=2))

print("Catacombs Displaced lid complete and verified with 100% full coverage!")
