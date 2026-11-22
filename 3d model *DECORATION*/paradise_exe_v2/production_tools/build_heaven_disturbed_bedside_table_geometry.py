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

# Heaven: Disturbed bedside table geometry
# Collapsed and damaged neoclassical white quartz nightstand with broken SE leg, crooked open drawer, fractured tabletop slab with fallen right piece, broken lower shelf, and floor chips

# 1. 3 Standing legs (NW, NE, SW) (Y: 0.0 to 12.0)
c('leg_nw', [-5.2, 0.0, -4.2], [-3.8, 12.0, -2.8], 'quartz_fluted')
c('leg_ne', [3.8, 0.0, -4.2], [5.2, 12.0, -2.8], 'quartz_fluted')
c('leg_sw', [-5.2, 0.0, 2.8], [-3.8, 12.0, 4.2], 'quartz_fluted')

# 2. Broken SE leg (broken into lower stump and fallen tipped strut) (Y: 0.0 to 2.5)
c('leg_se_stump', [3.8, 0.0, 2.8], [5.2, 2.5, 4.2], 'fracture_calcite')
c('leg_se_fallen', [5.5, 0.0, 2.0], [8.5, 1.2, 5.0], 'quartz_fluted')

# 3. Cabinet carcass body (Y: 6.8 to 12.0)
c('carcass', [-3.8, 6.8, -2.8], [3.8, 12.0, 2.8], 'quartz_chiseled')

# 4. Crooked drawer pulled forward and tilted (Y: 7.0 to 11.0, Z: 2.8 to 4.7)
c('drawer_box', [-2.8, 7.0, 2.8], [3.2, 8.2, 3.5], 'quartz_smooth')
c('drawer_face', [-3.0, 7.2, 3.5], [3.4, 11.0, 4.1], 'quartz_smooth')
c('drawer_knob', [-0.2, 8.6, 4.1], [1.0, 9.6, 4.7], 'brass_knob')

# 5. Fractured tabletop pieces (left slab on carcass; right broken piece fallen to floor)
c('top_left', [-6.0, 12.0, -5.0], [3.8, 13.2, 5.0], 'quartz_smooth')
c('top_right_fallen', [5.5, 1.2, -4.5], [9.5, 2.4, 1.5], 'quartz_smooth')

# 6. Broken lower shelf halves (Y: 0.0 to 3.5)
c('shelf_left', [-3.8, 2.5, -2.8], [-0.2, 3.5, 2.8], 'quartz_smooth')
c('shelf_right_fallen', [0.5, 0.0, -2.2], [3.6, 0.8, 2.5], 'fracture_calcite')

# 7. Scattered marble fracture chips on floor
c('chip_1', [-2.5, 0.0, 3.2], [-1.0, 0.6, 4.5], 'fracture_calcite')
c('chip_2', [2.2, 0.0, 3.5], [3.4, 0.7, 4.6], 'fracture_calcite')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'quartz_smooth': (0, 0, 'quartz_block_bottom.png', 16, 16),
    'quartz_fluted': (16, 0, 'quartz_block_lines.png', 16, 16),
    'quartz_chiseled': (32, 0, 'quartz_block_chiseled.png', 16, 16),
    'brass_knob': (48, 0, 'gilded_blackstone.png', 16, 16),
    'fracture_calcite': (0, 16, 'calcite.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/broken-antique-bedside-table, https://www.alamy.com/stock-photo/ruined-marble-nightstand-drawer.html',
    'used': 'heaven sanctuary disturbed bedside table geometry collapsed neoclassical white quartz nightstand with sheared SE leg, jarred crooked drawer, split tabletop with fallen right slab, fractured lower shelf, and floor debris',
    'limitations': [
        'modular 15.5-unit wide disturbed nightstand geometry fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original quartz_block_bottom, quartz_block_lines, quartz_block_chiseled, gilded_blackstone, calcite pixels unchanged; dry and weathered variants'
    ]
}

D = build('disturbed_bedside_table_geometry', cs, a, regions, plan, area='heaven')

checker(D, [1.5, 6.5, 0], [20, 20, 20])
views(D, [1.5, 6.5, 0], {
    'front': [1.5, 7.0, 18],
    'three_quarter': [16, 14, 16],
    'back': [-16, 14, -16],
    'gameplay_scale': [24, 18, 24],
    'drawer_close': [0, 9.0, 8.0],
    'break_close': [5.0, 3.0, 8.0]
})

# Create weathered variant texture and views
im_weathered = Image.open(D/'disturbed_bedside_table_geometry.png').convert('RGBA')
im_weathered.paste(Image.open(S/'calcite.png').convert('RGBA'), (0, 0))
im_weathered.save(D/'disturbed_bedside_table_geometry_weathered.png')
(D/'disturbed_bedside_table_geometry_standard.png').write_bytes((D/'disturbed_bedside_table_geometry.png').read_bytes())

call('create_texture', {'name': 'disturbed_bedside_table_geometry_weathered', 'data': str(D/'disturbed_bedside_table_geometry_weathered.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'disturbed_bedside_table_geometry_weathered'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [1.5, 6.5, 0], {
        'front_weathered': [1.5, 7.0, 18],
        'three_quarter_weathered': [16, 14, 16]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Finish (exports models, verifies UVs, closes project tab)
finish('disturbed_bedside_table_geometry', 'Disturbed bedside table geometry', 'White chest casing', 'Disturbed white chest geometry', area='heaven')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['standard', 'weathered'],
    'textures': ['disturbed_bedside_table_geometry.png', 'disturbed_bedside_table_geometry_standard.png', 'disturbed_bedside_table_geometry_weathered.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'drawer_close.png', 'break_close.png', 'front_weathered.png', 'three_quarter_weathered.png']
}, indent=2))

print("Heaven Disturbed bedside table geometry complete and verified with 100% full coverage!")
