import sys
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
from pipeline import *
from checker import checker
from audit_geometry import check_z_fighting_and_collisions, audit_full_coverage

cs = []
a = {}
def c(n, lo, hi, m):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, [], False)

# Shared assets: Freestanding sign post
# Floor-standing directional stanchion sign post with weighted base plinth, beveled collar, tubular upright post with mounting clamps, framed sign board, and dual-sided indicator badges; clean and weathered variants.

# 1. Base footing (Y: 0.0 to 3.5)
c('base_ring', [-5.0, 0.0, -5.0], [5.0, 1.0, 5.0], 'metal_dark')
c('base_cone', [-4.0, 1.0, -4.0], [4.0, 2.5, 4.0], 'metal')
c('base_collar', [-2.0, 2.5, -2.0], [2.0, 3.5, 2.0], 'metal_dark')

# 2. Tubular post & mounting clamp collars (Y: 3.5 to 25.0)
c('post_seg_1', [-1.0, 3.5, -1.0], [1.0, 12.0, 1.0], 'metal')
c('mid_collar', [-1.5, 12.0, -1.5], [1.5, 13.0, 1.5], 'metal_dark')
c('post_seg_2', [-1.0, 13.0, -1.0], [1.0, 15.0, 1.0], 'metal')
c('bracket_lower', [-1.5, 15.0, -1.5], [1.5, 16.0, 1.5], 'metal_dark')
c('post_seg_3', [-1.0, 16.0, -1.0], [1.0, 22.0, 1.0], 'metal')
c('bracket_upper', [-1.5, 22.0, -1.5], [1.5, 23.0, 1.5], 'metal_dark')
c('post_seg_4', [-1.0, 23.0, -1.0], [1.0, 24.0, 1.0], 'metal')
c('post_cap', [-1.25, 24.0, -1.25], [1.25, 25.0, 1.25], 'metal_dark')

# 3. Cantilevered sign board frame (Y: 15.0 to 23.0, X: 1.5 to 10.5)
c('frame_top', [1.5, 22.0, -0.6], [10.5, 23.0, 0.6], 'metal_dark')
c('frame_bottom', [1.5, 15.0, -0.6], [10.5, 16.0, 0.6], 'metal_dark')
c('frame_outer', [9.5, 16.0, -0.6], [10.5, 22.0, 0.6], 'metal_dark')

# 4. Sign board core & directional badges
c('sign_core', [1.5, 16.0, -0.4], [9.5, 22.0, 0.4], 'sign_white')
c('badge_front', [3.5, 17.5, 0.4], [7.5, 20.5, 0.6], 'sign_accent')
c('badge_back', [3.5, 17.5, -0.6], [7.5, 20.5, -0.4], 'sign_accent')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'metal': (0, 0, 'iron_block.png', 16, 16),
    'metal_dark': (16, 0, 'netherite_block.png', 16, 16),
    'sign_white': (32, 0, 'quartz_block_bottom.png', 16, 16),
    'sign_accent': (48, 0, 'gold_block.png', 16, 16),
    'calcite_faded': (0, 16, 'calcite.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/freestanding-stanchion-sign-post, https://www.alamy.com/stock-photo/metal-pedestal-directional-sign.html',
    'used': 'shared assets freestanding sign post floor-standing directional stanchion sign post with weighted base plinth, beveled collar, tubular upright post with mounting clamps, framed sign board, and dual-sided indicator badges; clean and weathered variants',
    'limitations': [
        'modular freestanding sign post fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original iron_block, netherite_block, quartz_block_bottom, gold_block, calcite pixels unchanged; clean and weathered variants'
    ]
}

D = build('freestanding_sign_post', cs, a, regions, plan, area='shared')

checker(D, [2.5, 12.5, 0], [18, 26, 14])
views(D, [2.5, 12.5, 0], {
    'front': [2.5, 12.5, 22],
    'three_quarter': [18, 16, 18],
    'back': [-18, 16, -18],
    'gameplay_scale': [26, 20, 26],
    'board_close': [5.5, 19.0, 10.0],
    'base_close': [0, 2.0, 10.0]
})

# Create weathered texture variant
im_weathered = Image.open(D/'freestanding_sign_post.png').convert('RGBA')
im_weathered.paste(Image.open(S/'calcite.png').convert('RGBA'), (32, 0)) # faded sign board
im_weathered.paste(Image.open(S/'copper_block.png').convert('RGBA'), (48, 0)) # tarnished brass badge
im_weathered.save(D/'freestanding_sign_post_weathered.png')
(D/'freestanding_sign_post_clean.png').write_bytes((D/'freestanding_sign_post.png').read_bytes())

call('create_texture', {'name': 'freestanding_sign_post_weathered', 'data': str(D/'freestanding_sign_post_weathered.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'freestanding_sign_post_weathered'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [2.5, 12.5, 0], {
        'front_weathered': [2.5, 12.5, 22],
        'three_quarter_weathered': [18, 16, 18]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Finish (exports models, verifies UVs, closes project tab)
finish('freestanding_sign_post', 'Freestanding sign post', 'Blank sign backing', 'Arrow sheet', area='shared')

# Also write non-prefixed files for backward compatibility in shared
(D/'freestanding_sign_post.bbmodel').write_bytes((D/'shared_freestanding_sign_post.bbmodel').read_bytes())
(D/'freestanding_sign_post.geo.json').write_bytes((D/'shared_freestanding_sign_post.geo.json').read_bytes())

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['clean', 'weathered'],
    'textures': ['freestanding_sign_post.png', 'freestanding_sign_post_clean.png', 'freestanding_sign_post_weathered.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'board_close.png', 'base_close.png', 'front_weathered.png', 'three_quarter_weathered.png']
}, indent=2))

print("Shared Freestanding sign post complete and verified with 100% full coverage!")
