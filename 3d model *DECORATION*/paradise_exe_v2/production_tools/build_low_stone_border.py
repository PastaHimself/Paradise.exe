from pipeline import *
from checker import checker

cs = []
a = {}

def c(n, lo, hi, m='stone', off=[]):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, off, False)

# 4 modular granite sett / stone border blocks with slight height & depth variations
c('stone_sett_0', [-8, 0, -2], [-4, 3.25, 2], 'stone')
c('stone_sett_1', [-4, 0, -2.25], [0, 3.5, 1.75], 'stone')
c('stone_sett_2', [0, 0, -1.75], [4, 3.0, 2.25], 'stone')
c('stone_sett_3', [4, 0, -2], [8, 3.25, 2], 'stone')

# Backing bed of retained garden soil
c('retained_soil', [-8, 0, 2], [8, 1.25, 4], 'soil')

# Small weathered / cracked stone fragment fallen on front side
c('weathered_chip', [1, 0, -3.5], [3, 0.75, -2], 'stone')

regions = {
    'stone': (0, 0, 'stonebrick.png', 16, 16),
    'soil': (16, 0, 'dirt.png', 16, 16)
}

plan = {
    'reference': 'https://cobblehub.co.uk/granite-setts-cobblestones-edging/',
    'used': 'linear modular garden border of raised stone setts retaining low soil bed with weathered chip detail',
    'limitations': [
        '16-unit linear modular edging piece with staggered stone heights and slight alignment offsets',
        'retained soil strip along rear face and chipped stone fragment in front',
        'original stonebrick and dirt pixels unchanged; no pack integration'
    ]
}

D = build('low_stone_border', cs, a, regions, plan, area='flat_flower')
checker(D, [0, 1.75, 0], [24, 20, -26])
views(D, [0, 1.75, 0], {
    'front': [0, 16, -32],
    'three_quarter': [22, 18, -24],
    'back': [-22, 18, 24],
    'gameplay_scale': [36, 28, -42],
    'top': [0, 36, -1]
})
print('Low stone border ready', flush=True)
