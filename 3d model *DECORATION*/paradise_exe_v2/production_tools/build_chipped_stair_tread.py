from pipeline import *
from checker import checker

cs = []
a = {}

def c(n, lo, hi, m='concrete', off=[]):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, off, False)

# 1. Main concrete step body with culled internal seams
c('left_body', [-8, 0, -2], [1, 7.5, 8], 'concrete', off=['east'])
c('right_body', [5, 0, -2], [8, 7.5, 8], 'concrete', off=['west'])
c('center_rear', [1, 0, -0.5], [5, 7.5, 8], 'concrete', off=['west', 'east', 'north'])

# 2. Chipped crater and fractured inner ledge in center of leading edge
c('center_chipped_bed', [1, 0, -2], [5, 6.25, -0.5], 'chipped_core', off=['west', 'east', 'south'])
c('center_inner_ledge', [2, 6.25, -1.75], [4, 6.85, -0.5], 'chipped_core', off=['down', 'south'])

# 3. Interrupted nosing lip and safety strip (absent in chipped middle)
c('left_nosing', [-8, 6.75, -2.5], [1, 7.5, -2.0], 'concrete', off=['south', 'down'])
c('left_safety', [-7.5, 7.5, -2.25], [0.75, 7.75, -1.25], 'nosing', off=['down'])
c('right_nosing', [5, 6.75, -2.5], [8, 7.5, -2.0], 'concrete', off=['south', 'down'])
c('right_safety', [5.25, 7.5, -2.25], [7.5, 7.75, -1.25], 'nosing', off=['down'])

# 4. Broken concrete chunk fallen on ground in front of the spalled cavity
c('fallen_chip', [2.5, 0, -3.25], [4.25, 0.85, -2.25], 'chipped_core', off=['down'])

regions = {
    'concrete': (0, 0, 'concrete_gray.png', 16, 16),
    'nosing': (16, 0, 'concrete_yellow.png', 16, 16),
    'chipped_core': (32, 0, 'stonebrick_cracked.png', 16, 16)
}

plan = {
    'reference': 'https://mass-concrete.com/commercial-precast-concrete-stairs/',
    'used': 'commercial concrete emergency stair tread with fractured leading edge, broken nosing and fallen spall chunk',
    'limitations': [
        '16-unit width, 7.5-unit rise, 10-unit run modular stair tread with a 4-unit physical spalled cavity',
        'culled internal contact planes with zero coplanar z-fighting and zero volume overlaps',
        'original concrete_gray, concrete_yellow, and stonebrick_cracked pixels unchanged; no physics or pack integration'
    ]
}

# Clear any elements if current project tab is open
call('risky_eval', {'code': '(() => { if (Project) { Project.elements.slice().forEach(e => e.remove()); Project.textures.slice().forEach(t => t.remove()); } return true; })()'})

D = build('chipped_stair_tread_geometry', cs, a, regions, plan, area='endless_staircase')
checker(D, [0, 4, 3], [20, 18, -24])
views(D, [0, 4, 3], {
    'front': [0, 16, -28],
    'three_quarter': [18, 16, -22],
    'back': [-18, 16, 22],
    'gameplay_scale': [30, 24, -36],
    'top': [0, 32, 1]
})
print('Chipped stair tread geometry ready', flush=True)
