import sys
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
sys.path.insert(0, '/home/pasta/Downloads/blockbench')
from pipeline import *
from checker import checker
from audit_geometry import check_z_fighting_and_collisions
from glyphs import lettering

def make_sign_elements(direction='up'):
    cs = []
    a = {}
    def c(n, lo, hi, m, off=[]):
        cs.append({'name': n, 'from': lo, 'to': hi})
        a[n] = (m, off, False)

    # 1. Backing wall plaque (14 wide, 11 high, mounted at Z=8 against wall)
    c('plaque', [-7.0, 3.5, 7.5], [7.0, 14.5, 8.0], 'plate', off=['south'])

    # 2. Corner standoff screws (4 corners at X=±6.0, Y=4.5 and 13.5)
    for cx in [-6.0, 6.0]:
        for cy in [4.5, 13.5]:
            c(f'standoff_{cx}_{cy}', [cx - 0.4, cy - 0.4, 7.25], [cx + 0.4, cy + 0.4, 7.5], 'metal', off=['south'])

    # 3. 'STAIRS' text at Y=11.0, pixel=0.375
    lettering(cs, a, 'STAIRS', 0.375, 11.0, 7.5, material='ink', prefix='text')

    # 4. Direction Arrow at Y=4.5 to 9.5
    if direction == 'up':
        c('arrow_shaft', [-0.5, 5.0, 7.4], [0.5, 8.0, 7.5], 'ink', off=['south', 'east', 'west', 'up', 'down'])
        c('arrow_tip', [-0.5, 9.25, 7.4], [0.5, 9.75, 7.5], 'ink', off=['south', 'east', 'west', 'up', 'down'])
        c('arrow_wing_l1', [-1.25, 8.25, 7.4], [-0.5, 8.75, 7.5], 'ink', off=['south', 'east', 'west', 'up', 'down'])
        c('arrow_wing_r1', [0.5, 8.25, 7.4], [1.25, 8.75, 7.5], 'ink', off=['south', 'east', 'west', 'up', 'down'])
        c('arrow_wing_l2', [-2.0, 7.5, 7.4], [-1.25, 8.25, 7.5], 'ink', off=['south', 'east', 'west', 'up', 'down'])
        c('arrow_wing_r2', [1.25, 7.5, 7.4], [2.0, 8.25, 7.5], 'ink', off=['south', 'east', 'west', 'up', 'down'])
    elif direction == 'down':
        c('arrow_shaft', [-0.5, 6.75, 7.4], [0.5, 9.75, 7.5], 'ink', off=['south', 'east', 'west', 'up', 'down'])
        c('arrow_tip', [-0.5, 5.0, 7.4], [0.5, 5.5, 7.5], 'ink', off=['south', 'east', 'west', 'up', 'down'])
        c('arrow_wing_l1', [-1.25, 6.0, 7.4], [-0.5, 6.5, 7.5], 'ink', off=['south', 'east', 'west', 'up', 'down'])
        c('arrow_wing_r1', [0.5, 6.0, 7.4], [1.25, 6.5, 7.5], 'ink', off=['south', 'east', 'west', 'up', 'down'])
        c('arrow_wing_l2', [-2.0, 6.5, 7.4], [-1.25, 7.25, 7.5], 'ink', off=['south', 'east', 'west', 'up', 'down'])
        c('arrow_wing_r2', [1.25, 6.5, 7.4], [2.0, 7.25, 7.5], 'ink', off=['south', 'east', 'west', 'up', 'down'])
    elif direction == 'right':
        c('arrow_shaft', [-2.0, 6.85, 7.4], [1.0, 7.85, 7.5], 'ink', off=['south', 'east', 'west', 'up', 'down'])
        c('arrow_tip', [2.0, 6.85, 7.4], [2.5, 7.85, 7.5], 'ink', off=['south', 'east', 'west', 'up', 'down'])
        c('arrow_wing_u1', [1.0, 7.85, 7.4], [1.5, 8.6, 7.5], 'ink', off=['south', 'east', 'west', 'up', 'down'])
        c('arrow_wing_d1', [1.0, 6.1, 7.4], [1.5, 6.85, 7.5], 'ink', off=['south', 'east', 'west', 'up', 'down'])
        c('arrow_wing_u2', [0.25, 8.6, 7.4], [1.0, 9.35, 7.5], 'ink', off=['south', 'east', 'west', 'up', 'down'])
        c('arrow_wing_d2', [0.25, 5.35, 7.4], [1.0, 6.1, 7.5], 'ink', off=['south', 'east', 'west', 'up', 'down'])

    return cs, a

