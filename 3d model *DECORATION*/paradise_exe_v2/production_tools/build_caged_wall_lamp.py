import sys
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
sys.path.insert(0, '/home/pasta/Downloads/blockbench')
from pipeline import *
from checker import checker
from audit_geometry import check_z_fighting_and_collisions

def make_lamp_elements(variant='normal'):
    cs = []
    a = {}
    def c(n, lo, hi, m, off=[]):
        cs.append({'name': n, 'from': lo, 'to': hi})
        a[n] = (m, off, False)

    # Backplate (8 wide, 8 high, mounted at Z=8 against wall)
    c('backplate', [-4.0, 6.0, 7.25], [4.0, 14.0, 8.0], 'metal', off=['south'])

    # Conduit entry hubs
    c('conduit_top', [-1.0, 14.0, 7.0], [1.0, 15.0, 8.0], 'metal', off=['down', 'south'])
    c('conduit_bottom', [-1.0, 5.0, 7.0], [1.0, 6.0, 8.0], 'metal', off=['up', 'south'])

    # Mounting screws (4 corners of backplate)
    c('screw_tl', [-3.5, 13.0, 7.0], [-3.0, 13.5, 7.25], 'dark_metal', off=['south'])
    c('screw_tr', [3.0, 13.0, 7.0], [3.5, 13.5, 7.25], 'dark_metal', off=['south'])
    c('screw_bl', [-3.5, 6.5, 7.0], [-3.0, 7.0, 7.25], 'dark_metal', off=['south'])
    c('screw_br', [3.0, 6.5, 7.0], [3.5, 7.0, 7.25], 'dark_metal', off=['south'])

    # Socket collar
    c('socket_collar', [-2.75, 7.25, 6.0], [2.75, 12.75, 7.25], 'metal', off=['south'])

    # Lamp globe (clearance inside cage: X [-2, 2], Y [8, 12], Z [2.5, 6.0])
    globe_mat = 'globe'
    if variant == 'red':
        globe_mat = 'globe_red'
    elif variant == 'dead':
        globe_mat = 'globe_dead'
    c('lamp_globe', [-2.0, 8.0, 2.5], [2.0, 12.0, 6.0], globe_mat, off=['south'])

    # Cage ribs (connecting collar to front)
    c('cage_rib_top', [-0.25, 12.25, 2.25], [0.25, 12.75, 6.0], 'cage', off=['south', 'north'])
    c('cage_rib_bottom', [-0.25, 7.25, 2.25], [0.25, 7.75, 6.0], 'cage', off=['south', 'north'])
    c('cage_rib_left', [-2.75, 9.75, 2.25], [-2.25, 10.25, 6.0], 'cage', off=['south', 'north'])
    c('cage_rib_right', [2.25, 9.75, 2.25], [2.75, 10.25, 6.0], 'cage', off=['south', 'north'])

    # Front cage bars (Z in [1.75, 2.25])
    c('cage_front_vert', [-0.25, 7.75, 1.75], [0.25, 12.25, 2.25], 'cage', off=['up', 'down'])
    c('cage_front_horiz_l', [-2.25, 9.75, 1.75], [-0.25, 10.25, 2.25], 'cage', off=['east', 'west'])
    c('cage_front_horiz_r', [0.25, 9.75, 1.75], [2.25, 10.25, 2.25], 'cage', off=['east', 'west'])
    c('cage_front_top', [-0.25, 12.25, 1.75], [0.25, 12.75, 2.25], 'cage', off=['south', 'down'])
    c('cage_front_bottom', [-0.25, 7.25, 1.75], [0.25, 7.75, 2.25], 'cage', off=['south', 'up'])
    c('cage_front_left', [-2.75, 9.75, 1.75], [-2.25, 10.25, 2.25], 'cage', off=['south', 'east'])
    c('cage_front_right', [2.25, 9.75, 1.75], [2.75, 10.25, 2.25], 'cage', off=['south', 'west'])

    return cs, a

cs, a = make_lamp_elements('normal')
errs = check_z_fighting_and_collisions(cs, a)
if errs:
    print('AUDIT FAILED:')
    for e in errs:
        print(' -', e)
    sys.exit(1)
print(f'Audit passed: {len(cs)} cubes, 0 volume overlaps, 0 coplanar z-fighting faces.')

