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

# 2. Main Service Door Leaf (Z: 7.5 to 8.5)
c('door_leaf', [-6.625, 0.375, 7.5], [6.625, 28.625, 8.5], 'leaf', off=[])

# 3. Lower HVAC / Mechanical Louver Vent (recessed on lower door)
c('vent_frame_top', [-4.5, 7.0, 7.35], [4.5, 7.5, 7.5], 'dark_metal', off=['south', 'down'])
c('vent_frame_bot', [-4.5, 2.0, 7.35], [4.5, 2.5, 7.5], 'dark_metal', off=['south', 'up'])
c('vent_frame_l', [-4.5, 2.5, 7.35], [-4.0, 7.0, 7.5], 'dark_metal', off=['south', 'east'])
c('vent_frame_r', [4.0, 2.5, 7.35], [4.5, 7.0, 7.5], 'dark_metal', off=['south', 'west'])
c('vent_slat1', [-4.0, 5.75, 7.35], [4.0, 6.25, 7.5], 'dark_metal', off=['south', 'east', 'west'])
c('vent_slat2', [-4.0, 4.5, 7.35], [4.0, 5.0, 7.5], 'dark_metal', off=['south', 'east', 'west'])
c('vent_slat3', [-4.0, 3.25, 7.35], [4.0, 3.75, 7.5], 'dark_metal', off=['south', 'east', 'west'])

# 4. Door Handle Hardware (heavy pull handle on leaf)
c('handle_plate', [4.0, 12.0, 7.35], [5.25, 17.0, 7.5], 'dark_metal', off=['south'])
c('handle_top_post', [4.35, 15.75, 6.6], [4.9, 16.5, 7.35], 'metal', off=['south'])
c('handle_bot_post', [4.35, 12.5, 6.6], [4.9, 13.25, 7.35], 'metal', off=['south'])
c('handle_bar', [4.35, 13.25, 6.1], [4.9, 15.75, 6.6], 'metal', off=['up', 'down'])

# 5. Security Chain Staple on Right Jamb (frame_right is X: [6.75, 8.0], Z: [6.5, 9.5])
c('jamb_staple', [6.75, 14.0, 5.6], [7.5, 15.0, 6.5], 'dark_metal', off=['south'])

# 6. Security Chain Wrap (loops around handle and anchors to jamb staple)
c('chain_span', [4.6, 14.15, 5.35], [6.75, 14.85, 5.95], 'metal', off=['east', 'west'])
c('chain_wrap_front', [3.6, 14.0, 5.35], [4.6, 15.0, 5.95], 'metal', off=['east'])
c('chain_wrap_side', [3.6, 14.0, 5.95], [4.15, 15.0, 6.75], 'metal', off=['north'])
c('chain_dangle', [3.6, 11.75, 5.35], [4.25, 14.0, 5.95], 'metal', off=['up', 'down'])

# 7. Heavy Brass Padlock
c('padlock_shackle', [3.65, 11.0, 5.45], [4.2, 11.75, 5.85], 'metal', off=['up', 'down'])
c('padlock_body', [3.45, 9.25, 5.2], [4.45, 11.0, 6.1], 'brass', off=['up'])

# 8. Hinges on left jamb (3 butt hinges)
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
    'leaf': (32, 0, 'cauldron_side.png', 32, 32),
    'dark_metal': (0, 32, 'netherite_block.png', 16, 16),
    'metal': (16, 32, 'iron_block.png', 16, 16),
    'brass': (32, 32, 'gold_block.png', 16, 16)
}

plan = {
    'reference': 'https://www.dreamstime.com/heavy-metal-service-door-locked-chain-padlock-image185203941',
    'used': 'abandoned commercial heavy steel service door secured shut with thick iron security chain looped through pull handle and padlocked to jamb staple',
    'limitations': [
        'modular 16-unit width, 30-unit height utility service door with lower ventilation louvers and padlock chain wrap',
        'culled contact planes with 0 volume overlaps and 0 coplanar z-fighting',
        'original iron_block, cauldron_side, netherite_block, and gold_block pixels unchanged; static locked door; no physics or chain simulation'
    ]
}

# Clear any elements if project open
call('risky_eval', {'code': '(() => { if (Project) { Project.elements.slice().forEach(e => e.remove()); Project.textures.slice().forEach(t => t.remove()); } return true; })()'})

D = build('chained_service_door', cs, a, regions, plan, area='endless_staircase')
checker(D, [0, 15, 8], [28, 24, -36])
views(D, [0, 15, 8], {
    'front': [0, 15, -42],
    'three_quarter': [28, 24, -36],
    'back': [-28, 24, 48],
    'gameplay_scale': [44, 32, -60],
    'padlock_close': [4.5, 13, 1]
})

finish('chained_service_door', 'Chained service door', 'Barricaded landing', 'Staircase hatch', area='endless_staircase')
print('Chained service door build and verification complete.', flush=True)
