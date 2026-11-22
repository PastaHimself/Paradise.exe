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

# Modular 16x16 paver floor section with sunken, heaved, and cracked flagstones.
# Dimensions: X: [-8.0, 8.0], Z: [-8.0, 8.0]
# Pavers have varying heights (0.4 to 1.3) to represent ancient settling and earth movement.

# Row 1 (North: Z from -8.0 to -3.5)
c('paver_nw', [-8.0, 0.0, -8.0], [-2.0, 1.0, -3.5], 'ashlar_stone', off=['down', 'east'])
c('paver_ne', [-2.0, 0.0, -8.0], [8.0, 1.3, -3.5], 'cracked_stone', off=['down', 'west'])

# Row 2 (Mid: Z from -3.5 to 2.0)
c('paver_w', [-8.0, 0.0, -3.5], [-3.5, 0.7, 2.0], 'cracked_stone', off=['down', 'north', 'east'])
c('bedding_center', [-3.5, 0.0, -3.5], [2.5, 0.4, 2.0], 'lime_gravel', off=['down', 'north', 'west', 'east'])
c('paver_e', [2.5, 0.0, -3.5], [8.0, 1.2, 2.0], 'ashlar_stone', off=['down', 'north', 'west'])

# Row 3 (South: Z from 2.0 to 8.0)
c('paver_sw', [-8.0, 0.0, 2.0], [-1.5, 0.9, 8.0], 'cracked_stone', off=['down', 'north', 'east'])
c('paver_s_mid', [-1.5, 0.0, 2.0], [3.5, 0.6, 8.0], 'cracked_stone', off=['down', 'north', 'west', 'east'])
c('paver_se', [3.5, 0.0, 2.0], [8.0, 1.1, 8.0], 'ashlar_stone', off=['down', 'north', 'west'])

# Debris chips in center depression
c('debris_chip_1', [-2.0, 0.4, -2.0], [-0.5, 0.9, -0.8], 'cracked_stone', off=['down'])
c('debris_chip_2', [0.2, 0.4, 0.2], [1.8, 1.0, 1.4], 'cracked_stone', off=['down'])

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'ashlar_stone': (0, 0, 'stonebrick.png', 16, 16),
    'cracked_stone': (16, 0, 'stonebrick_cracked.png', 16, 16),
    'lime_gravel': (32, 0, 'calcite.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/ancient-stone-floor-dungeon-cracked, https://www.dreamstime.com/uneven-medieval-flagstone-pavement-photo.html',
    'used': 'ancient subterranean catacombs uneven floor tiles modular 16x16 paver section with sunken, heaved, and cracked flagstones, exposed lime mortar bedding, and chipped stone debris',
    'limitations': [
        'modular 16x16 paver floor tile fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        'original stonebrick, stonebrick_cracked, calcite pixels unchanged; dry and damp/mossy variants'
    ]
}

D = build('uneven_floor_tiles', cs, a, regions, plan, area='catacombs')

checker(D, [0, 1.0, 0.0], [18, 14, 18])
views(D, [0, 1.0, 0.0], {
    'front': [0, 6.0, 16],
    'three_quarter': [16, 16, 16],
    'back': [-16, 16, -16],
    'gameplay_scale': [22, 20, 22],
    'depression_close': [0, 3.0, 4.0],
    'heave_close': [5.0, 3.5, -1.0]
})

# Create damp / mossy variant texture and views
im_mossy = Image.open(D/'uneven_floor_tiles.png').convert('RGBA')
im_mossy.paste(Image.open(S/'stonebrick_mossy.png').convert('RGBA'), (0, 0))
im_mossy.paste(Image.open(S/'stonebrick_mossy.png').convert('RGBA'), (16, 0))
im_mossy.paste(Image.open(S/'calcite.png').convert('RGBA'), (32, 0))
im_mossy.save(D/'uneven_floor_tiles_damp.png')
(D/'uneven_floor_tiles_dry.png').write_bytes((D/'uneven_floor_tiles.png').read_bytes())

call('create_texture', {'name': 'uneven_floor_tiles_damp', 'data': str(D/'uneven_floor_tiles_damp.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'uneven_floor_tiles_damp'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 1.0, 0.0], {
        'front_damp': [0, 6.0, 16],
        'three_quarter_damp': [16, 16, 16]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Normal finish (exports models, verifies UVs, closes project tab)
finish('uneven_floor_tiles', 'Uneven floor tiles', 'Straight arch', 'Corner pier', area='catacombs')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['dry', 'damp_mossy'],
    'textures': ['uneven_floor_tiles.png', 'uneven_floor_tiles_damp.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'depression_close.png', 'heave_close.png', 'front_damp.png', 'three_quarter_damp.png']
}, indent=2))

print("Catacombs Uneven floor tiles complete and verified!")
