import sys
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
sys.path.insert(0, '/home/pasta/Downloads/blockbench')
from pipeline import *
from checker import checker
from audit_geometry import check_z_fighting_and_collisions

cs = []
a = {}
def c(n, lo, hi, m, off=[]):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, off, False)

# 1. Perimeter Banding Frame (16x16, 2.0 high)
c('band_north', [-8.0, 0.0, -8.0], [8.0, 2.0, -7.25], 'metal', off=['down'])
c('band_south', [-8.0, 0.0, 7.25], [8.0, 2.0, 8.0], 'metal', off=['down'])
c('band_west', [-8.0, 0.0, -7.25], [-7.25, 2.0, 7.25], 'metal', off=['down', 'north', 'south'])
c('band_east', [7.25, 0.0, -7.25], [8.0, 2.0, 7.25], 'metal', off=['down', 'north', 'south'])

# 2. Longitudinal Bearing Bars (5 bars running North-South, Y in [0, 2.0])
bb_x = [
    ('bb1', -5.5, -5.0),
    ('bb2', -3.0, -2.5),
    ('bb3', -0.5, 0.5),
    ('bb4', 2.5, 3.0),
    ('bb5', 5.0, 5.5)
]
for name, x0, x1 in bb_x:
    c(name, [x0, 0.0, -7.25], [x1, 2.0, 7.25], 'metal', off=['down', 'north', 'south'])

# 3. Transverse Cross Rods (at Z = -3.5, Z = 0.0, Z = 3.5; Y in [1.5, 2.0])
x_intervals = [
    (-7.25, -5.5),
    (-5.0, -3.0),
    (-2.5, -0.5),
    (0.5, 2.5),
    (3.0, 5.0),
    (5.5, 7.25)
]
for z_idx, z_mid in enumerate([-3.5, 0.0, 3.5]):
    for x_idx, (x0, x1) in enumerate(x_intervals):
        c(f'cross_{z_idx}_{x_idx}', [x0, 1.5, z_mid - 0.25], [x1, 2.0, z_mid + 0.25], 'metal', off=['east', 'west', 'down'])

# 4. Saddle Clips (4 corners)
clips = [
    ('clip_nw', -5.6, -4.9, -5.5, -4.5),
    ('clip_ne', 4.9, 5.6, -5.5, -4.5),
    ('clip_sw', -5.6, -4.9, 4.5, 5.5),
    ('clip_se', 4.9, 5.6, 4.5, 5.5)
]
for name, x0, x1, z0, z1 in clips:
    c(name, [x0, 2.0, z0], [x1, 2.3, z1], 'dark_metal', off=['down'])
    c(f'{name}_bolt', [x0 + 0.2, 2.3, z0 + 0.35], [x1 - 0.2, 2.6, z1 - 0.35], 'dark_metal', off=['down'])

errs = check_z_fighting_and_collisions(cs, a)
if errs:
    print('AUDIT FAILED:')
    for e in errs:
        print(' -', e)
    sys.exit(1)
print(f'Audit passed: {len(cs)} cubes, 0 volume overlaps, 0 coplanar z-fighting faces.')

regions = {
    'metal': (0, 0, 'iron_block.png', 32, 32),
    'dark_metal': (32, 0, 'netherite_block.png', 16, 16)
}

plan = {
    'reference': 'https://sino-grating.com/',
    'used': 'commercial industrial catwalk welded steel bar grating panel with perimeter trim banding, parallel load-bearing bars, transverse cross rods, and bolted saddle clips',
    'limitations': [
        'modular 16x16 walkway grating panel fitting standard Minecraft floor opening with 0 volume overlaps and 0 coplanar z-fighting',
        'original iron_block and netherite_block pixels unchanged; open void slots allow through-visibility; static floor block; no dynamic deformation physics'
    ]
}

# Clear any elements if project open
call('risky_eval', {'code': '(() => { if (Project) { Project.elements.slice().forEach(e => e.remove()); Project.textures.slice().forEach(t => t.remove()); } return true; })()'})

D = build('metal_grating', cs, a, regions, plan, area='endless_staircase')
checker(D, [0, 1.3, 0], [22, 20, -18])
views(D, [0, 1.3, 0], {
    'front': [0, 14, -24],
    'three_quarter': [22, 20, -18],
    'back': [-22, 20, 22],
    'gameplay_scale': [34, 28, -28],
    'clip_close': [-5, 4, -5]
})

finish('metal_grating', 'Metal grating', 'Broken grating', 'Support beam', area='endless_staircase')
print('Metal grating build and verification complete.', flush=True)
