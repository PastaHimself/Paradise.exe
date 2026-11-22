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

# 1. Undamaged Rear Half (Z in [-4.0, 0.0]) - Full length X: [-8.0, 8.0]
c('rear_base', [-8.0, 0.0, -4.0], [8.0, 3.0, 0.0], 'concrete', off=['down', 'south'])
c('rear_batter', [-8.0, 3.0, -3.0], [8.0, 6.0, 0.0], 'concrete', off=['down', 'south'])
c('rear_stem', [-8.0, 6.0, -1.75], [8.0, 13.0, 0.0], 'concrete', off=['down', 'south'])
c('rear_cap', [-8.0, 13.0, -1.25], [8.0, 14.0, 0.0], 'concrete', off=['down', 'south'])

# 2. Front Half Intact Ends (Left: X in [-8.0, -3.5], Right: X in [3.5, 8.0])
c('front_left_base', [-8.0, 0.0, 0.0], [-3.5, 3.0, 4.0], 'concrete', off=['down', 'north', 'east'])
c('front_left_batter', [-8.0, 3.0, 0.0], [-3.5, 6.0, 3.0], 'concrete', off=['down', 'north', 'east'])
c('front_left_stem', [-8.0, 6.0, 0.0], [-3.5, 13.0, 1.75], 'concrete', off=['down', 'north', 'east'])
c('front_left_cap', [-8.0, 13.0, 0.0], [-3.5, 14.0, 1.25], 'concrete', off=['down', 'north', 'east'])

c('front_right_base', [3.5, 0.0, 0.0], [8.0, 3.0, 4.0], 'concrete', off=['down', 'north', 'west'])
c('front_right_batter', [3.5, 3.0, 0.0], [8.0, 6.0, 3.0], 'concrete', off=['down', 'north', 'west'])
c('front_right_stem', [3.5, 6.0, 0.0], [8.0, 13.0, 1.75], 'concrete', off=['down', 'north', 'west'])
c('front_right_cap', [3.5, 13.0, 0.0], [8.0, 14.0, 1.25], 'concrete', off=['down', 'north', 'west'])

# 3. Spall Cavity Perimeter Bounds (Center X in [-3.5, 3.5])
c('cavity_floor', [-3.5, 0.0, 0.0], [3.5, 2.0, 4.0], 'concrete', off=['down', 'north', 'east', 'west'])
c('cavity_back', [-3.5, 2.0, 0.0], [3.5, 10.0, 0.5], 'cracked_concrete', off=['north', 'east', 'west', 'up', 'down'])
c('cavity_top_stem', [-3.5, 10.0, 0.0], [3.5, 13.0, 1.75], 'concrete', off=['north', 'east', 'west', 'down'])
c('cavity_top_cap', [-3.5, 13.0, 0.0], [3.5, 14.0, 1.25], 'concrete', off=['down', 'north', 'east', 'west'])

# 4. Exposed Corroded Rebar Grid inside cavity
c('rebar_v1', [-2.0, 2.0, 0.75], [-1.5, 9.5, 1.25], 'rebar', off=['down', 'up'])
c('rebar_v2_lower', [1.5, 2.0, 0.75], [2.0, 6.0, 1.25], 'rebar', off=['down', 'up'])
c('rebar_v2_bent', [1.5, 6.0, 1.25], [2.0, 9.0, 1.85], 'rebar', off=['down', 'up'])
c('rebar_h1', [-3.25, 5.0, 1.3], [1.5, 5.5, 1.8], 'rebar', off=['east', 'west'])

# 5. Fallen Concrete Spall Rubble Chunk (on pavement in front)
c('spall_chunk_main', [-1.5, 0.0, 4.25], [1.5, 1.5, 5.75], 'concrete', off=['down'])
c('spall_chunk_small', [1.75, 0.0, 4.5], [2.75, 0.85, 5.5], 'concrete', off=['down'])

# 6. Modular End Connections
c('loop_w_lower', [-8.5, 4.0, -0.35], [-8.0, 4.75, 0.35], 'steel', off=['east'])
c('loop_w_upper', [-8.5, 10.0, -0.35], [-8.0, 10.75, 0.35], 'steel', off=['east'])

c('loop_e_n_lower', [8.0, 2.5, -0.4], [8.4, 3.25, -0.15], 'steel', off=['west'])
c('loop_e_s_lower', [8.0, 2.5, 0.15], [8.4, 3.25, 0.4], 'steel', off=['west'])
c('loop_e_tip_lower', [8.4, 2.5, -0.4], [8.65, 3.25, 0.4], 'steel', off=['west'])
c('drop_pin_stub', [8.15, 1.5, -0.1], [8.35, 4.5, 0.1], 'steel', off=['down'])

errs = check_z_fighting_and_collisions(cs, a)
if errs:
    print('AUDIT FAILED:')
    for e in errs:
        print(' -', e)
    sys.exit(1)
print(f'Audit passed: {len(cs)} cubes, 0 volume overlaps, 0 coplanar z-fighting faces.')

regions = {
    'concrete': (0, 0, 'concrete_gray.png', 32, 32),
    'cracked_concrete': (32, 0, 'stonebrick_cracked.png', 16, 16),
    'rebar': (48, 0, 'raw_iron_block.png', 16, 16),
    'steel': (32, 16, 'iron_block.png', 16, 16)
}

plan = {
    'reference': 'https://online-pdh.com/concrete-barrier-impact-damage-spalling-rebar/',
    'used': 'severe vehicle crash impact damage on highway concrete Jersey barrier with massive front spalling cavity, fractured inner aggregate, exposed bent rebar grid, pavement spall rubble, and sheared connection pin',
    'limitations': [
        'modular 16-unit length damaged median divider segment with 0 volume overlaps and 0 coplanar z-fighting',
        'original concrete_gray, stonebrick_cracked, raw_iron_block, and iron_block pixels unchanged; static damage geometry; no vehicle collision physics'
    ]
}

# Clear any elements if project open
call('risky_eval', {'code': '(() => { if (Project) { Project.elements.slice().forEach(e => e.remove()); Project.textures.slice().forEach(t => t.remove()); } return true; })()'})

D = build('damaged_divider', cs, a, regions, plan, area='burning_highway')
checker(D, [0, 7, 0], [22, 18, -18])
views(D, [0, 7, 0], {
    'front': [0, 10, -24],
    'three_quarter': [22, 18, -18],
    'back': [-22, 18, 22],
    'gameplay_scale': [34, 26, -28],
    'cavity_close': [0, 6, 6]
})

finish('damaged_divider', 'Damaged divider', 'Bent guardrail', 'Guardrail end', area='burning_highway')
print('Damaged divider build and verification complete.', flush=True)
