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

# 1. Backing Ruined Masonry Wall (Z: 4.0 to 8.0)
# Left tall fractured wall tooth (Y: 0.0 to 8.0)
c('wall_left_tooth', [-8.0, 0.0, 4.0], [-3.0, 8.0, 8.0], 'masonry_brick', off=['down', 'east'])
# Broken wall gap center (Y: 0.0 to 3.0)
c('wall_center_break', [-3.0, 0.0, 4.0], [2.0, 3.0, 8.0], 'masonry_brick', off=['down', 'west', 'east'])
# Right wall stub (Y: 0.0 to 5.0)
c('wall_right_stub', [2.0, 0.0, 4.0], [8.0, 5.0, 8.0], 'masonry_brick', off=['down', 'west'])

# 2. Scree Mound in front of the break (Z: 1.5 to 4.0)
c('scree_bank_l', [-7.0, 0.0, 1.5], [-2.5, 1.0, 4.0], 'mortar_gravel', off=['down', 'south'])
c('scree_bank_mid', [-2.5, 0.0, 1.5], [2.5, 1.8, 4.0], 'mortar_gravel', off=['down', 'south', 'west', 'east'])
c('scree_bank_r', [2.5, 0.0, 1.5], [7.0, 1.0, 4.0], 'mortar_gravel', off=['down', 'south'])

# Front lower gravel apron (Z: -1.0 to 1.5)
c('scree_apron', [-5.5, 0.0, -1.0], [5.5, 0.6, 1.5], 'mortar_gravel', off=['down', 'south'])

# 3. Dislodged Fallen Ashlar Blocks
# Block 1: sitting on top of the mid scree bank
c('fallen_block_1', [-1.8, 1.8, 1.8], [2.0, 3.8, 3.8], 'cracked_brick', off=['down'])
# Block 2: sitting forward on left floor
c('fallen_block_2', [-6.5, 0.0, -3.5], [-2.5, 2.0, -1.5], 'cracked_brick', off=['down'])
# Block 3: sitting forward on right floor
c('fallen_block_3', [2.5, 0.0, -3.8], [6.5, 2.0, -1.8], 'cracked_brick', off=['down'])

# 4. Scattered Stone Chips and Crumbs
c('chip_1', [-6.8, 0.0, -5.2], [-5.4, 0.7, -4.0], 'cracked_brick', off=['down'])
c('chip_2', [4.8, 0.0, -5.4], [6.0, 0.8, -4.2], 'cracked_brick', off=['down'])
c('chip_3', [-1.0, 0.0, -3.0], [0.4, 0.5, -1.8], 'mortar_gravel', off=['down'])

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'masonry_brick': (0, 0, 'stonebrick.png', 16, 16),
    'cracked_brick': (16, 0, 'stonebrick_cracked.png', 16, 16),
    'mortar_gravel': (32, 0, 'calcite.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/collapsed-catacomb-wall-rubble, https://www.alamy.com/stock-photo/ruined-crypt-stone-debris.html',
    'used': 'ancient subterranean catacombs ruined masonry rubble edge where a damaged ashlar stone wall has fractured and spilled a stepped scree terrace of gravel and dislodged blocks onto the floor',
    'limitations': [
        'modular 16-unit wide ruined wall and rubble scree apron fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        'original stonebrick, stonebrick_cracked, calcite pixels unchanged; dry and damp/mossy variants'
    ]
}

D = build('rubble_edge', cs, a, regions, plan, area='catacombs')

checker(D, [0, 2.5, 0.0], [18, 16, 18])
views(D, [0, 2.5, 0.0], {
    'front': [0, 2.5, 18],
    'three_quarter': [16, 14, 16],
    'back': [-16, 14, -16],
    'gameplay_scale': [22, 20, 22],
    'scree_close': [0, 2.0, 7.0],
    'break_close': [-2.0, 4.0, 9.0]
})

# Create damp / mossy variant texture and views
im_mossy = Image.open(D/'rubble_edge.png').convert('RGBA')
im_mossy.paste(Image.open(S/'stonebrick_mossy.png').convert('RGBA'), (0, 0))
im_mossy.paste(Image.open(S/'stonebrick_mossy.png').convert('RGBA'), (16, 0))
im_mossy.paste(Image.open(S/'calcite.png').convert('RGBA'), (32, 0))
im_mossy.save(D/'rubble_edge_damp.png')
(D/'rubble_edge_dry.png').write_bytes((D/'rubble_edge.png').read_bytes())

call('create_texture', {'name': 'rubble_edge_damp', 'data': str(D/'rubble_edge_damp.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'rubble_edge_damp'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 2.5, 0.0], {
        'front_damp': [0, 2.5, 18],
        'three_quarter_damp': [16, 14, 16]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Normal finish (exports models, verifies UVs, closes project tab)
finish('rubble_edge', 'Rubble edge', 'Uneven floor tiles', 'Straight arch', area='catacombs')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['dry', 'damp_mossy'],
    'textures': ['rubble_edge.png', 'rubble_edge_damp.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'scree_close.png', 'break_close.png', 'front_damp.png', 'three_quarter_damp.png']
}, indent=2))

print("Catacombs Rubble edge complete and verified!")
