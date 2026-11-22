from pipeline import *
from checker import checker
from PIL import Image

cs = []
a = {}

def c(n, lo, hi, m='concrete', off=[]):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, off, False)

# 1. Main concrete step body (16 units wide, 7.5 units rise, 10 units run)
c('concrete_tread', [-8, 0, -2], [8, 7.5, 8], 'concrete')

# 2. Overhanging front nosing lip (0.5-unit safety overhang)
c('nosing_lip', [-8, 6.75, -2.5], [8, 7.5, -2.0], 'concrete', off=['south', 'down'])

# 3. Abrasive yellow non-slip safety contrast strip along leading edge
c('safety_contrast_strip', [-7.5, 7.5, -2.25], [7.5, 7.75, -1.25], 'nosing', off=['down'])

regions = {
    'concrete': (0, 0, 'concrete_gray.png', 16, 16),
    'nosing': (16, 0, 'concrete_yellow.png', 16, 16)
}

plan = {
    'reference': 'https://mass-concrete.com/commercial-precast-concrete-stairs/',
    'used': 'commercial concrete emergency stair tread with overhanging nosing lip and abrasive yellow safety contrast strip',
    'limitations': [
        '16-unit width, 7.5-unit rise, 10-unit run modular stair tread block',
        'flush joins with no internal overlapping faces; culled hidden nosing contact planes',
        'regular concrete and chipped texture variants provided; original vanilla pixels unchanged; no collision integration'
    ]
}

# Clear any elements if current project tab is open
call('risky_eval', {'code': '(() => { if (Project) { Project.elements.slice().forEach(e => e.remove()); Project.textures.slice().forEach(t => t.remove()); } return true; })()'})

D = build('stair_tread', cs, a, regions, plan, area='endless_staircase')

# Also generate the chipped texture variant
im_chipped = Image.new('RGBA', (64, 64))
im_chipped.paste(Image.open(S / 'stonebrick_cracked.png').convert('RGBA'), (0, 0))
im_chipped.paste(Image.open(S / 'concrete_yellow.png').convert('RGBA'), (16, 0))
im_chipped.save(D / 'stair_tread_chipped.png')

checker(D, [0, 4, 3], [20, 18, -24])
views(D, [0, 4, 3], {
    'front': [0, 16, -28],
    'three_quarter': [18, 16, -22],
    'back': [-18, 16, 22],
    'gameplay_scale': [30, 24, -36],
    'top': [0, 32, 1]
})

# Capture chipped variant screenshot
call('create_texture', {'name': 'stair_tread_chipped', 'data': str(D / 'stair_tread_chipped.png')})
try:
    for q in cs:
        tex = 'stair_tread_chipped'
        audit = call('get_cube_uv', {'id': q['name']})
        call('set_cube_uv', {'id': q['name'], 'faces': {f: {'texture': tex} for f, v in audit['faces'].items() if v['texture'] is not None}})
    views(D, [0, 4, 3], {'chipped_variant_three_quarter': [18, 16, -22]})
finally:
    for q in cs:
        audit = call('get_cube_uv', {'id': q['name']})
        call('set_cube_uv', {'id': q['name'], 'faces': {f: {'texture': 'stair_tread'} for f, v in audit['faces'].items() if v['texture'] is not None}})
    call('delete_texture', {'texture': 'stair_tread_chipped'})

print('Stair tread ready', flush=True)
