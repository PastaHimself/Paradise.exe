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

# 1. Perimeter Banding Frame
# North band (intact)
c('band_north', [-8.0, 0.0, -8.0], [8.0, 2.0, -7.25], 'metal', off=['down'])
# South band (intact)
c('band_south', [-8.0, 0.0, 7.25], [8.0, 2.0, 8.0], 'metal', off=['down'])
# West band (intact)
c('band_west', [-8.0, 0.0, -7.25], [-7.25, 2.0, 7.25], 'metal', off=['down', 'north', 'south'])
# East band (partially severed by impact: split into north and south stubs with buckled notch)
c('band_east_n', [7.25, 0.0, -7.25], [8.0, 2.0, -1.5], 'metal', off=['down', 'north'])
c('band_east_s', [7.25, 0.0, 2.5], [8.0, 2.0, 7.25], 'metal', off=['down', 'south'])
# Buckled inward east band lip
c('band_east_bent', [6.5, 0.0, -1.5], [7.25, 1.8, 0.5], 'metal', off=['down'])

# 2. Longitudinal Bearing Bars
# Bar 1 (intact along west edge)
c('bb1', [-5.5, 0.0, -7.25], [-5.0, 2.0, 7.25], 'metal', off=['down', 'north', 'south'])
# Bar 2 (intact)
c('bb2', [-3.0, 0.0, -7.25], [-2.5, 2.0, 7.25], 'metal', off=['down', 'north', 'south'])

# Bar 3 (center bar: severed with a 5.5-unit hazard gap between -2.5 and +3.0)
c('bb3_n', [-0.5, 0.0, -7.25], [0.5, 2.0, -2.5], 'metal', off=['down', 'north'])
c('bb3_s', [-0.5, 0.0, 3.0], [0.5, 2.0, 7.25], 'metal', off=['down', 'south'])

# Bar 4 (fractured: north stub, severed south stub, and downward bent dangle)
c('bb4_n', [2.5, 0.0, -7.25], [3.0, 2.0, -3.0], 'metal', off=['down', 'north'])
c('bb4_s', [2.5, 0.0, 3.5], [3.0, 2.0, 7.25], 'metal', off=['down', 'south'])
# Downward bent dangle hanging into void under breach
c('bb4_bent_down', [2.5, -2.0, -3.0], [3.0, 0.0, -1.75], 'metal', off=[])

# Bar 5 (severed near center)
c('bb5_n', [5.0, 0.0, -7.25], [5.5, 2.0, -2.0], 'metal', off=['down', 'north'])
c('bb5_s', [5.0, 0.0, 2.0], [5.5, 2.0, 7.25], 'metal', off=['down', 'south'])

# 3. Transverse Cross Rods (only in intact zones; omitted in breach hole)
# Row at Z = -3.5 (crosses bb1, bb2, bb3, bb4, bb5)
c('cross_n_0', [-7.25, 1.5, -3.75], [-5.5, 2.0, -3.25], 'metal', off=['east', 'west', 'down'])
c('cross_n_1', [-5.0, 1.5, -3.75], [-3.0, 2.0, -3.25], 'metal', off=['east', 'west', 'down'])
c('cross_n_2', [-2.5, 1.5, -3.75], [-0.5, 2.0, -3.25], 'metal', off=['east', 'west', 'down'])
c('cross_n_3', [0.5, 1.5, -3.75], [2.5, 2.0, -3.25], 'metal', off=['east', 'west', 'down'])
c('cross_n_4', [3.0, 1.5, -3.75], [5.0, 2.0, -3.25], 'metal', off=['east', 'west', 'down'])

# Row at Z = 0.0 (crosses bb1 and bb2 only! bb3-bb5 is the gaping hole)
c('cross_m_0', [-7.25, 1.5, -0.25], [-5.5, 2.0, 0.25], 'metal', off=['east', 'west', 'down'])
c('cross_m_1', [-5.0, 1.5, -0.25], [-3.0, 2.0, 0.25], 'metal', off=['east', 'west', 'down'])
c('cross_m_stub', [-2.5, 1.5, -0.25], [-1.25, 2.0, 0.25], 'metal', off=['west', 'down'])

# Row at Z = 3.5 (crosses bb1, bb2, bb3, bb4, bb5)
c('cross_s_0', [-7.25, 1.5, 3.25], [-5.5, 2.0, 3.75], 'metal', off=['east', 'west', 'down'])
c('cross_s_1', [-5.0, 1.5, 3.25], [-3.0, 2.0, 3.75], 'metal', off=['east', 'west', 'down'])
c('cross_s_2', [-2.5, 1.5, 3.25], [-0.5, 2.0, 3.75], 'metal', off=['east', 'west', 'down'])
c('cross_s_3', [0.5, 1.5, 3.25], [2.5, 2.0, 3.75], 'metal', off=['east', 'west', 'down'])
c('cross_s_4', [3.0, 1.5, 3.25], [5.0, 2.0, 3.75], 'metal', off=['east', 'west', 'down'])

# 4. Wedged Fallen Bar Scrap Fragment inside the hole
c('scrap_wedged', [0.25, 0.5, -0.5], [4.5, 1.0, 1.0], 'metal', off=[])

# 5. Saddle Clips
# Intact clips (NW, NE, SW)
c('clip_nw', [-5.6, 2.0, -5.5], [-4.9, 2.3, -4.5], 'dark_metal', off=['down'])
c('clip_nw_bolt', [-5.4, 2.3, -5.15], [-5.1, 2.6, -4.85], 'dark_metal', off=['down'])
c('clip_ne', [4.9, 2.0, -5.5], [5.6, 2.3, -4.5], 'dark_metal', off=['down'])
c('clip_ne_bolt', [5.1, 2.3, -5.15], [5.4, 2.6, -4.85], 'dark_metal', off=['down'])
c('clip_sw', [-5.6, 2.0, 4.5], [-4.9, 2.3, 5.5], 'dark_metal', off=['down'])
c('clip_sw_bolt', [-5.4, 2.3, 4.85], [-5.1, 2.6, 5.15], 'dark_metal', off=['down'])
# Damaged sheared clip at SE
c('clip_se_sheared', [4.8, 2.0, 4.75], [5.7, 2.25, 5.75], 'dark_metal', off=['down'])

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
    'reference': 'https://osha.gov/',
    'used': 'damaged industrial catwalk steel bar grating panel with severe structural rupture, fractured bearing bars, downward bent dangle stub, missing crossbars creating a hazardous fall-through breach, and sheared saddle clips',
    'limitations': [
        'modular 16x16 walkway grating with 0 volume overlaps and 0 coplanar z-fighting',
        'original iron_block and netherite_block pixels unchanged; static damage geometry; no dynamic deformation physics'
    ]
}

# Clear any elements if project open
call('risky_eval', {'code': '(() => { if (Project) { Project.elements.slice().forEach(e => e.remove()); Project.textures.slice().forEach(t => t.remove()); } return true; })()'})

D = build('broken_grating', cs, a, regions, plan, area='endless_staircase')
checker(D, [0, 0.5, 0], [22, 20, -18])
views(D, [0, 0.5, 0], {
    'front': [0, 14, -24],
    'three_quarter': [22, 20, -18],
    'back': [-22, 20, 22],
    'gameplay_scale': [34, 28, -28],
    'breach_close': [2, 4, 0]
})

finish('broken_grating', 'Broken grating', 'Support beam', 'Hanging shaft cable', area='endless_staircase')
print('Broken grating build and verification complete.', flush=True)
