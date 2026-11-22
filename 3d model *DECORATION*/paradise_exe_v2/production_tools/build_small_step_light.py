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

# 1. Backing cavity box (sits against wall at Z=8)
c('back_box', [-3.5, 3.5, 7.5], [3.5, 7.5, 8.0], 'housing', off=['south', 'north'])

# 2. Bezel / Faceplate perimeter (Z: 6.75 to 7.5)
# Top bezel
c('bezel_top', [-4.0, 7.5, 6.75], [4.0, 8.0, 7.5], 'metal', off=['south', 'down'])
# Bottom bezel
c('bezel_bottom', [-4.0, 3.0, 6.75], [4.0, 3.5, 7.5], 'metal', off=['south', 'up'])
# Left bezel
c('bezel_left', [-4.0, 3.5, 6.75], [-3.5, 7.5, 7.5], 'metal', off=['south', 'east'])
# Right bezel
c('bezel_right', [3.5, 3.5, 6.75], [4.0, 7.5, 7.5], 'metal', off=['south', 'west'])

# 3. Fastener screws on left and right bezel
c('screw_left', [-3.85, 5.25, 6.6], [-3.65, 5.75, 6.75], 'dark_metal', off=['south'])
c('screw_right', [3.65, 5.25, 6.6], [3.85, 5.75, 6.75], 'dark_metal', off=['south'])

# 4. LED emitter strip (recessed under top bezel)
c('led_strip', [-3.0, 7.1, 7.2], [3.0, 7.45, 7.45], 'light', off=['up', 'south'])

# 5. Upper louver slat (stepped downward baffle)
c('louver_top_rear', [-3.25, 6.25, 7.1], [3.25, 6.6, 7.35], 'metal', off=['south', 'east', 'west'])
c('louver_top_front', [-3.25, 5.85, 6.85], [3.25, 6.25, 7.1], 'metal', off=['north', 'east', 'west', 'south'])

# 6. Lower louver slat (stepped downward baffle)
c('louver_bot_rear', [-3.25, 4.85, 7.1], [3.25, 5.2, 7.35], 'metal', off=['south', 'east', 'west'])
c('louver_bot_front', [-3.25, 4.45, 6.85], [3.25, 4.85, 7.1], 'metal', off=['north', 'east', 'west', 'south'])

# 7. Interior bottom reflector / shelf
c('reflector_floor', [-3.25, 3.5, 7.0], [3.25, 3.75, 7.45], 'metal', off=['down', 'south', 'east', 'west'])

errs = check_z_fighting_and_collisions(cs, a)
if errs:
    print('AUDIT FAILED:')
    for e in errs:
        print(' -', e)
    sys.exit(1)
print(f'Audit passed: {len(cs)} cubes, 0 volume overlaps, 0 coplanar z-fighting faces.')

regions = {
    'housing': (0, 0, 'cauldron_side.png', 16, 16),
    'metal': (16, 0, 'iron_block.png', 16, 16),
    'dark_metal': (32, 0, 'netherite_block.png', 16, 16),
    'light': (48, 0, 'ochre_froglight_side.png', 16, 16)
}

plan = {
    'reference': 'https://westgatemfg.com/products/sle-lh-series-commercial-recessed-step-light',
    'used': 'commercial stairwell low-profile recessed step luminaire with heavy cast faceplate, downward directional louvers, tamper-proof screws, and recessed warm LED strip',
    'limitations': [
        'modular 8x5 low-wall fixture mounted at Z=8 with downward glare-shielding louvers',
        'culled internal contact planes with 0 volume overlaps and 0 coplanar z-fighting',
        'original cauldron_side, iron_block, netherite_block, and ochre_froglight_side pixels unchanged; no lighting engine or dynamic pack integration'
    ]
}

# Clear any elements if project open
call('risky_eval', {'code': '(() => { if (Project) { Project.elements.slice().forEach(e => e.remove()); Project.textures.slice().forEach(t => t.remove()); } return true; })()'})

D = build('small_step_light', cs, a, regions, plan, area='endless_staircase')
checker(D, [0, 5.5, 7.25], [12, 10, -4])
views(D, [0, 5.5, 7.25], {
    'front': [0, 5.5, -10],
    'three_quarter': [12, 10, -4],
    'back': [-12, 10, 16],
    'gameplay_scale': [20, 16, -14],
    'louver_close': [0, 5.5, 3]
})

finish('small_step_light', 'Small step light', 'Emergency door', 'Chained service door', area='endless_staircase')
print('Small step light build and verification complete.', flush=True)