regions = {
    'metal': (0, 0, 'cauldron_side.png', 16, 16),
    'globe': (16, 0, 'shroomlight.png', 16, 16),
    'globe_red': (32, 0, 'redstone_block.png', 16, 16),
    'globe_dead': (48, 0, 'redstone_lamp_off.png', 16, 16),
    'cage': (0, 16, 'iron_block.png', 16, 16),
    'dark_metal': (16, 16, 'netherite_block.png', 16, 16)
}

plan = {
    'reference': 'https://www.industrial-lighting.co.uk/vapour-tight-bulkhead-caged-wall-lights/',
    'used': 'commercial stairwell vapor-tight caged bulkhead wall lamp with heavy junction backplate, dual conduit hubs, glass globe, and protective steel wire cage',
    'limitations': [
        'modular wall fixture mounted at Z=8 with 0.25-unit cage clearance around globe',
        'variants: normal (shroomlight), red (redstone_block), and dead (redstone_lamp_off)',
        'culled contact planes with 0 volume overlaps and 0 coplanar z-fighting',
        'original cauldron_side, shroomlight, redstone_block, redstone_lamp_off, iron_block, and netherite_block pixels unchanged; no light-emitting dynamic physics or pack integration'
    ]
}

# Clear any elements if project open
call('risky_eval', {'code': '(() => { if (Project) { Project.elements.slice().forEach(e => e.remove()); Project.textures.slice().forEach(t => t.remove()); } return true; })()'})

D = build('caged_wall_lamp', cs, a, regions, plan, area='endless_staircase')
checker(D, [0, 10, 5], [14, 14, -6])
views(D, [0, 10, 5], {
    'front': [0, 10, -12],
    'three_quarter': [14, 14, -6],
    'back': [-14, 14, 18],
    'gameplay_scale': [24, 20, -18],
    'globe_close': [0, 10, 0]
})

# Export variants (red, dead)
for vtype in ['red', 'dead']:
    v_cs, v_a = make_lamp_elements(vtype)
    call('risky_eval', {'code': '(() => { Project.elements.slice().forEach(e => e.remove()); return true; })()'})
    call('place_cube', {'elements': v_cs, 'faces': False})
    for q in v_cs:
        dx, dy, dz = [b - a for a, b in zip(q['from'], q['to'])]
        m, off, rot = v_a[q['name']]
        x, y, f = regions[m][:3]
        faces = {}
        for face, (w, h) in {'north': (dx, dy), 'south': (dx, dy), 'east': (dz, dy), 'west': (dz, dy), 'up': (dx, dz), 'down': (dx, dz)}.items():
            faces[face] = {'uv': [x/4, y/4, (x+w)/4, (y+h)/4], 'texture': 'caged_wall_lamp'} if face not in off else {'texture': None}
        call('set_cube_uv', {'id': q['name'], 'box_uv': False, 'faces': faces})
    call('export_model', {'codec_id': 'bedrock', 'path': str(D / f'endless_staircase_caged_wall_lamp_{vtype}.geo.json'), 'overwrite': True, 'max_content_length': 0})
    call('export_model', {'codec_id': 'project', 'path': str(D / f'endless_staircase_caged_wall_lamp_{vtype}.bbmodel'), 'overwrite': True, 'max_content_length': 0})
    views(D, [0, 10, 5], {f'front_{vtype}': [0, 10, -12]})

# Restore primary normal model
call('risky_eval', {'code': '(() => { Project.elements.slice().forEach(e => e.remove()); return true; })()'})
call('place_cube', {'elements': cs, 'faces': False})
for q in cs:
    dx, dy, dz = [b - a for a, b in zip(q['from'], q['to'])]
    m, off, rot = a[q['name']]
    x, y, f = regions[m][:3]
    faces = {}
    for face, (w, h) in {'north': (dx, dy), 'south': (dx, dy), 'east': (dz, dy), 'west': (dz, dy), 'up': (dx, dz), 'down': (dx, dz)}.items():
        faces[face] = {'uv': [x/4, y/4, (x+w)/4, (y+h)/4], 'texture': 'caged_wall_lamp'} if face not in off else {'texture': None}
    call('set_cube_uv', {'id': q['name'], 'box_uv': False, 'faces': faces})

finish('caged_wall_lamp', 'Caged wall lamp', 'Small step light', 'Emergency door', area='endless_staircase')
print('Caged wall lamp build and verification complete.', flush=True)
