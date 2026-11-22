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

# 1. Support Posts (ground Y=0 up to blockout height)
c('post_l_flange_f', [-6.5, 0.0, -2.5], [-5.5, 10.5, -2.15], 'steel', off=['down'])
c('post_l_flange_b', [-6.5, 0.0, -3.5], [-5.5, 10.5, -3.15], 'steel', off=['down'])
c('post_l_web', [-6.25, 0.0, -3.15], [-5.75, 10.5, -2.5], 'steel', off=['down', 'north', 'south'])

c('post_r_lower', [4.75, 0.0, -2.5], [5.75, 4.0, -1.75], 'steel', off=['down', 'up'])
c('post_r_bent', [4.75, 4.0, -3.75], [5.75, 8.5, -2.75], 'steel', off=['down'])

# 2. Spacer Blockouts (between posts and rail)
c('blockout_l', [-6.35, 6.0, -2.15], [-5.65, 10.5, -0.75], 'dark_metal', off=['north', 'south'])
c('blockout_r', [4.85, 4.5, -2.75], [5.65, 8.5, -1.25], 'dark_metal', off=['north'])

# 3. W-Beam Corrugated Rail (culled internal horizontal Y boundaries)
# Left run (X: -8.0 to -4.0, Z near 0)
c('w_left_top', [-8.0, 9.0, -0.75], [-4.0, 10.5, 0.0], 'steel', off=['east', 'down'])
c('w_left_mid', [-8.0, 7.25, -0.75], [-4.0, 9.0, -0.4], 'steel', off=['east', 'up', 'down'])
c('w_left_bot', [-8.0, 5.5, -0.75], [-4.0, 7.25, 0.0], 'steel', off=['east', 'up'])

# Bent impact zone (X: -4.0 to 0.0, bowing forward to Z=2.5)
c('w_bow_in_top', [-4.0, 8.75, 0.0], [0.0, 10.25, 2.5], 'steel', off=['west', 'east', 'down'])
c('w_bow_in_mid', [-4.0, 7.25, -0.4], [0.0, 8.75, 2.1], 'steel', off=['west', 'east', 'up', 'down'])
c('w_bow_in_bot', [-4.0, 5.5, 0.0], [0.0, 7.25, 2.5], 'steel', off=['west', 'east', 'up'])

# Bent impact zone (X: 0.0 to 4.0, returning to Z=0.25)
c('w_bow_out_top', [0.0, 8.75, 0.25], [4.0, 10.25, 2.5], 'steel', off=['west', 'east', 'down'])
c('w_bow_out_mid', [0.0, 7.25, -0.15], [4.0, 8.75, 2.1], 'steel', off=['west', 'east', 'up', 'down'])
c('w_bow_out_bot', [0.0, 5.5, 0.25], [4.0, 7.25, 2.5], 'steel', off=['west', 'east', 'up'])

# Right run (X: 4.0 to 8.0, twisted and crumpled)
c('w_right_top', [4.0, 8.25, -0.5], [8.0, 9.75, 0.25], 'steel', off=['west', 'down'])
c('w_right_mid', [4.0, 6.75, -0.9], [8.0, 8.25, -0.15], 'steel', off=['west', 'up', 'down'])
c('w_right_bot', [4.0, 5.25, -0.5], [8.0, 6.75, 0.25], 'steel', off=['west', 'up'])

# 4. Hardware Bolts (netherite button-head bolts)
c('bolt_l', [-6.2, 7.8, 0.0], [-5.8, 8.4, 0.25], 'dark_metal', off=['north'])
c('splice_bolt_1', [-0.2, 9.2, 2.5], [0.2, 9.8, 2.75], 'dark_metal', off=['north'])
c('splice_bolt_2', [-0.2, 6.0, 2.5], [0.2, 6.6, 2.75], 'dark_metal', off=['north'])

# 5. Yellow Butterfly Delineator Reflector (mounted in valley at X=-5.0)
c('reflector', [-5.35, 7.6, -0.4], [-4.65, 8.6, -0.2], 'reflector_yellow', off=['north'])

errs = check_z_fighting_and_collisions(cs, a)
if errs:
    print('AUDIT FAILED:')
    for e in errs:
        print(' -', e)
    sys.exit(1)
print(f'Audit passed: {len(cs)} cubes, 0 volume overlaps, 0 coplanar z-fighting faces.')

regions = {
    'steel': (0, 0, 'iron_block.png', 32, 32),
    'dark_metal': (32, 0, 'netherite_block.png', 16, 16),
    'reflector_yellow': (48, 0, 'concrete_yellow.png', 16, 16)
}

plan = {
    'reference': 'https://highwayguardrail.org/',
    'used': 'highway corrugated galvanized W-beam steel guardrail deformed and bowed outward by high-speed vehicle impact, with deflected support post, compressed blockout, button-head splice bolts, and valley delineator reflector',
    'limitations': [
        'modular 16-unit roadway guardrail segment with 0 volume overlaps and 0 coplanar z-fighting',
        'original iron_block, netherite_block, and concrete_yellow pixels unchanged; static damage geometry; no vehicle impact physics'
    ]
}

# Clear any elements if project open
call('risky_eval', {'code': '(() => { if (Project) { Project.elements.slice().forEach(e => e.remove()); Project.textures.slice().forEach(t => t.remove()); } return true; })()'})

D = build('bent_guardrail', cs, a, regions, plan, area='burning_highway')
checker(D, [0, 6, 0], [20, 16, -18])
views(D, [0, 6, 0], {
    'front': [0, 8, -24],
    'three_quarter': [20, 16, -18],
    'back': [-20, 16, 22],
    'gameplay_scale': [32, 24, -28],
    'bow_close': [0, 8, 8]
})

finish('bent_guardrail', 'Bent guardrail', 'Guardrail end', 'Traffic cone', area='burning_highway')
print('Bent guardrail build and verification complete.', flush=True)
