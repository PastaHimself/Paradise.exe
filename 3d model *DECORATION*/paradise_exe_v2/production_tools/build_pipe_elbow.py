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

# 1. Main pipe runs (4x4 diameter schedule 40 industrial conduit)
c('pipe_horizontal', [-8.0, 6.0, 3.0], [-2.0, 10.0, 7.0], 'pipe', off=['east'])
c('pipe_elbow_corner', [-2.0, 6.0, 3.0], [2.0, 10.0, 7.0], 'pipe', off=['west', 'up', 'south'])
c('pipe_vertical', [-2.0, 10.0, 3.0], [2.0, 16.0, 7.0], 'pipe', off=['down'])

# 2. Horizontal flanged collar ring (split into 4 non-overlapping lips)
c('flange_h_top', [-5.5, 10.0, 2.5], [-4.5, 10.5, 7.5], 'flange', off=['down'])
c('flange_h_bottom', [-5.5, 5.5, 2.5], [-4.5, 6.0, 7.5], 'flange', off=['up'])
c('flange_h_front', [-5.5, 6.0, 2.5], [-4.5, 10.0, 3.0], 'flange', off=['south'])
c('flange_h_back', [-5.5, 6.0, 7.0], [-4.5, 10.0, 7.5], 'flange', off=['north'])

# 3. Vertical flanged collar ring (split into 4 non-overlapping lips)
c('flange_v_left', [-2.5, 12.5, 2.5], [-2.0, 13.5, 7.5], 'flange', off=['east'])
c('flange_v_right', [2.0, 12.5, 2.5], [2.5, 13.5, 7.5], 'flange', off=['west'])
c('flange_v_front', [-2.0, 12.5, 2.5], [2.0, 13.5, 3.0], 'flange', off=['south'])
c('flange_v_back', [-2.0, 12.5, 7.0], [2.0, 13.5, 7.5], 'flange', off=['north'])

# 4. Wall support bracket and anchor plate
c('wall_strut', [-1.5, 7.0, 7.0], [1.5, 9.0, 7.75], 'flange', off=['north', 'south'])
c('wall_plate', [-3.0, 6.0, 7.75], [3.0, 10.0, 8.0], 'flange', off=['north', 'south'])

# 5. Wall anchor bolts (4 on wall plate)
for bx in [-2.25, 2.25]:
    for by in [6.75, 9.25]:
        c(f'bolt_wall_{bx}_{by}', [bx - 0.25, by - 0.25, 7.5], [bx + 0.25, by + 0.25, 7.75], 'dark_metal', off=['south'])

# 6. Flange bolts (2 on horizontal flange, 2 on vertical flange)
c('bolt_fh_1', [-5.375, 10.125, 2.25], [-4.625, 10.375, 2.5], 'dark_metal', off=['south'])
c('bolt_fh_2', [-5.375, 5.625, 2.25], [-4.625, 5.875, 2.5], 'dark_metal', off=['south'])
c('bolt_fv_1', [-2.25, 12.75, 2.25], [-2.0, 13.25, 2.5], 'dark_metal', off=['south'])
c('bolt_fv_2', [2.0, 12.75, 2.25], [2.25, 13.25, 2.5], 'dark_metal', off=['south'])

# Geometry audit
errs = check_z_fighting_and_collisions(cs, a)
if errs:
    print('AUDIT FAILED:')
    for e in errs:
        print(' -', e)
    sys.exit(1)
print(f'Audit passed: {len(cs)} cubes, 0 volume overlaps, 0 coplanar z-fighting faces.')

regions = {
    'pipe': (0, 0, 'iron_block.png', 16, 16),
    'flange': (16, 0, 'cauldron_side.png', 16, 16),
    'dark_metal': (32, 0, 'netherite_block.png', 16, 16)
}

plan = {
    'reference': 'https://www.pipingmart.com/industrial-pipe-fittings/90-degree-elbow',
    'used': 'commercial stairwell schedule 40 industrial steel pipe 90-degree elbow turn with bolted flange collars and wall mounting saddle',
    'limitations': [
        'modular 4x4 pipe turning from horizontal West (X=-8) to vertical Up (Y=16) with wall anchor at Z=8.0',
        'culled contact planes with 0 volume overlaps and 0 coplanar z-fighting',
        'original iron_block, cauldron_side, and netherite_block pixels unchanged; no physics or pack integration'
    ]
}

# Clear any elements if project open
call('risky_eval', {'code': '(() => { if (Project) { Project.elements.slice().forEach(e => e.remove()); Project.textures.slice().forEach(t => t.remove()); } return true; })()'})

D = build('pipe_elbow', cs, a, regions, plan, area='endless_staircase')
checker(D, [-2.5, 11, 5.0], [18, 20, -16])
views(D, [-2.5, 11, 5.0], {
    'front': [-2.5, 11, -22],
    'three_quarter': [18, 20, -16],
    'back': [-20, 18, 24],
    'gameplay_scale': [30, 26, -32],
    'elbow_close': [-1, 10, -4]
})
print('Pipe elbow build complete.', flush=True)
