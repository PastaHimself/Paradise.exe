import sys
sys.path.insert(0, '/home/pasta/Downloads/blockbench')
from paradise_exe_v2.production_tools.pipeline import *
from paradise_exe_v2.production_tools.checker import checker
from paradise_exe_v2.production_tools.audit_geometry import check_z_fighting_and_collisions

cs = []
a = {}

def c(n, lo, hi, m, off=[]):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, off, False)

# 1. Perimeter concrete frame (16x16 outer face, 2 units deep)
# Face south (against wall at z=1.0) is culled
c('frame_left', [-8, 0, -1.0], [-4, 16, 1.0], 'concrete', off=['south'])
c('frame_right', [4, 0, -1.0], [8, 16, 1.0], 'concrete', off=['south'])
c('frame_top', [-4, 12, -1.0], [4, 16, 1.0], 'concrete', off=['south', 'west', 'east'])
c('frame_bottom', [-4, 0, -1.0], [4, 3, 1.0], 'concrete', off=['south', 'west', 'east'])

# 2. Fractured concrete substrate back wall recessed in the spall cavity
# Culled on all contact boundaries, north face exposed
c('spall_back', [-4, 3, 0.5], [4, 12, 1.0], 'cracked', off=['south', 'down', 'up', 'west', 'east'])

# 3. Jagged fractured concrete ledges (adjusted to clear rebar rods)
c('spall_ledge_left', [-3.75, 3.0, -0.5], [-2.0, 3.75, 0.5], 'cracked', off=['down', 'south'])
c('spall_ledge_top', [-0.75, 11.25, -0.5], [1.0, 12.0, 0.5], 'cracked', off=['up', 'south'])

# 4. Corroded steel rebar grid
c('rebar_v1', [-1.75, 3.0, -0.25], [-1.0, 12.0, 0.0], 'rebar', off=['down', 'up'])
c('rebar_v2', [1.25, 3.0, -0.25], [2.0, 12.0, 0.0], 'rebar', off=['down', 'up'])
c('rebar_h1', [-3.75, 5.5, 0.125], [3.75, 6.25, 0.375], 'rebar', off=[])
c('rebar_h2', [-3.75, 9.25, 0.125], [3.75, 10.0, 0.375], 'rebar', off=[])

# 5. Broken bent rebar stub protruding forward into the stairwell
c('rebar_bent_stub', [1.25, 7.5, -0.75], [2.0, 8.25, -0.25], 'rebar', off=['south'])

# 6. Broken concrete chunk fallen on the bottom frame ledge
c('fallen_spall_chunk', [0.0, 3.0, -1.125], [1.25, 3.875, -0.625], 'cracked', off=['down'])

# Rigorous automated collision and z-fighting check
errs = check_z_fighting_and_collisions(cs, a)
if errs:
    print('AUDIT FAILED with errors:')
    for e in errs:
        print(' -', e)
    sys.exit(1)
print(f'Audit passed: {len(cs)} cubes, 0 volume overlaps, 0 coplanar z-fighting faces.')

regions = {
    'concrete': (0, 0, 'concrete_gray.png', 16, 16),
    'cracked': (16, 0, 'stonebrick_cracked.png', 16, 16),
    'rebar': (32, 0, 'raw_iron_block.png', 16, 16)
}

plan = {
    'reference': 'https://apolodorltd.co.uk/concrete-spalling-and-rebar-corrosion/',
    'used': 'structural concrete stairwell wall spall cavity exposing corroded reinforcing steel grid with bent severed stub',
    'limitations': [
        '16x16 modular wall panel with 8x9 spalled cavity and 0.75-unit rebar grid',
        'culled contact planes with 0 volume overlaps and 0 coplanar z-fighting',
        'original concrete_gray, stonebrick_cracked, and raw_iron_block pixels unchanged; no physics or pack integration'
    ]
}

# Clear any elements if project open
call('risky_eval', {'code': '(() => { if (Project) { Project.elements.slice().forEach(e => e.remove()); Project.textures.slice().forEach(t => t.remove()); } return true; })()'})

D = build('exposed_rebar', cs, a, regions, plan, area='endless_staircase')
checker(D, [0, 8, 0], [20, 16, -26])
views(D, [0, 8, 0], {
    'front': [0, 8, -26],
    'three_quarter': [18, 14, -22],
    'back': [-18, 14, 22],
    'gameplay_scale': [28, 22, -34],
    'rebar_close': [2, 8, -12]
})
print('Exposed rebar build complete and screenshots saved.', flush=True)
