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

# Heaven: Disturbed rest bench geometry
# Collapsed, fractured, and tipped-over neoclassical white marble rest bench with snapped right support leg, tilted fractured seat slab, broken backrest, sheared armrest, and scattered floor chips

# 1. Left support leg (still standing) (Y: 0.0 to 3.6)
c('foot_left', [-8.0, 0.0, -3.0], [-6.0, 1.2, 3.0], 'quartz_chiseled')
c('shaft_left', [-7.5, 1.2, -2.5], [-6.5, 3.6, 2.5], 'quartz_fluted')

# 2. Center leg broken stump (Y: 0.0 to 2.5)
c('foot_center', [-1.0, 0.0, -2.5], [1.0, 1.2, 2.5], 'quartz_chiseled')
c('stump_center', [-0.6, 1.2, -2.0], [0.0, 2.5, 2.0], 'fracture_calcite')

# 3. Fallen collapsed right leg (lying on floor) (Y: 0.0 to 1.2)
c('foot_r_fallen', [6.0, 0.0, -1.0], [8.0, 1.2, 4.5], 'quartz_chiseled')
c('shaft_r_fallen', [5.5, 0.0, -4.5], [8.5, 1.0, -1.0], 'quartz_fluted')

# 4. Broken seat slab halves (Y: 1.2 to 5.2)
c('seat_left_tilted', [-8.5, 3.6, -3.5], [-0.2, 5.2, 3.5], 'quartz_smooth')
c('seat_right_fallen', [0.2, 1.2, -3.2], [7.8, 2.8, 3.2], 'quartz_smooth')

# 5. Fractured backrest pieces (Y: 2.8 to 10.4)
c('back_l_standing', [-7.5, 5.2, -3.5], [-0.5, 9.2, -2.5], 'quartz_bricks')
c('back_l_coping', [-8.5, 9.2, -3.8], [-0.2, 10.4, -2.2], 'quartz_smooth')
c('back_r_collapsed', [0.5, 2.8, -2.5], [7.0, 6.2, -1.5], 'quartz_bricks')
c('back_r_coping_chunk', [1.0, 2.8, -1.2], [6.5, 3.8, 0.2], 'quartz_smooth')

# 6. Left standing armrest (Y: 5.2 to 8.8)
c('arm_l_upright', [-8.5, 5.2, -2.5], [-7.5, 7.8, 3.0], 'quartz_chiseled')
c('arm_l_scroll', [-8.8, 7.8, -2.5], [-7.2, 8.8, 3.2], 'quartz_smooth')

# 7. Sheared fallen right armrest (lying on floor) (Y: 0.0 to 1.6)
c('arm_r_fallen', [8.2, 0.0, 0.0], [9.8, 1.6, 5.0], 'quartz_smooth')

# 8. Fractured stone spalls on floor
c('chip_1', [-0.2, 0.0, 2.8], [1.2, 0.8, 4.0], 'fracture_calcite')
c('chip_2', [3.5, 0.0, 3.5], [5.0, 0.6, 4.8], 'fracture_calcite')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'quartz_smooth': (0, 0, 'quartz_block_bottom.png', 16, 16),
    'quartz_bricks': (16, 0, 'quartz_bricks.png', 16, 16),
    'quartz_fluted': (32, 0, 'quartz_block_lines.png', 16, 16),
    'quartz_chiseled': (48, 0, 'quartz_block_chiseled.png', 16, 16),
    'fracture_calcite': (0, 16, 'calcite.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/broken-classical-marble-bench, https://www.alamy.com/stock-photo/ruined-marble-bench-fallen-parts.html',
    'used': 'heaven sanctuary disturbed rest bench geometry collapsed and fractured white marble exedra bench with collapsed right leg, broken diagonal seat slab, split backrest, fallen sheared armrest, and floor fragments',
    'limitations': [
        'modular 18.6-unit wide disturbed bench geometry fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original quartz_block_bottom, quartz_bricks, quartz_block_lines, quartz_block_chiseled, calcite pixels unchanged; dry and weathered variants'
    ]
}

D = build('disturbed_rest_bench_geometry', cs, a, regions, plan, area='heaven')

checker(D, [0, 5.0, 0], [22, 20, 22])
views(D, [0, 5.0, 0], {
    'front': [0, 6.0, 18],
    'three_quarter': [16, 14, 16],
    'back': [-16, 14, -16],
    'gameplay_scale': [24, 18, 24],
    'collapse_close': [4.0, 4.0, 8.0],
    'break_close': [0, 4.0, 8.0]
})

# Create weathered variant texture and views
im_weathered = Image.open(D/'disturbed_rest_bench_geometry.png').convert('RGBA')
im_weathered.paste(Image.open(S/'calcite.png').convert('RGBA'), (0, 0))
im_weathered.save(D/'disturbed_rest_bench_geometry_weathered.png')
(D/'disturbed_rest_bench_geometry_standard.png').write_bytes((D/'disturbed_rest_bench_geometry.png').read_bytes())

call('create_texture', {'name': 'disturbed_rest_bench_geometry_weathered', 'data': str(D/'disturbed_rest_bench_geometry_weathered.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'disturbed_rest_bench_geometry_weathered'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 5.0, 0], {
        'front_weathered': [0, 6.0, 18],
        'three_quarter_weathered': [16, 14, 16]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Finish (exports models, verifies UVs, closes project tab)
finish('disturbed_rest_bench_geometry', 'Disturbed rest bench geometry', 'Bedside table', 'Disturbed bedside table geometry', area='heaven')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['standard', 'weathered'],
    'textures': ['disturbed_rest_bench_geometry.png', 'disturbed_rest_bench_geometry_standard.png', 'disturbed_rest_bench_geometry_weathered.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'collapse_close.png', 'break_close.png', 'front_weathered.png', 'three_quarter_weathered.png']
}, indent=2))

print("Heaven Disturbed rest bench geometry complete and verified with 100% full coverage!")
