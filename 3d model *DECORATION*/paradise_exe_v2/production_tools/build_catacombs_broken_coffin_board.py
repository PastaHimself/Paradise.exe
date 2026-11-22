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

# Catacombs: Broken coffin board
# Decaying, splintered, rotted antique oak burial coffin plank resting propped askew across cracked stone masonry with rusted iron reinforcement bands, forged nail heads, jagged splinter fracture teeth, detached wood shards, and a bone relic fragment

# 1. Cracked stone masonry wedge supporting high end (Y: 0.0 to 1.8)
c('stone_wedge', [-8.5, 0.0, -2.0], [-5.5, 1.8, 1.5], 'stone_prop')

# 2. Main coffin timber plank (3 stepped sloping sections from propped high end down to floor)
c('plank_hi', [-9.5, 1.8, -2.5], [-4.0, 3.0, 2.0], 'coffin_wood')
c('plank_mid', [-4.0, 0.8, -2.5], [2.5, 2.0, 2.0], 'coffin_wood')
c('plank_lo', [2.5, 0.0, -2.5], [8.0, 1.2, 2.0], 'coffin_wood')

# 3. Splintered jagged fracture teeth at broken end (X >= 8.0)
c('splinter_top', [8.0, 0.2, -2.5], [10.8, 1.0, -0.8], 'coffin_wood')
c('splinter_mid', [8.0, 0.0, -0.8], [9.2, 0.8, 0.6], 'coffin_wood')
c('splinter_bot', [8.0, 0.1, 0.6], [11.5, 0.9, 2.0], 'coffin_wood')

# 4. Detached fallen wood shards & chips on the crypt floor
c('shard_1', [9.5, 0.0, 2.5], [12.5, 0.6, 3.8], 'coffin_wood')
c('shard_2', [11.0, 0.0, -2.8], [13.0, 0.5, -1.5], 'coffin_wood')
c('shard_3', [7.0, 0.0, 2.5], [9.0, 0.4, 3.6], 'coffin_wood')

# 5. Rusted wrought iron reinforcement straps & forged nail studs
c('band_hi', [-7.5, 3.0, -2.5], [-6.0, 3.3, 2.0], 'iron_strap')
c('nail_hi_1', [-7.0, 3.3, -1.8], [-6.5, 3.6, -1.2], 'iron_stud')
c('nail_hi_2', [-7.0, 3.3, 1.2], [-6.5, 3.6, 1.8], 'iron_stud')
c('band_mid', [-0.5, 2.0, -2.5], [1.0, 2.3, 2.0], 'iron_strap')
c('nail_mid_1', [0.0, 2.3, -1.8], [0.5, 2.6, -1.2], 'iron_stud')
c('nail_mid_2', [0.0, 2.3, 1.2], [0.5, 2.6, 1.8], 'iron_stud')

# 6. Ancient burial bone relic crumb resting beside the plank
c('bone_crumb', [-2.0, 0.0, -4.5], [0.5, 1.5, -2.8], 'bone_relic')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'coffin_wood': (0, 0, 'planks_big_oak.png', 16, 16),
    'iron_strap': (16, 0, 'cauldron_side.png', 16, 16),
    'iron_stud': (32, 0, 'polished_blackstone.png', 16, 16),
    'stone_prop': (48, 0, 'stonebrick_cracked.png', 16, 16),
    'bone_relic': (0, 16, 'bone_block_top.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/broken-decaying-coffin-wood-crypt, https://www.alamy.com/stock-photo/ancient-wooden-coffin-splintered-board.html',
    'used': 'ancient subterranean catacombs broken coffin board splintered decaying dark oak burial plank propped askew across cracked stone masonry with rusted iron reinforcement straps, forged nail studs, jagged wood splinters, scattered floor shards, and resting bone relic',
    'limitations': [
        'modular 23-unit long broken coffin board fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original planks_big_oak, cauldron_side, polished_blackstone, stonebrick_cracked, bone_block_top pixels unchanged; dry and damp/decayed variants'
    ]
}

D = build('broken_coffin_board', cs, a, regions, plan, area='catacombs')

checker(D, [1.0, 1.5, 0], [20, 20, 20])
views(D, [1.0, 1.5, 0], {
    'front': [1.0, 5.0, 18],
    'three_quarter': [16, 14, 16],
    'back': [-16, 14, -16],
    'gameplay_scale': [24, 18, 24],
    'splinter_close': [9.0, 2.0, 6.0],
    'band_close': [-6.0, 4.0, 6.0]
})

# Create damp / rotted variant texture and views
im_damp = Image.open(D/'broken_coffin_board.png').convert('RGBA')
im_damp.paste(Image.open(S/'planks_spruce.png').convert('RGBA'), (0, 0))
im_damp.save(D/'broken_coffin_board_damp.png')
(D/'broken_coffin_board_dry.png').write_bytes((D/'broken_coffin_board.png').read_bytes())

call('create_texture', {'name': 'broken_coffin_board_damp', 'data': str(D/'broken_coffin_board_damp.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'broken_coffin_board_damp'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [1.0, 1.5, 0], {
        'front_damp': [1.0, 5.0, 18],
        'three_quarter_damp': [16, 14, 16]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Finish (exports models, verifies UVs, closes project tab)
finish('broken_coffin_board', 'Broken coffin board', 'Mineral streaks', 'Floor puddles', area='catacombs')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['dry', 'damp_decayed'],
    'textures': ['broken_coffin_board.png', 'broken_coffin_board_damp.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'splinter_close.png', 'band_close.png', 'front_damp.png', 'three_quarter_damp.png']
}, indent=2))

print("Catacombs Broken coffin board complete and verified with 100% full coverage!")
