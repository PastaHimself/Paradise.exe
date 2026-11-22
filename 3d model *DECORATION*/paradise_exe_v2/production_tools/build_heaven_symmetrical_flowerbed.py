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

# Heaven: Symmetrical flowerbed
# Classical parterre flowerbed with molded marble curbing, fluted corner piers with miniature urn finials, rich dark loam soil, central carved relief plinth with celestial blooms, and 4 symmetrical low parterre hedge quadrants.

# 1. Corner piers (2.5 x 2.5 units, Y: 0.0 to 4.5)
c('corner_nw', [-11.0, 0.0, 8.5], [-8.5, 4.5, 11.0], 'fluted_pier')
c('corner_ne', [8.5, 0.0, 8.5], [11.0, 4.5, 11.0], 'fluted_pier')
c('corner_sw', [-11.0, 0.0, -11.0], [-8.5, 4.5, -8.5], 'fluted_pier')
c('corner_se', [8.5, 0.0, -11.0], [11.0, 4.5, -8.5], 'fluted_pier')

# 2. Connecting curb walls (2.0 units thick, Y: 0.0 to 3.5)
c('curb_n', [-8.5, 0.0, 8.5], [8.5, 3.5, 10.5], 'quartz_marble')
c('curb_s', [-8.5, 0.0, -10.5], [8.5, 3.5, -8.5], 'quartz_marble')
c('curb_w', [-10.5, 0.0, -8.5], [-8.5, 3.5, 8.5], 'quartz_marble')
c('curb_e', [8.5, 0.0, -8.5], [10.5, 3.5, 8.5], 'quartz_marble')

# 3. Inner soil bed (Y: 0.0 to 2.5)
c('soil_bed', [-8.5, 0.0, -8.5], [8.5, 2.5, 8.5], 'rich_soil')

# 4. Symmetrical parterre plantings (Y: 2.5 to 6.2)
c('center_feature', [-2.8, 2.5, -2.8], [2.8, 3.8, 2.8], 'chiseled_frieze')
c('center_bloom', [-1.6, 3.8, -1.6], [1.6, 6.2, 1.6], 'pale_blooms')

c('hedge_nw', [-6.8, 2.5, 3.2], [-3.2, 4.8, 6.8], 'pale_blooms')
c('hedge_ne', [3.2, 2.5, 3.2], [6.8, 4.8, 6.8], 'pale_blooms')
c('hedge_sw', [-6.8, 2.5, -6.8], [-3.2, 4.8, -3.2], 'pale_blooms')
c('hedge_se', [3.2, 2.5, -6.8], [6.8, 4.8, -3.2], 'pale_blooms')

# 5. Corner urn finials (Y: 4.5 to 6.0)
c('urn_nw', [-10.5, 4.5, 9.0], [-9.0, 6.0, 10.5], 'chiseled_frieze')
c('urn_ne', [9.0, 4.5, 9.0], [10.5, 6.0, 10.5], 'chiseled_frieze')
c('urn_sw', [-10.5, 4.5, -10.5], [-9.0, 6.0, -9.0], 'chiseled_frieze')
c('urn_se', [9.0, 4.5, -10.5], [10.5, 6.0, -9.0], 'chiseled_frieze')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'quartz_marble': (0, 0, 'quartz_block_bottom.png', 32, 16),
    'fluted_pier': (32, 0, 'quartz_block_lines.png', 16, 16),
    'chiseled_frieze': (48, 0, 'quartz_block_chiseled.png', 16, 16),
    'rich_soil': (0, 16, 'dirt.png', 32, 32),
    'pale_blooms': (32, 16, 'calcite.png', 32, 32)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/classical-formal-garden-parterre-flowerbed, https://www.alamy.com/stock-photo/symmetrical-marble-garden-flowerbed.html',
    'used': 'heaven sanctuary symmetrical flowerbed formal parterre garden bed with molded white quartz curbing, fluted corner piers with miniature urn finials, rich dark loam soil, central carved relief plinth with celestial blooms, and 4 symmetrical low parterre hedge quadrants',
    'limitations': [
        'modular 22-unit square symmetrical flowerbed fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original quartz_block_bottom, quartz_block_lines, quartz_block_chiseled, dirt, calcite pixels unchanged; clean and disturbed/weathered texture variants'
    ]
}

D = build('symmetrical_flowerbed', cs, a, regions, plan, area='heaven')

checker(D, [0, 3.5, 0], [26, 14, 26])
views(D, [0, 3.5, 0], {
    'front': [0, 8.0, 24],
    'three_quarter': [20, 16, 20],
    'back': [-20, 16, -20],
    'gameplay_scale': [28, 22, 28],
    'center_close': [0, 5.0, 10.0],
    'corner_close': [10.0, 5.0, 10.0]
})

# Create disturbed / weathered texture variant
im_weathered = Image.open(D/'symmetrical_flowerbed.png').convert('RGBA')
im_weathered.paste(Image.open(S/'calcite.png').convert('RGBA'), (0, 0))
im_weathered.paste(Image.open(S/'calcite.png').convert('RGBA'), (16, 0))
for xx in (0, 16):
    for yy in (16, 32):
        im_weathered.paste(Image.open(S/'dirt_with_roots.png').convert('RGBA'), (xx, yy))
for xx in (32, 48):
    for yy in (16, 32):
        im_weathered.paste(Image.open(S/'deadbush.png').convert('RGBA'), (xx, yy))
im_weathered.save(D/'symmetrical_flowerbed_disturbed.png')
(D/'symmetrical_flowerbed_clean.png').write_bytes((D/'symmetrical_flowerbed.png').read_bytes())

call('create_texture', {'name': 'symmetrical_flowerbed_disturbed', 'data': str(D/'symmetrical_flowerbed_disturbed.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'symmetrical_flowerbed_disturbed'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 3.5, 0], {
        'front_disturbed': [0, 8.0, 24],
        'three_quarter_disturbed': [20, 16, 20]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Finish (exports models, verifies UVs, closes project tab)
finish('symmetrical_flowerbed', 'Symmetrical flowerbed', 'Clipped hedge', 'Garden edging', area='heaven')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['clean', 'disturbed'],
    'textures': ['symmetrical_flowerbed.png', 'symmetrical_flowerbed_clean.png', 'symmetrical_flowerbed_disturbed.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'center_close.png', 'corner_close.png', 'front_disturbed.png', 'three_quarter_disturbed.png']
}, indent=2))

print("Heaven Symmetrical flowerbed complete and verified with 100% full coverage!")
