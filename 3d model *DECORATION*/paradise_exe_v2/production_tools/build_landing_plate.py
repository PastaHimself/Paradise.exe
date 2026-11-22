import sys
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
sys.path.insert(0, '/home/pasta/Downloads/blockbench')
from pipeline import *
from checker import checker
from audit_geometry import check_z_fighting_and_collisions
from glyphs import lettering

def make_plate_elements(variant_type='numbered'):
    cs = []
    a = {}
    def c(n, lo, hi, m, off=[]):
        cs.append({'name': n, 'from': lo, 'to': hi})
        a[n] = (m, off, False)

    # 1. Backing wall plate (10 units wide, 12 units high, mounted at Z=8 against wall)
    c('plate', [-5.0, 2.0, 7.5], [5.0, 14.0, 8.0], 'enamel', off=['south'])

    # 2. Corner standoff mounting bolts (4 corners)
    for cx in [-4.0, 4.0]:
        for cy in [3.0, 13.0]:
            c(f'bolt_{cx}_{cy}', [cx - 0.5, cy - 0.5, 7.25], [cx + 0.5, cy + 0.5, 7.5], 'metal', off=['south'])

    if variant_type == 'numbered':
        lettering(cs, a, '4', 1.25, 4.25, 7.5, material='ink', prefix='num')
    elif variant_type == 'blank':
        pass # Blank sign face with standoffs
    elif variant_type == 'repeated':
        # Repeated numbers "4 4" for disorienting endless staircase
        lettering(cs, a, '4 4', 0.85, 5.25, 7.5, material='ink', prefix='num')
    elif variant_type == 'peeling':
        # Floor numeral with peeling/curled corner sticker piece
        lettering(cs, a, '4', 1.25, 4.25, 7.5, material='ink', prefix='num')
        # Add a peeling dog-eared sticker corner lifted forward off the plate
        c('peeling_corner', [1.25, 4.25, 7.3], [2.25, 5.25, 7.45], 'ink', off=['south'])

    return cs, a

# Build primary numbered model
cs, a = make_plate_elements('numbered')
errs = check_z_fighting_and_collisions(cs, a)
if errs:
    print('AUDIT FAILED:')
    for e in errs:
        print(' -', e)
    sys.exit(1)
print(f'Audit passed: {len(cs)} cubes, 0 volume overlaps, 0 coplanar z-fighting faces.')

regions = {
    'enamel': (0, 0, 'quartz_block_side.png', 16, 16),
    'ink': (16, 0, 'concrete_black.png', 16, 16),
    'metal': (32, 0, 'iron_block.png', 16, 16)
}

plan = {
    'reference': 'https://www.safetysign.com/stairwell-signs',
    'used': 'commercial high-rise stairwell floor landing level plaque with enamel face, bold floor numeral, and standoff mounting hardware',
    'limitations': [
        '10x12 wall plaque with raised tactile floor numeral and corner standoffs',
        'variants: numbered, blank, peeling number, repeated number included in asset package',
        'original quartz_block_side, concrete_black, and iron_block pixels unchanged; no physics or pack integration'
    ]
}

# Clear any elements if project open
call('risky_eval', {'code': '(() => { if (Project) { Project.elements.slice().forEach(e => e.remove()); Project.textures.slice().forEach(t => t.remove()); } return true; })()'})

D = build('landing_plate', cs, a, regions, plan, area='endless_staircase')
checker(D, [0, 8, 7.5], [14, 12, -4])
views(D, [0, 8, 7.5], {
    'front': [0, 8, -12],
    'three_quarter': [14, 12, -4],
    'back': [-14, 12, 18],
    'gameplay_scale': [24, 18, -16],
    'number_close': [0, 8, 3]
})

# Export variants
for vtype in ['blank', 'repeated', 'peeling']:
    v_cs, v_a = make_plate_elements(vtype)
    call('risky_eval', {'code': '(() => { Project.elements.slice().forEach(e => e.remove()); return true; })()'})
    call('place_cube', {'elements': v_cs, 'faces': False})
    for q in v_cs:
        dx, dy, dz = [b - a for a, b in zip(q['from'], q['to'])]
        m, off, rot = v_a[q['name']]
        x, y, f = regions[m][:3]
        faces = {}
        for face, (w, h) in {'north': (dx, dy), 'south': (dx, dy), 'east': (dz, dy), 'west': (dz, dy), 'up': (dx, dz), 'down': (dx, dz)}.items():
            faces[face] = {'uv': [x/4, y/4, (x+w)/4, (y+h)/4], 'texture': 'landing_plate'} if face not in off else {'texture': None}
        call('set_cube_uv', {'id': q['name'], 'box_uv': False, 'faces': faces})
    call('export_model', {'codec_id': 'bedrock', 'path': str(D / f'endless_staircase_landing_plate_{vtype}.geo.json'), 'overwrite': True, 'max_content_length': 0})
    call('export_model', {'codec_id': 'project', 'path': str(D / f'endless_staircase_landing_plate_{vtype}.bbmodel'), 'overwrite': True, 'max_content_length': 0})
    views(D, [0, 8, 7.5], {f'front_{vtype}': [0, 8, -12]})

# Restore primary numbered model
call('risky_eval', {'code': '(() => { Project.elements.slice().forEach(e => e.remove()); return true; })()'})
call('place_cube', {'elements': cs, 'faces': False})
for q in cs:
    dx, dy, dz = [b - a for a, b in zip(q['from'], q['to'])]
    m, off, rot = a[q['name']]
    x, y, f = regions[m][:3]
    faces = {}
    for face, (w, h) in {'north': (dx, dy), 'south': (dx, dy), 'east': (dz, dy), 'west': (dz, dy), 'up': (dx, dz), 'down': (dx, dz)}.items():
        faces[face] = {'uv': [x/4, y/4, (x+w)/4, (y+h)/4], 'texture': 'landing_plate'} if face not in off else {'texture': None}
    call('set_cube_uv', {'id': q['name'], 'box_uv': False, 'faces': faces})

print('Landing plate and all variants build complete.', flush=True)