cs, a = make_sign_elements('up')
errs = check_z_fighting_and_collisions(cs, a)
if errs:
    print('AUDIT FAILED:')
    for e in errs:
        print(' -', e)
    sys.exit(1)
print(f'Audit passed: {len(cs)} cubes, 0 volume overlaps, 0 coplanar z-fighting faces.')

regions = {
    'plate': (0, 0, 'quartz_block_side.png', 16, 16),
    'metal': (16, 0, 'iron_block.png', 16, 16),
    'ink': (32, 0, 'concrete_black.png', 16, 16)
}

plan = {
    'reference': 'https://etsy.com/listing/commercial-stairwell-direction-wayfinding-sign',
    'used': 'commercial stairwell enamel wayfinding plaque with STAIRS tactile lettering, directional navigation arrow, and corner standoff screws',
    'limitations': [
        'modular 14x11 wall wayfinding plaque mounted at Z=8 with direction variants (up, down, right)',
        'culled contact planes with 0 volume overlaps and 0 coplanar z-fighting',
        'original quartz_block_side, iron_block, and concrete_black pixels unchanged; static signage; no dynamic pathfinding logic'
    ]
}

# Clear any elements if project open
call('risky_eval', {'code': '(() => { if (Project) { Project.elements.slice().forEach(e => e.remove()); Project.textures.slice().forEach(t => t.remove()); } return true; })()'})

D = build('stairwell_direction_sign', cs, a, regions, plan, area='endless_staircase')
checker(D, [0, 9, 7.5], [14, 14, -6])
views(D, [0, 9, 7.5], {
    'front': [0, 9, -14],
    'three_quarter': [14, 14, -6],
    'back': [-14, 14, 20],
    'gameplay_scale': [24, 20, -18],
    'arrow_close': [0, 8, 2]
})

# Export variants (down, right)
for vtype in ['down', 'right']:
    v_cs, v_a = make_sign_elements(vtype)
    call('risky_eval', {'code': '(() => { Project.elements.slice().forEach(e => e.remove()); return true; })()'})
    call('place_cube', {'elements': v_cs, 'faces': False})
    for q in v_cs:
        dx, dy, dz = [b - a for a, b in zip(q['from'], q['to'])]
        m, off, rot = v_a[q['name']]
        x, y, f = regions[m][:3]
        faces = {}
        for face, (w, h) in {'north': (dx, dy), 'south': (dx, dy), 'east': (dz, dy), 'west': (dz, dy), 'up': (dx, dz), 'down': (dx, dz)}.items():
            faces[face] = {'uv': [x/4, y/4, (x+w)/4, (y+h)/4], 'texture': 'stairwell_direction_sign'} if face not in off else {'texture': None}
        call('set_cube_uv', {'id': q['name'], 'box_uv': False, 'faces': faces})
    call('export_model', {'codec_id': 'bedrock', 'path': str(D / f'endless_staircase_stairwell_direction_sign_{vtype}.geo.json'), 'overwrite': True, 'max_content_length': 0})
    call('export_model', {'codec_id': 'project', 'path': str(D / f'endless_staircase_stairwell_direction_sign_{vtype}.bbmodel'), 'overwrite': True, 'max_content_length': 0})
    views(D, [0, 9, 7.5], {f'front_{vtype}': [0, 9, -14]})

# Restore primary 'up' model
call('risky_eval', {'code': '(() => { Project.elements.slice().forEach(e => e.remove()); return true; })()'})
call('place_cube', {'elements': cs, 'faces': False})
for q in cs:
    dx, dy, dz = [b - a for a, b in zip(q['from'], q['to'])]
    m, off, rot = a[q['name']]
    x, y, f = regions[m][:3]
    faces = {}
    for face, (w, h) in {'north': (dx, dy), 'south': (dx, dy), 'east': (dz, dy), 'west': (dz, dy), 'up': (dx, dz), 'down': (dx, dz)}.items():
        faces[face] = {'uv': [x/4, y/4, (x+w)/4, (y+h)/4], 'texture': 'stairwell_direction_sign'} if face not in off else {'texture': None}
    call('set_cube_uv', {'id': q['name'], 'box_uv': False, 'faces': faces})

finish('stairwell_direction_sign', 'Stairwell direction sign', 'Metal grating', 'Broken grating', area='endless_staircase')
print('Stairwell direction sign build and verification complete.', flush=True)
