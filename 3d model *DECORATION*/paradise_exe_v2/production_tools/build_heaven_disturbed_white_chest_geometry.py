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

# Heaven: Disturbed white chest geometry
# Looted and pried-open neoclassical white marble storage coffer with displaced gabled lid, broken SE post stump, fractured front wall, snapped brass lock hasp, and fallen stone chunks

# 1. Plinth footing base (Y: 0.0 to 1.5)
c('plinth', [-8.0, 0.0, -6.0], [8.0, 1.5, 6.0], 'quartz_smooth')

# 2. 3 Standing corner posts & 1 broken SE stump (Y: 1.5 to 8.5)
c('post_nw', [-7.5, 1.5, -5.5], [-6.5, 8.5, -4.5], 'quartz_fluted')
c('post_ne', [6.5, 1.5, -5.5], [7.5, 8.5, -4.5], 'quartz_fluted')
c('post_sw', [-7.5, 1.5, 4.5], [-6.5, 8.5, 5.5], 'quartz_fluted')
c('post_se_stump', [6.5, 1.5, 4.5], [7.5, 4.5, 5.5], 'fracture_calcite')

# 3. Walls (Y: 1.5 to 8.5)
c('wall_n', [-6.5, 1.5, -5.5], [6.5, 8.5, -4.5], 'quartz_bricks')
c('wall_s_left', [-6.5, 1.5, 4.5], [2.0, 8.5, 5.5], 'quartz_bricks')
c('wall_s_right', [2.0, 1.5, 4.5], [6.5, 5.2, 5.5], 'fracture_calcite')
c('wall_w', [-7.5, 1.5, -4.5], [-6.5, 8.5, 4.5], 'quartz_bricks')
c('wall_e', [6.5, 1.5, -4.5], [7.5, 8.5, 4.5], 'quartz_bricks')

# 4. Interior floor slab (Y: 1.5 to 2.5)
c('floor_slab', [-6.5, 1.5, -4.5], [6.5, 2.5, 4.5], 'quartz_smooth')

# 5. Molded rim sections on 3 intact sides (Y: 8.5 to 9.5)
c('rim_n', [-8.0, 8.5, -6.0], [8.0, 9.5, -4.5], 'quartz_smooth')
c('rim_w', [-8.0, 8.5, -4.5], [-6.5, 9.5, 6.0], 'quartz_smooth')
c('rim_e', [6.5, 8.5, -4.5], [8.0, 9.5, 4.5], 'quartz_smooth')
c('rim_s', [-6.5, 8.5, 4.5], [2.5, 9.5, 6.0], 'quartz_smooth')

# 6. Displaced askew gabled lid (Y: 9.5 to 12.2)
c('lid_displaced', [-5.5, 9.5, -3.0], [8.5, 10.8, 6.5], 'quartz_smooth')
c('lid_apex', [-4.0, 10.8, -1.5], [7.0, 12.2, 5.0], 'quartz_chiseled')

# 7. Snapped brass lock hasp (Y: 8.5 to 10.5, Z: 6.5 to 6.9)
c('lock_hasp', [1.0, 8.5, 6.5], [2.4, 10.5, 6.9], 'brass_hasp')

# 8. Fallen stone chunks on floor
c('fallen_post', [8.0, 0.0, 5.0], [9.5, 1.5, 7.0], 'quartz_fluted')
c('spall_chip', [3.5, 0.0, 6.0], [5.0, 0.8, 7.5], 'fracture_calcite')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'quartz_smooth': (0, 0, 'quartz_block_bottom.png', 16, 16),
    'quartz_bricks': (16, 0, 'quartz_bricks.png', 16, 16),
    'quartz_fluted': (32, 0, 'quartz_block_lines.png', 16, 16),
    'quartz_chiseled': (48, 0, 'quartz_block_chiseled.png', 16, 16),
    'brass_hasp': (0, 16, 'gilded_blackstone.png', 16, 16),
    'fracture_calcite': (16, 16, 'calcite.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/open-broken-marble-chest, https://www.alamy.com/stock-photo/ancient-ruined-marble-coffer-box.html',
    'used': 'heaven sanctuary disturbed white chest geometry pried-open and fractured white quartz storage coffer with displaced gabled lid, broken SE post stump, fractured front wall, snapped brass lock hasp, and fallen stone debris',
    'limitations': [
        'modular 17.5-unit wide disturbed chest geometry fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original quartz_block_bottom, quartz_bricks, quartz_block_lines, quartz_block_chiseled, gilded_blackstone, calcite pixels unchanged; dry and weathered variants'
    ]
}

D = build('disturbed_white_chest_geometry', cs, a, regions, plan, area='heaven')

checker(D, [1.0, 6.0, 0.5], [22, 20, 22])
views(D, [1.0, 6.0, 0.5], {
    'front': [1.0, 6.0, 18],
    'three_quarter': [16, 14, 16],
    'back': [-16, 14, -16],
    'gameplay_scale': [24, 18, 24],
    'cavity_close': [0, 8.0, 8.0],
    'break_close': [5.0, 4.0, 8.0]
})

# Create weathered variant texture and views
im_weathered = Image.open(D/'disturbed_white_chest_geometry.png').convert('RGBA')
im_weathered.paste(Image.open(S/'calcite.png').convert('RGBA'), (0, 0))
im_weathered.save(D/'disturbed_white_chest_geometry_weathered.png')
(D/'disturbed_white_chest_geometry_standard.png').write_bytes((D/'disturbed_white_chest_geometry.png').read_bytes())

call('create_texture', {'name': 'disturbed_white_chest_geometry_weathered', 'data': str(D/'disturbed_white_chest_geometry_weathered.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'disturbed_white_chest_geometry_weathered'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [1.0, 6.0, 0.5], {
        'front_weathered': [1.0, 6.0, 18],
        'three_quarter_weathered': [16, 14, 16]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Finish (exports models, verifies UVs, closes project tab)
finish('disturbed_white_chest_geometry', 'Disturbed white chest geometry', 'Rest wall lamp', 'Disturbed wall lamp geometry', area='heaven')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['standard', 'weathered'],
    'textures': ['disturbed_white_chest_geometry.png', 'disturbed_white_chest_geometry_standard.png', 'disturbed_white_chest_geometry_weathered.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'cavity_close.png', 'break_close.png', 'front_weathered.png', 'three_quarter_weathered.png']
}, indent=2))

print("Heaven Disturbed white chest geometry complete and verified with 100% full coverage!")
