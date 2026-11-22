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

# 1. Outer Frame (16 wide, 30 high, depth Z: 6.5 to 9.5)
c('frame_left', [-8.0, 0.0, 6.5], [-6.75, 30.0, 9.5], 'frame', off=[])
c('frame_right', [6.75, 0.0, 6.5], [8.0, 30.0, 9.5], 'frame', off=[])
c('frame_head', [-6.75, 28.75, 6.5], [6.75, 30.0, 9.5], 'frame', off=['east', 'west'])
c('frame_threshold', [-6.75, 0.0, 6.5], [6.75, 0.25, 9.5], 'dark_metal', off=['east', 'west'])

# 2. Main Door Leaf (sits inside frame with 0.125 clearance to prevent z-fighting with jambs)
c('door_leaf', [-6.625, 0.375, 7.5], [6.625, 28.625, 8.5], 'leaf', off=[])

# 3. Narrow Vision Lite Window (wire glass fire slit)
c('window_bezel', [1.5, 16.0, 7.4], [4.25, 24.0, 7.5], 'frame', off=['south'])
c('window_glass', [2.0, 16.5, 7.35], [3.75, 23.5, 7.4], 'glass', off=['south'])
c('window_rear_bezel', [1.5, 16.0, 8.5], [4.25, 24.0, 8.6], 'frame', off=['north'])
c('window_rear_glass', [2.0, 16.5, 8.6], [3.75, 23.5, 8.65], 'glass', off=['north'])

# 4. Kick Plate at bottom of leaf
c('kick_plate_front', [-6.5, 0.5, 7.4], [6.5, 3.5, 7.5], 'dark_metal', off=['south'])
c('kick_plate_rear', [-6.5, 0.5, 8.5], [6.5, 3.5, 8.6], 'dark_metal', off=['north'])

# 5. Panic Crash Bar Assembly (front side)
c('panic_chassis_l', [-5.5, 12.0, 6.75], [-4.25, 14.5, 7.4], 'dark_metal', off=['south'])
c('panic_chassis_r', [4.25, 12.0, 6.75], [5.5, 14.5, 7.4], 'dark_metal', off=['south'])
c('panic_push_bar', [-4.25, 12.5, 6.25], [4.25, 14.0, 6.75], 'panic_red', off=['east', 'west'])
c('panic_strike', [5.75, 12.5, 6.75], [6.625, 14.0, 7.35], 'dark_metal', off=['south'])

# 6. Overhead Hydraulic Door Closer
c('closer_body', [-4.5, 26.75, 6.75], [-0.5, 28.5, 7.4], 'frame', off=['south'])
c('closer_arm_shoe', [-1.0, 28.875, 6.0], [2.5, 29.5, 6.5], 'dark_metal', off=['south'])
c('closer_scissor_arm', [-1.5, 27.85, 6.4], [0.5, 28.35, 6.75], 'dark_metal', off=['south'])

# 7. Exterior Pull Handle (rear side of door)
c('ext_pull_plate', [4.75, 11.5, 8.5], [6.0, 16.5, 8.6], 'dark_metal', off=['north'])
c('ext_pull_handle', [5.1, 12.0, 8.6], [5.65, 16.0, 9.25], 'frame', off=['north'])

# 8. Hinges on left jamb (3 commercial butt hinges)
for hy in [4.0, 15.0, 26.0]:
    c(f'hinge_{hy}', [-6.75, hy, 7.15], [-6.4, hy + 2.0, 7.4], 'dark_metal', off=['west', 'south'])

errs = check_z_fighting_and_collisions(cs, a)
if errs:
    print('AUDIT FAILED:')
    for e in errs:
        print(' -', e)
    sys.exit(1)
print(f'Audit passed: {len(cs)} cubes, 0 volume overlaps, 0 coplanar z-fighting faces.')

regions = {
    'frame': (0, 0, 'iron_block.png', 32, 32),
    'leaf': (32, 0, 'concrete_gray.png', 32, 32),
    'dark_metal': (0, 32, 'netherite_block.png', 16, 16),
    'panic_red': (16, 32, 'concrete_red.png', 16, 16),
    'glass': (32, 32, 'tinted_glass.png', 16, 16)
}

plan = {
    'reference': 'https://dortechardware.com/',
    'used': 'commercial hollow metal fire exit door with heavy steel frame, crash push bar, vision lite fire slit, overhead hydraulic closer, and exterior pull trim',
    'limitations': [
        'modular 16-unit width, 30-unit height emergency egress door fitting Bedrock block standards',
        'culled contact planes with 0 volume overlaps and 0 coplanar z-fighting',
        'original iron_block, concrete_gray, netherite_block, concrete_red, and tinted_glass pixels unchanged; static closed door; no physics or swing animation'
    ]
}

# Clear any elements if project open
call('risky_eval', {'code': '(() => { if (Project) { Project.elements.slice().forEach(e => e.remove()); Project.textures.slice().forEach(t => t.remove()); } return true; })()'})

D = build('emergency_door', cs, a, regions, plan, area='endless_staircase')
checker(D, [0, 15, 8], [28, 24, -36])
views(D, [0, 15, 8], {
    'front': [0, 15, -42],
    'three_quarter': [28, 24, -36],
    'back': [-28, 24, 48],
    'gameplay_scale': [44, 32, -60],
    'push_bar_close': [0, 13, 0]
})

finish('emergency_door', 'Emergency door', 'Chained service door', 'Barricaded landing', area='endless_staircase')
print('Emergency door build and verification complete.', flush=True)
