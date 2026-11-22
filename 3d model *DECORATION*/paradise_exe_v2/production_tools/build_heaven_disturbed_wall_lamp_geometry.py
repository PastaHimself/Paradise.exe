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

# Heaven: Disturbed wall lamp geometry
# Broken neoclassical white quartz and gilt brass wall sconce with fractured crest backplate, twisted cantilever bracket, tilted bobeche tray, shattered globe with exposed glowing celestial core, dangling chain, and fallen marble and glass floor fragments.

# 1. Backplate, fractured crest, lower drop (Z: 5.7 to 7.0 against wall)
c('backplate_main', [-2.5, 4.0, 6.0], [2.5, 11.5, 7.0], 'quartz_backplate')
c('backplate_top_fractured', [-2.5, 11.5, 5.8], [0.5, 15.0, 7.0], 'calcite_fractured')
c('back_crest_shard', [-1.8, 15.0, 5.7], [0.2, 16.0, 6.8], 'calcite_fractured')
c('back_drop', [-1.2, 2.5, 5.8], [1.2, 4.0, 7.0], 'quartz_backplate')

# 2. Cantilever bracket arm & support scroll
c('arm_main', [-0.8, 8.2, 2.0], [0.8, 9.4, 6.0], 'brass_bracket')
c('arm_bent', [-0.7, 6.8, 1.0], [0.7, 8.2, 2.0], 'brass_bracket')
c('support_scroll', [-0.6, 5.5, 3.5], [0.6, 8.2, 5.5], 'brass_bracket')

# 3. Bobeche dish tray & socket cup
c('bobeche_dish', [-2.8, 6.0, -2.5], [2.8, 6.8, 1.0], 'brass_bracket')
c('socket_cup', [-1.6, 6.8, -2.0], [1.6, 8.0, 1.0], 'brass_bracket')

# 4. Shattered lantern globe & remnant glowing core
c('glowing_core_exposed', [-1.5, 8.0, -1.8], [1.5, 11.5, 0.8], 'glowing_core')
c('globe_retained_shard', [-2.2, 8.0, -2.2], [-1.5, 11.5, 1.0], 'frosted_glass')
c('globe_broken_front', [-1.5, 8.0, -2.2], [1.5, 9.5, -1.8], 'frosted_glass')
c('upper_cap_askew', [-2.2, 11.5, -2.2], [2.2, 12.3, 1.0], 'brass_bracket')
c('cap_finial', [-0.8, 12.3, -1.0], [0.8, 13.5, 0.2], 'brass_bracket')

# 5. Fallen debris & dangling chain
c('hanging_chain', [-0.2, 3.8, 0.0], [0.2, 6.0, 0.4], 'brass_bracket')
c('debris_marble_chip', [-4.5, 0.0, 2.0], [-2.5, 0.8, 4.5], 'calcite_fractured')
c('debris_glass_shard', [1.0, 0.0, 0.5], [3.2, 0.4, 3.0], 'frosted_glass')
c('debris_brass_ring', [-1.0, 0.0, -1.5], [1.5, 0.5, 0.2], 'brass_bracket')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'quartz_backplate': (0, 0, 'quartz_block_bottom.png', 16, 16),
    'calcite_fractured': (16, 0, 'calcite.png', 16, 16),
    'brass_bracket': (32, 0, 'gilded_blackstone.png', 16, 16),
    'glowing_core': (48, 0, 'glowstone.png', 16, 16),
    'frosted_glass': (0, 16, 'quartz_block_chiseled.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/broken-classical-wall-sconce, https://www.alamy.com/stock-photo/ruined-antique-wall-lamp.html',
    'used': 'heaven sanctuary disturbed wall lamp geometry broken neoclassical white quartz and gilt brass wall sconce with fractured crest backplate, twisted cantilever bracket, tilted bobeche tray, shattered globe with exposed glowing celestial core, dangling chain, and fallen marble and glass floor fragments',
    'limitations': [
        'modular 16-unit tall disturbed wall lamp geometry fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original quartz_block_bottom, calcite, gilded_blackstone, glowstone, quartz_block_chiseled pixels unchanged; dry and weathered variants'
    ]
}

D = build('disturbed_wall_lamp_geometry', cs, a, regions, plan, area='heaven')

checker(D, [0, 8.0, 1.0], [20, 20, 20])
views(D, [0, 8.0, 1.0], {
    'front': [0, 8.0, 18],
    'three_quarter': [16, 14, 16],
    'back': [-16, 14, -16],
    'gameplay_scale': [24, 18, 24],
    'core_close': [0, 10.0, 7.0],
    'debris_close': [0, 2.0, 8.0]
})

# Create weathered / disturbed texture variant
im_weathered = Image.open(D/'disturbed_wall_lamp_geometry.png').convert('RGBA')
im_weathered.paste(Image.open(S/'calcite.png').convert('RGBA'), (0, 0)) # weather base quartz to calcite
im_weathered.paste(Image.open(S/'coal_block.png').convert('RGBA'), (48, 0)) # dim extinguished core
im_weathered.save(D/'disturbed_wall_lamp_geometry_weathered.png')
(D/'disturbed_wall_lamp_geometry_standard.png').write_bytes((D/'disturbed_wall_lamp_geometry.png').read_bytes())

call('create_texture', {'name': 'disturbed_wall_lamp_geometry_weathered', 'data': str(D/'disturbed_wall_lamp_geometry_weathered.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'disturbed_wall_lamp_geometry_weathered'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 8.0, 1.0], {
        'front_weathered': [0, 8.0, 18],
        'three_quarter_weathered': [16, 14, 16]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Finish (exports models, verifies UVs, closes project tab)
finish('disturbed_wall_lamp_geometry', 'Disturbed wall lamp geometry', 'REST / YOU ARE SAFE sign', 'Disturbed safety sign geometry', area='heaven')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['standard', 'weathered'],
    'textures': ['disturbed_wall_lamp_geometry.png', 'disturbed_wall_lamp_geometry_standard.png', 'disturbed_wall_lamp_geometry_weathered.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'core_close.png', 'debris_close.png', 'front_weathered.png', 'three_quarter_weathered.png']
}, indent=2))

print("Heaven Disturbed wall lamp geometry complete and verified with 100% full coverage!")
