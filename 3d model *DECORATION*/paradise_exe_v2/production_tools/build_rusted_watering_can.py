from pipeline import *
from checker import checker

cs = []
a = {}

def c(n, lo, hi, m='rust', off=[]):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, off, False)

# 1. Main body and rims
c('bottom_seam_rim', [-3.25, 0, -3.25], [3.25, 0.75, 3.25], 'rust')
c('can_body_main', [-3, 0.5, -3], [3, 5.5, 3], 'rust')
c('collar_rim', [-2.5, 5.5, -2.5], [2.5, 6.25, 2.5], 'rust')

# 2. Spout assembly
c('spout_base', [-0.75, 1.25, 3], [0.75, 2.75, 5.5], 'rust', off=['north'])
c('spout_neck', [-0.5, 2.75, 5.25], [0.5, 5.75, 7.5], 'rust')
c('spout_rose', [-1.25, 5.25, 7.25], [1.25, 6.75, 9.25], 'metal')

# 3. Top arched carrying handle
c('top_handle_front', [-0.5, 5.5, 1.25], [0.5, 9.0, 2.0], 'metal')
c('top_handle_rear', [-0.5, 5.5, -2.0], [0.5, 9.0, -1.25], 'metal')
c('top_handle_bar', [-0.5, 8.25, -2.0], [0.5, 9.25, 2.0], 'metal')

# 4. Rear tipping / pouring handle
c('rear_handle_top_strut', [-0.5, 4.25, -4.5], [0.5, 5.0, -3.0], 'metal', off=['south'])
c('rear_handle_bottom_strut', [-0.5, 1.0, -4.5], [0.5, 1.75, -3.0], 'metal', off=['south'])
c('rear_handle_grip', [-0.5, 1.0, -5.25], [0.5, 5.0, -4.5], 'metal')

regions = {
    'rust': (0, 0, 'raw_iron_block.png', 16, 16),
    'metal': (16, 0, 'iron_block.png', 16, 16)
}

plan = {
    'reference': 'https://inekohome.co.uk/product/vintage-galvanised-watering-can/',
    'used': 'galvanized sheet iron watering can with rose sprinkler head, arched top carrying handle and rear tipping handle',
    'limitations': [
        '12-unit overall length, 9.25-unit height garden watering can with flared base seam',
        'perforated rose head and dual handles simplify rounded wire/tubing into clean cuboids',
        'original raw_iron_block and iron_block pixels unchanged; no fluid physics or pack integration'
    ]
}

D = build('rusted_watering_can', cs, a, regions, plan, area='flat_flower')
checker(D, [0, 4.5, 1.5], [20, 16, -22])
views(D, [0, 4.5, 1.5], {
    'front': [0, 12, -28],
    'three_quarter': [18, 14, -20],
    'back': [-18, 14, 20],
    'gameplay_scale': [30, 22, -34],
    'top': [0, 28, -1]
})
print('Rusted watering can ready', flush=True)
