from pipeline import *
from checker import checker

cs = []
a = {}

def c(n, lo, hi, m='wood', off=[], rot=False):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, off, rot)

# 1. Weathered support post
c('sign_post', [-1, 0, -1], [1, 14, 1], 'wood', rot=True)

# 2. Backboard and protective rain cap
c('notice_board', [-6, 7.5, 0.75], [6, 14.5, 1.5], 'wood')
c('protective_rain_cap', [-6.5, 14.5, 0.25], [6.5, 15.25, 2.0], 'wood')

# 3. Sun-bleached notice paper sheet
c('notice_paper', [-4.5, 8.25, 1.5], [4.5, 13.75, 1.75], 'paper', off=['south', 'up', 'down'])
c('curled_paper_corner', [2.75, 8.0, 1.6], [4.5, 9.25, 2.0], 'paper')

# 4. Fastener tack
c('tack_pin', [-0.25, 13.25, 1.75], [0.25, 13.75, 1.95], 'metal')

regions = {
    'wood': (0, 0, 'planks_spruce.png', 32, 32),
    'paper': (32, 0, 'mushroom_block_inside.png', 16, 16),
    'metal': (48, 0, 'iron_block.png', 16, 16)
}

plan = {
    'reference': 'https://alamy.com/stock-photo/weathered-wooden-trail-sign.html',
    'used': 'outdoor wooden trail signpost with protective cap and sun-bleached parchment notice sheet',
    'limitations': [
        '13-unit wide board, 15.25-unit tall signpost with curled paper corner indicating UV damage',
        'blank sun-bleached paper substitute; no custom text printing or language pack integration',
        'original spruce, mushroom_block_inside, and iron_block pixels unchanged'
    ]
}

D = build('sun_bleached_notice', cs, a, regions, plan, area='flat_flower')
checker(D, [0, 8, 0.5], [24, 20, -26])
views(D, [0, 8, 0.5], {
    'front': [0, 14, 32],
    'three_quarter': [22, 18, 24],
    'back': [-22, 18, -24],
    'gameplay_scale': [36, 28, 42],
    'top': [0, 36, 1]
})
print('Sun-bleached notice ready', flush=True)
