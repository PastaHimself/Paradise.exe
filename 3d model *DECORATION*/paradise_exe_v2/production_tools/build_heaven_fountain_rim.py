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

# Heaven: Fountain rim
# Monumental neoclassical white quartz marble fountain reflecting pool basin with stepped plinth footing, carved acanthus water spout corner piers, fluted basin walls, overhanging coping lip, tranquil celestial water surface, and central bubbling fountain nozzle.

# 1. Outer plinth footing (Y: 0.0 to 2.0)
c('plinth_n', [-7.5, 0.0, 9.0], [7.5, 2.0, 11.5], 'quartz')
c('plinth_s', [-7.5, 0.0, -11.5], [7.5, 2.0, -9.0], 'quartz')
c('plinth_w', [-11.5, 0.0, -7.5], [-9.0, 2.0, 7.5], 'quartz')
c('plinth_e', [9.0, 0.0, -7.5], [11.5, 2.0, 7.5], 'quartz')

# 2. Four corner piers (Y: 0.0 to 2.5)
c('pier_nw', [-11.0, 0.0, 7.5], [-7.5, 2.5, 11.0], 'chiseled')
c('pier_ne', [7.5, 0.0, 7.5], [11.0, 2.5, 11.0], 'chiseled')
c('pier_sw', [-11.0, 0.0, -11.0], [-7.5, 2.5, -7.5], 'chiseled')
c('pier_se', [7.5, 0.0, -11.0], [11.0, 2.5, -7.5], 'chiseled')

# 3. Molded rim walls (Y: 2.0 to 6.5)
c('rim_wall_n', [-7.5, 2.0, 8.5], [7.5, 6.5, 10.5], 'lines')
c('rim_wall_s', [-7.5, 2.0, -10.5], [7.5, 6.5, -8.5], 'lines')
c('rim_wall_w', [-10.5, 2.0, -7.5], [-8.5, 6.5, 7.5], 'lines')
c('rim_wall_e', [8.5, 2.0, -7.5], [10.5, 6.5, 7.5], 'lines')

# 4. Corner rim caps (Y: 2.5 to 6.5)
c('rim_cap_nw', [-10.5, 2.5, 7.5], [-7.5, 6.5, 10.5], 'chiseled')
c('rim_cap_ne', [7.5, 2.5, 7.5], [10.5, 6.5, 10.5], 'chiseled')
c('rim_cap_sw', [-10.5, 2.5, -10.5], [-7.5, 6.5, -7.5], 'chiseled')
c('rim_cap_se', [7.5, 2.5, -10.5], [10.5, 6.5, -7.5], 'chiseled')

# 5. Overhanging coping lip (Y: 6.5 to 7.5)
c('coping_n', [-8.0, 6.5, 8.0], [8.0, 7.5, 11.0], 'quartz')
c('coping_s', [-8.0, 6.5, -11.0], [8.0, 7.5, -8.0], 'quartz')
c('coping_w', [-11.0, 6.5, -7.5], [-8.0, 7.5, 7.5], 'quartz')
c('coping_e', [8.0, 6.5, -7.5], [11.0, 7.5, 7.5], 'quartz')

# 6. Basin floor & reflection pool water (Y: 0.0 to 4.5)
c('basin_floor', [-7.5, 0.0, -7.5], [7.5, 1.5, 7.5], 'quartz')
c('water_surface_n', [-7.5, 4.0, 2.5], [7.5, 4.5, 7.5], 'water')
c('water_surface_s', [-7.5, 4.0, -7.5], [7.5, 4.5, -2.5], 'water')
c('water_surface_w', [-7.5, 4.0, -2.5], [-2.5, 4.5, 2.5], 'water')
c('water_surface_e', [2.5, 4.0, -2.5], [7.5, 4.5, 2.5], 'water')

# 7. Central fountain jet (Y: 1.5 to 9.5)
c('central_jet_base', [-2.5, 1.5, -2.5], [2.5, 5.5, 2.5], 'chiseled')
c('central_jet_nozzle', [-1.0, 5.5, -1.0], [1.0, 8.5, 1.0], 'quartz')
c('water_crown', [-1.8, 8.5, -1.8], [1.8, 9.5, 1.8], 'water')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'quartz': (0, 0, 'quartz_block_bottom.png', 32, 16),
    'lines': (32, 0, 'quartz_block_lines.png', 16, 16),
    'chiseled': (48, 0, 'quartz_block_chiseled.png', 16, 16),
    'water': (0, 16, 'water_placeholder.png', 32, 32),
    'calcite': (32, 16, 'calcite.png', 32, 32)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/classical-marble-fountain-basin-rim, https://www.alamy.com/stock-photo/ancient-reflection-pool-marble-rim.html',
    'used': 'heaven sanctuary fountain rim monumental neoclassical white quartz marble fountain reflecting pool basin with stepped plinth footing, carved acanthus water spout corner piers, fluted basin walls, overhanging coping lip, tranquil celestial water surface, and central bubbling fountain nozzle',
    'limitations': [
        'modular 23-unit wide reflection pool fountain basin rim fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original quartz_block_bottom, quartz_block_lines, quartz_block_chiseled, water_placeholder, calcite pixels unchanged; clean reflection pool and disturbed/drained texture variants'
    ]
}

D = build('fountain_rim', cs, a, regions, plan, area='heaven')

checker(D, [0, 4.5, 0], [26, 16, 26])
views(D, [0, 4.5, 0], {
    'front': [0, 9.0, 24],
    'three_quarter': [20, 16, 20],
    'back': [-20, 16, -20],
    'gameplay_scale': [28, 22, 28],
    'spout_close': [9.0, 4.5, 9.0],
    'jet_close': [0, 7.0, 8.0]
})

# Create disturbed / drained variant (cracked marble, drained dry basin)
im_disturbed = Image.open(D/'fountain_rim.png').convert('RGBA')
im_disturbed.paste(Image.open(S/'calcite.png').convert('RGBA'), (0, 0)) # cracked marble plinth
im_disturbed.paste(Image.open(S/'calcite.png').convert('RGBA'), (16, 0))
for xx in (0, 16):
    for yy in (16, 32):
        im_disturbed.paste(Image.open(S/'calcite.png').convert('RGBA'), (xx, yy)) # drained dry basin bed
im_disturbed.save(D/'fountain_rim_disturbed.png')
(D/'fountain_rim_clean.png').write_bytes((D/'fountain_rim.png').read_bytes())

call('create_texture', {'name': 'fountain_rim_disturbed', 'data': str(D/'fountain_rim_disturbed.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'fountain_rim_disturbed'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 4.5, 0], {
        'front_disturbed': [0, 9.0, 24],
        'three_quarter_disturbed': [20, 16, 20]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Finish (exports models, verifies UVs, closes project tab)
finish('fountain_rim', 'Fountain rim', 'Temple pedestal', 'Altar steps', area='heaven')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['clean', 'disturbed'],
    'textures': ['fountain_rim.png', 'fountain_rim_clean.png', 'fountain_rim_disturbed.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'spout_close.png', 'jet_close.png', 'front_disturbed.png', 'three_quarter_disturbed.png']
}, indent=2))

print("Heaven Fountain rim complete and verified with 100% full coverage!")
