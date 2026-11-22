from pipeline import *
from checker import checker

cs = []
a = {}

def c(n, lo, hi, m='stone', off=[]):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, off, False)

# 1. Base pathway bedding (coarse sand/mortar base)
c('subbase_mortar_bed', [-8, 0, -8], [8, 0.5, 8], 'soil')

# 2. Stable adjacent flush paving slab
c('intact_adjacent_slab', [-8, 0.5, -8], [-1, 1.75, 8], 'stone', off=['down'])

# 3. Crumbled mortar bedding cavity beneath shifted stone
c('crumbled_mortar_recess', [0, 0.5, -7], [6.5, 0.85, 6.5], 'soil', off=['down'])

# 4. Tilted loose paving stone (clean non-overlapping step at x = 3.5)
c('loose_slab_lower', [0, 0.85, -6.5], [3.5, 1.85, 6.5], 'stone', off=['down'])
c('loose_slab_raised_lip', [3.5, 1.85, -6.5], [7.5, 3.1, 6.5], 'stone')

# 5. Broken stone corner fragment resting in path joint
c('broken_corner_chip', [6.5, 0.5, 6.5], [8.0, 1.25, 8.0], 'stone', off=['down'])

regions = {
    'stone': (0, 0, 'stone_slab_top.png', 16, 16),
    'soil': (16, 0, 'coarse_dirt.png', 16, 16)
}

plan = {
    'reference': 'https://pavingandslabs.co.uk/blogs/guides/how-to-fix-a-loose-paving-slab',
    'used': 'garden path flagstone displaced and tilted upward from crumbled mortar bedding with broken corner chip',
    'limitations': [
        '16x16 footprint pathway tile with 3.1-unit raised tilted slab edge creating trip hazard',
        'subbase mortar bed exposed beneath shifted stone; flush joins and zero z-fighting on coplanar interfaces',
        'original stone_slab_top and coarse_dirt pixels unchanged; no physics or pack integration'
    ]
}

# Clear any elements if current project tab is open
call('risky_eval', {'code': '(() => { if (Project) { Project.elements.slice().forEach(e => e.remove()); Project.textures.slice().forEach(t => t.remove()); } return true; })()'})

D = build('loose_paving_stone', cs, a, regions, plan, area='flat_flower')
checker(D, [0, 1.5, 0], [22, 18, -24])
views(D, [0, 1.5, 0], {
    'front': [0, 16, -30],
    'three_quarter': [20, 18, -22],
    'back': [-20, 18, 22],
    'gameplay_scale': [34, 26, -38],
    'top': [0, 36, -1]
})
print('Loose paving stone ready', flush=True)
