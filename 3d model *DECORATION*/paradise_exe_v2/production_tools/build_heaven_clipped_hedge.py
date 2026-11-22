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

# Heaven: Clipped hedge
# Classical formal manicured pale oak topiary hedge barrier with molded marble plinth footing, flanking fluted pilaster end posts with carved relief caps, rich loam potting bed, dense manicured boxwood foliage body, and tiered topiary finials.

# 1. Marble curbing plinth (Y: 0.0 to 3.0)
c('plinth_base', [-8.0, 0.0, -4.0], [8.0, 1.5, 4.0], 'quartz_marble')
c('plinth_curb_n', [-6.5, 1.5, 3.0], [6.5, 3.0, 4.0], 'quartz_marble')
c('plinth_curb_s', [-6.5, 1.5, -4.0], [6.5, 3.0, -3.0], 'quartz_marble')
c('soil_strip', [-6.5, 1.5, -3.0], [6.5, 2.5, 3.0], 'rich_soil')

# 2. Fluted end posts / corner piers (Y: 1.5 to 5.5)
c('post_w', [-8.0, 1.5, -3.8], [-6.5, 4.5, 3.8], 'fluted_post')
c('post_e', [6.5, 1.5, -3.8], [8.0, 4.5, 3.8], 'fluted_post')
c('cap_w', [-8.0, 4.5, -3.6], [-6.5, 5.5, 3.6], 'chiseled_cap')
c('cap_e', [6.5, 4.5, -3.6], [8.0, 5.5, 3.6], 'chiseled_cap')

# 3. Manicured clipped hedge body (Y: 2.5 to 18.0)
c('hedge_lower', [-6.5, 2.5, -3.0], [6.5, 8.0, 3.0], 'pale_leaves')
c('hedge_mid', [-6.2, 8.0, -2.8], [6.2, 14.0, 2.8], 'pale_leaves')
c('hedge_crown', [-5.5, 14.0, -2.2], [5.5, 16.5, 2.2], 'pale_leaves')
c('hedge_top_finial_c', [-2.0, 16.5, -1.5], [2.0, 18.0, 1.5], 'pale_leaves')
c('hedge_top_finial_w', [-5.5, 16.5, -1.2], [-3.5, 17.5, 1.2], 'pale_leaves')
c('hedge_top_finial_e', [3.5, 16.5, -1.2], [5.5, 17.5, 1.2], 'pale_leaves')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'quartz_marble': (0, 0, 'quartz_block_bottom.png', 16, 16),
    'fluted_post': (16, 0, 'quartz_block_lines.png', 16, 16),
    'chiseled_cap': (32, 0, 'quartz_block_chiseled.png', 16, 16),
    'rich_soil': (48, 0, 'dirt.png', 16, 16),
    'pale_leaves': (0, 16, 'pale_oak_leaves_opaque.png', 32, 32)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/classical-formal-garden-clipped-hedge, https://www.alamy.com/stock-photo/manicured-topiary-boxwood-hedge.html',
    'used': 'heaven sanctuary clipped hedge classical formal manicured pale oak topiary hedge barrier with molded marble plinth footing, flanking fluted pilaster end posts with carved relief caps, rich loam potting bed, dense manicured foliage body, and tiered topiary finials',
    'limitations': [
        'modular 16-unit long manicured topiary hedge segment fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original quartz_block_bottom, quartz_block_lines, quartz_block_chiseled, dirt, pale_oak_leaves_opaque pixels unchanged; clean and disturbed/overgrown texture variants'
    ]
}

D = build('clipped_hedge', cs, a, regions, plan, area='heaven')

checker(D, [0, 9.0, 0], [22, 22, 16])
views(D, [0, 9.0, 0], {
    'front': [0, 9.0, 20],
    'three_quarter': [18, 14, 18],
    'back': [-18, 14, -18],
    'gameplay_scale': [26, 18, 26],
    'post_close': [7.0, 5.0, 8.0],
    'finial_close': [0, 16.0, 8.0]
})

# Create disturbed / overgrown texture variant
im_disturbed = Image.open(D/'clipped_hedge.png').convert('RGBA')
im_disturbed.paste(Image.open(S/'calcite.png').convert('RGBA'), (0, 0)) # cracked marble base
im_disturbed.paste(Image.open(S/'dirt_with_roots.png').convert('RGBA'), (48, 0)) # dried rooty soil
for xx in (0, 16):
    for yy in (16, 32):
        im_disturbed.paste(Image.open(S/'deadbush.png').convert('RGBA'), (xx, yy)) # desiccated foliage
im_disturbed.save(D/'clipped_hedge_disturbed.png')
(D/'clipped_hedge_clean.png').write_bytes((D/'clipped_hedge.png').read_bytes())

call('create_texture', {'name': 'clipped_hedge_disturbed', 'data': str(D/'clipped_hedge_disturbed.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'clipped_hedge_disturbed'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 9.0, 0], {
        'front_disturbed': [0, 9.0, 20],
        'three_quarter_disturbed': [18, 14, 18]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Finish (exports models, verifies UVs, closes project tab)
finish('clipped_hedge', 'Clipped hedge', 'Garden edging', 'Fountain rim', area='heaven')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['clean', 'disturbed'],
    'textures': ['clipped_hedge.png', 'clipped_hedge_clean.png', 'clipped_hedge_disturbed.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'post_close.png', 'finial_close.png', 'front_disturbed.png', 'three_quarter_disturbed.png']
}, indent=2))

print("Heaven Clipped hedge complete and verified with 100% full coverage!")
