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

# 1. Main Ashlar Stone Brick (Y: 0.0 to 4.0)
c('brick_main', [-4.0, 0.0, -2.5], [4.0, 4.0, 2.5], 'ashlar_stone', off=['down'])

# 2. Chipped Ends & Fracture Steps
c('fracture_end_l', [-4.6, 0.0, -2.0], [-4.0, 2.6, 2.0], 'fracture_stone', off=['down', 'east'])
c('fracture_end_r', [4.0, 0.0, -1.8], [4.4, 2.2, 1.8], 'fracture_stone', off=['down', 'west'])

# 3. Adhering Lime Mortar Crusts
c('mortar_ridge_top', [-2.0, 4.0, -1.2], [2.0, 4.4, 1.2], 'lime_mortar', off=['down'])
c('mortar_crust_side', [-3.2, 0.8, -2.7], [3.2, 2.4, -2.5], 'lime_mortar', off=['south'])

# 4. Fallen Stone Chips & Rubble Crumbs on Floor
c('rubble_chip_1', [-5.8, 0.0, 0.8], [-4.8, 1.2, 2.0], 'fracture_stone', off=['down'])
c('rubble_chip_2', [4.8, 0.0, -3.2], [5.8, 0.9, -2.0], 'fracture_stone', off=['down'])
c('rubble_chip_3', [-1.8, 0.0, 3.0], [-0.8, 0.7, 4.2], 'fracture_stone', off=['down'])
c('mortar_crumb', [2.0, 0.0, 2.8], [3.0, 0.5, 3.8], 'lime_mortar', off=['down'])

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'ashlar_stone': (0, 0, 'stonebrick.png', 16, 16),
    'fracture_stone': (16, 0, 'stonebrick_cracked.png', 16, 16),
    'lime_mortar': (32, 0, 'calcite.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/dark-underground-catacomb-ruins-with-brick-rubble-floor, https://www.dreamstime.com/photos-images/ancient-stone-crypt-floor-texture-abandoned-dungeon.html',
    'used': 'ancient subterranean catacombs fallen ashlar stone brick prop dislodged from vault wall, featuring main dressed stone block with weathered chipped fracture facets, adhering crumbly lime mortar crusts, and scattered floor stone chips and mortar crumbs',
    'limitations': [
        'modular 12-unit wide fallen masonry brick floor prop fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        'original stonebrick, stonebrick_cracked, calcite pixels unchanged; dry and damp/mossy variants'
    ]
}

D = build('loose_brick', cs, a, regions, plan, area='catacombs')

checker(D, [0, 2.0, 0.0], [16, 14, 16])
views(D, [0, 2.0, 0.0], {
    'front': [0, 2.0, 16],
    'three_quarter': [14, 12, 14],
    'back': [-14, 12, -14],
    'gameplay_scale': [20, 18, 20],
    'fracture_close': [-4.0, 2.0, 6.0],
    'mortar_close': [0, 3.5, 6.0]
})

# Create damp / mossy variant texture and views
im_mossy = Image.open(D/'loose_brick.png').convert('RGBA')
im_mossy.paste(Image.open(S/'stonebrick_mossy.png').convert('RGBA'), (0, 0))
im_mossy.paste(Image.open(S/'stonebrick_mossy.png').convert('RGBA'), (16, 0))
im_mossy.paste(Image.open(S/'calcite.png').convert('RGBA'), (32, 0))
im_mossy.save(D/'loose_brick_damp.png')
(D/'loose_brick_dry.png').write_bytes((D/'loose_brick.png').read_bytes())

call('create_texture', {'name': 'loose_brick_damp', 'data': str(D/'loose_brick_damp.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'loose_brick_damp'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 2.0, 0.0], {
        'front_damp': [0, 2.0, 16],
        'three_quarter_damp': [14, 12, 14]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Normal finish (exports models, verifies UVs, closes project tab)
finish('loose_brick', 'Loose brick', 'Rubble edge', 'Uneven floor tiles', area='catacombs')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['dry', 'damp_mossy'],
    'textures': ['loose_brick.png', 'loose_brick_damp.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'fracture_close.png', 'mortar_close.png', 'front_damp.png', 'three_quarter_damp.png']
}, indent=2))

print("Catacombs Loose brick complete and verified!")
