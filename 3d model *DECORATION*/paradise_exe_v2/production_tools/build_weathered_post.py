from pipeline import *
from checker import checker

cs = []
a = {}

def c(n, lo, hi, m='wood', off=[], rot=False):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, off, rot)

# 1. Main timber post (3x3 footprint, 20 units tall)
c('timber_post', [-1.5, 0, -1.5], [1.5, 20, 1.5], 'wood', rot=True)

# 2. Pyramidal weathered rain cap (slight taper)
c('rain_cap', [-1.25, 20, -1.25], [1.25, 21, 1.25], 'wood', rot=True)

# 3. Carved directional trail arrow (shallow relief in lighter carved heartwood)
c('arrow_shaft', [-0.375, 13, 1.5], [0.375, 17, 1.75], 'arrow', off=['north'])
c('arrow_head_tip', [-0.375, 17, 1.5], [0.375, 18.25, 1.75], 'arrow', off=['north'])
c('arrow_left_barb', [-1.25, 15.5, 1.5], [-0.375, 17, 1.75], 'arrow', off=['north'])
c('arrow_right_barb', [0.375, 15.5, 1.5], [1.25, 17, 1.75], 'arrow', off=['north'])

# 4. Faded arrow variant element (lower weathered trail tick)
c('faded_base_tick', [-0.5, 11, 1.5], [0.5, 11.75, 1.7], 'arrow', off=['north'])

regions = {
    'wood': (0, 0, 'planks_spruce.png', 32, 32),
    'arrow': (32, 0, 'planks_birch.png', 16, 16)
}

plan = {
    'reference': 'https://dabgraphics.co.uk/signage/timber-waymarker-posts/',
    'used': 'square timber trail waymarker post with tapered rain cap and carved directional arrow in lighter heartwood',
    'limitations': [
        '3x3 footprint, 21-unit height trail marker post with carved arrow relief and weathered trail tick',
        'faded arrow variants represented by shallow relief geometry in pale birch wood',
        'original spruce and birch pixels unchanged; no wayfinding logic or pack integration'
    ]
}

# Clear any elements if current project tab is open
call('risky_eval', {'code': '(() => { if (Project) { Project.elements.slice().forEach(e => e.remove()); Project.textures.slice().forEach(t => t.remove()); } return true; })()'})

D = build('weathered_post', cs, a, regions, plan, area='flat_flower')
checker(D, [0, 11, 0], [22, 22, 26])
views(D, [0, 11, 0], {
    'front': [0, 16, 32],
    'three_quarter': [20, 18, 24],
    'back': [-20, 18, -24],
    'gameplay_scale': [34, 28, 42],
    'top': [0, 36, 1]
})
print('Weathered post ready', flush=True)
