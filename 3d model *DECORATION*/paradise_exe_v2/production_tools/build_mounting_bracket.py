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

# 1. Wall backplate (mounted at Z=8 against wall)
c('backplate', [-3.0, 2.0, 7.5], [3.0, 14.0, 8.0], 'steel', off=['south'])

# 2. Horizontal cantilever support beam
c('cantilever_arm', [-1.0, 9.0, 2.0], [1.0, 10.5, 7.5], 'steel', off=['south'])

# 3. Stepped diagonal gusset brace (under cantilever arm)
c('brace_lower', [-0.75, 3.5, 6.25], [0.75, 5.5, 7.5], 'steel', off=['south'])
c('brace_mid', [-0.75, 5.5, 4.75], [0.75, 7.25, 6.25], 'steel', off=['south'])
c('brace_upper', [-0.75, 7.25, 3.25], [0.75, 9.0, 4.75], 'steel', off=['up'])

# 4. Pipe saddle / cradle clamp on top of arm
c('cradle_base', [-2.0, 10.5, 3.0], [2.0, 11.25, 5.0], 'steel', off=['down'])
c('cradle_lip_left', [-2.0, 11.25, 3.0], [-1.25, 12.5, 5.0], 'steel', off=['down'])
c('cradle_lip_right', [1.25, 11.25, 3.0], [2.0, 12.5, 5.0], 'steel', off=['down'])

# 5. Wall anchor bolts (4 on backplate)
for bx in [-2.0, 2.0]:
    for by in [3.5, 12.5]:
        c(f'bolt_wall_{bx}_{by}', [bx - 0.25, by - 0.25, 7.25], [bx + 0.25, by + 0.25, 7.5], 'dark_metal', off=['south'])

# 6. Clamp hardware bolts on cradle lips
c('clamp_bolt_l', [-1.75, 12.5, 3.75], [-1.5, 12.875, 4.25], 'dark_metal', off=['down'])
c('clamp_bolt_r', [1.5, 12.5, 3.75], [1.75, 12.875, 4.25], 'dark_metal', off=['down'])

# Geometry audit
errs = check_z_fighting_and_collisions(cs, a)
if errs:
    print('AUDIT FAILED:')
    for e in errs:
        print(' -', e)
    sys.exit(1)
print(f'Audit passed: {len(cs)} cubes, 0 volume overlaps, 0 coplanar z-fighting faces.')

regions = {
    'steel': (0, 0, 'iron_block.png', 16, 16),
    'dark_metal': (16, 0, 'netherite_block.png', 16, 16)
}

plan = {
    'reference': 'https://www.unistrut.us/products/brackets-fittings/',
    'used': 'commercial industrial heavy steel channel cantilever wall bracket with diagonal gusset brace, wall backplate, and pipe saddle clamp',
    'limitations': [
        'modular cantilever wall bracket supporting standard 4x4 pipe and conduit at Z=4.0',
        'culled contact planes with 0 volume overlaps and 0 coplanar z-fighting',
        'original iron_block and netherite_block pixels unchanged; no physics or pack integration'
    ]
}

# Clear any elements if project open
call('risky_eval', {'code': '(() => { if (Project) { Project.elements.slice().forEach(e => e.remove()); Project.textures.slice().forEach(t => t.remove()); } return true; })()'})

D = build('mounting_bracket', cs, a, regions, plan, area='endless_staircase')
checker(D, [0, 8, 5.0], [18, 18, -14])
views(D, [0, 8, 5.0], {
    'front': [0, 9, -20],
    'three_quarter': [18, 18, -14],
    'back': [-18, 16, 24],
    'gameplay_scale': [28, 24, -28],
    'cradle_close': [0, 11, -2]
})
print('Mounting bracket build complete.', flush=True)
