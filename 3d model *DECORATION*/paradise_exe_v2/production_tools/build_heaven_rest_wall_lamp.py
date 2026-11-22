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

# Heaven: Rest wall lamp
# Neoclassical white marble and gilt brass wall sconce lamp with molded crest backplate, cantilever bracket, bobeche tray, and glowing glass lantern globe

# 1. Wall backplate, molded crest, and lower drop finial (Z: 6.0 to 7.0 against wall)
c('backplate', [-2.5, 4.0, 6.0], [2.5, 14.0, 7.0], 'quartz_backplate')
c('back_crest', [-2.0, 14.0, 5.8], [2.0, 15.5, 7.0], 'quartz_backplate')
c('back_drop', [-1.2, 2.5, 5.8], [1.2, 4.0, 7.0], 'quartz_backplate')

# 2. Gilt brass cantilever bracket arm & scroll (Y: 5.5 to 9.8, Z: 0.0 to 6.0)
c('arm', [-0.8, 8.5, 0.0], [0.8, 9.8, 6.0], 'brass_bracket')
c('support_scroll', [-0.6, 5.5, 3.5], [0.6, 8.5, 5.5], 'brass_bracket')

# 3. Bobeche dish tray & socket cup (Y: 9.8 to 12.0)
c('bobeche_dish', [-3.0, 9.8, -2.0], [3.0, 10.6, 2.0], 'brass_bracket')
c('socket_cup', [-1.8, 10.6, -1.8], [1.8, 12.0, 1.8], 'brass_bracket')

# 4. Lantern gallery & glowing celestial glass globe (Y: 12.0 to 19.5)
c('lower_gallery', [-2.5, 12.0, -2.5], [2.5, 13.0, 2.5], 'brass_bracket')
c('glowing_globe', [-2.2, 13.0, -2.2], [2.2, 17.0, 2.2], 'glowing_core')
c('upper_cap', [-2.5, 17.0, -2.5], [2.5, 18.0, 2.5], 'brass_bracket')
c('cap_finial', [-1.0, 18.0, -1.0], [1.0, 19.5, 1.0], 'brass_bracket')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'quartz_backplate': (0, 0, 'quartz_block_bottom.png', 16, 16),
    'brass_bracket': (16, 0, 'gilded_blackstone.png', 16, 16),
    'glowing_core': (32, 0, 'glowstone.png', 16, 16),
    'frosted_glass': (48, 0, 'quartz_block_chiseled.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/classical-white-marble-wall-sconce, https://www.alamy.com/stock-photo/antique-brass-and-marble-wall-lamp.html',
    'used': 'heaven sanctuary rest wall lamp neoclassical white quartz and gilt brass wall sconce with molded backplate, cantilever bracket, bobeche tray, and radiant glowing celestial glass lantern globe',
    'limitations': [
        'modular 17-unit tall wall sconce lamp fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original quartz_block_bottom, gilded_blackstone, glowstone, quartz_block_chiseled pixels unchanged; clean and disturbed texture variants'
    ]
}

D = build('rest_wall_lamp', cs, a, regions, plan, area='heaven')

checker(D, [0, 11.0, 0], [20, 22, 20])
views(D, [0, 11.0, 0], {
    'front': [0, 11.0, 18],
    'three_quarter': [16, 14, 16],
    'back': [-16, 14, -16],
    'gameplay_scale': [24, 18, 24],
    'globe_close': [0, 15.0, 7.0],
    'bracket_close': [0, 9.0, 7.0]
})

# Create disturbed texture variant (dimmed, weathered marble & tarnished brass)
im_disturbed = Image.open(D/'rest_wall_lamp.png').convert('RGBA')
im_disturbed.paste(Image.open(S/'calcite.png').convert('RGBA'), (0, 0))
im_disturbed.paste(Image.open(S/'coal_block.png').convert('RGBA'), (32, 0))
im_disturbed.save(D/'rest_wall_lamp_disturbed.png')
(D/'rest_wall_lamp_clean.png').write_bytes((D/'rest_wall_lamp.png').read_bytes())

call('create_texture', {'name': 'rest_wall_lamp_disturbed', 'data': str(D/'rest_wall_lamp_disturbed.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'rest_wall_lamp_disturbed'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 11.0, 0], {
        'front_disturbed': [0, 11.0, 18],
        'three_quarter_disturbed': [16, 14, 16]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Finish (exports models, verifies UVs, closes project tab)
finish('rest_wall_lamp', 'Rest wall lamp', 'Disturbed wall lamp geometry', 'REST / YOU ARE SAFE sign', area='heaven')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['clean', 'disturbed'],
    'textures': ['rest_wall_lamp.png', 'rest_wall_lamp_clean.png', 'rest_wall_lamp_disturbed.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'globe_close.png', 'bracket_close.png', 'front_disturbed.png', 'three_quarter_disturbed.png']
}, indent=2))

print("Heaven Rest wall lamp complete and verified with 100% full coverage!")
