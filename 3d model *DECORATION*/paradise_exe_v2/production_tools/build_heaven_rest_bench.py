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

# Heaven: Rest bench
# Elegant neoclassical white marble sanctuary exedra rest bench with molded slab seat, baluster support legs, low backrest panel with coping rail, and side scroll armrests

# 1. Molded seat slab (Y: 4.5 to 6.0)
c('seat_slab', [-8.5, 4.5, -3.5], [8.5, 6.0, 3.5], 'quartz_smooth')

# 2. Left support leg with molded foot and shaft (Y: 0.0 to 4.5)
c('foot_left', [-8.0, 0.0, -3.0], [-6.0, 1.2, 3.0], 'quartz_chiseled')
c('shaft_left', [-7.5, 1.2, -2.5], [-6.5, 4.5, 2.5], 'quartz_fluted')

# 3. Right support leg with molded foot and shaft (Y: 0.0 to 4.5)
c('foot_right', [6.0, 0.0, -3.0], [8.0, 1.2, 3.0], 'quartz_chiseled')
c('shaft_right', [6.5, 1.2, -2.5], [7.5, 4.5, 2.5], 'quartz_fluted')

# 4. Center support leg (Y: 0.0 to 4.5)
c('foot_center', [-1.0, 0.0, -2.5], [1.0, 1.2, 2.5], 'quartz_chiseled')
c('shaft_center', [-0.6, 1.2, -2.0], [0.6, 4.5, 2.0], 'quartz_fluted')

# 5. Classical backrest panel & molded coping rail (Y: 6.0 to 11.2)
c('back_panel', [-7.5, 6.0, -3.5], [7.5, 10.0, -2.5], 'quartz_bricks')
c('back_coping', [-8.5, 10.0, -3.8], [8.5, 11.2, -2.2], 'quartz_smooth')

# 6. Side scroll armrests (Y: 6.0 to 9.5)
c('arm_upright_l', [-8.5, 6.0, -2.5], [-7.5, 8.5, 3.0], 'quartz_chiseled')
c('arm_scroll_l', [-8.8, 8.5, -2.5], [-7.2, 9.5, 3.2], 'quartz_smooth')
c('arm_upright_r', [7.5, 6.0, -2.5], [8.5, 8.5, 3.0], 'quartz_chiseled')
c('arm_scroll_r', [7.2, 8.5, -2.5], [8.8, 9.5, 3.2], 'quartz_smooth')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'quartz_smooth': (0, 0, 'quartz_block_bottom.png', 16, 16),
    'quartz_bricks': (16, 0, 'quartz_bricks.png', 16, 16),
    'quartz_fluted': (32, 0, 'quartz_block_lines.png', 16, 16),
    'quartz_chiseled': (48, 0, 'quartz_block_chiseled.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/classical-white-marble-bench, https://www.alamy.com/stock-photo/ancient-greek-marble-garden-bench.html',
    'used': 'heaven sanctuary rest bench neoclassical white marble exedra bench with molded seat slab, three baluster leg supports, backrest panel with coping rail, and scroll armrests',
    'limitations': [
        'modular 17.6-unit wide white rest bench fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        '100% full face coverage (every face textured, 0 untextured faces); original quartz_block_bottom, quartz_bricks, quartz_block_lines, quartz_block_chiseled pixels unchanged; clean and disturbed texture variants'
    ]
}

D = build('rest_bench', cs, a, regions, plan, area='heaven')

checker(D, [0, 5.5, 0], [22, 20, 22])
views(D, [0, 5.5, 0], {
    'front': [0, 6.0, 18],
    'three_quarter': [16, 14, 16],
    'back': [-16, 14, -16],
    'gameplay_scale': [24, 18, 24],
    'armrest_close': [-8.0, 7.5, 8.0],
    'seat_close': [0, 6.0, 8.0]
})

# Create disturbed texture variant (stained, micro-fissured crystalline marble)
im_disturbed = Image.open(D/'rest_bench.png').convert('RGBA')
im_disturbed.paste(Image.open(S/'calcite.png').convert('RGBA'), (0, 0))
im_disturbed.paste(Image.open(S/'calcite.png').convert('RGBA'), (16, 0))
im_disturbed.save(D/'rest_bench_disturbed.png')
(D/'rest_bench_clean.png').write_bytes((D/'rest_bench.png').read_bytes())

call('create_texture', {'name': 'rest_bench_disturbed', 'data': str(D/'rest_bench_disturbed.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'rest_bench_disturbed'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 5.5, 0], {
        'front_disturbed': [0, 6.0, 18],
        'three_quarter_disturbed': [16, 14, 16]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Finish (exports models, verifies UVs, closes project tab)
finish('rest_bench', 'Rest bench', 'Disturbed rest bench geometry', 'Bedside table', area='heaven')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['clean', 'disturbed'],
    'textures': ['rest_bench.png', 'rest_bench_clean.png', 'rest_bench_disturbed.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'armrest_close.png', 'seat_close.png', 'front_disturbed.png', 'three_quarter_disturbed.png']
}, indent=2))

print("Heaven Rest bench complete and verified with 100% full coverage!")
