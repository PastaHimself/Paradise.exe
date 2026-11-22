from pipeline import *
from checker import checker

cs = []
a = {}

def c(n, lo, hi, m='stone', off=[], vertical=False):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, off, vertical)

# 1. Octagonal stone rim curb (height 2.75 units, thickness 1.5 units)
c('rim_north', [-4.5, 0, 7.5], [4.5, 2.75, 9], 'stone')
c('rim_south', [-4.5, 0, -9], [4.5, 2.75, -7.5], 'stone')
c('rim_east', [7.5, 0, -4.5], [9, 2.75, 4.5], 'stone')
c('rim_west', [-9, 0, -4.5], [-7.5, 2.75, 4.5], 'stone')

# 2. Chamfered stone corner blocks
c('corner_ne', [4.5, 0, 4.5], [8, 2.75, 8], 'stone')
c('corner_nw', [-8, 0, 4.5], [-4.5, 2.75, 8], 'stone')
c('corner_sw', [-8, 0, -8], [-4.5, 2.75, -4.5], 'stone')

# 3. Weathered / displaced SE corner: tree root heave displaced stone and cracked fragment
c('corner_se_displaced', [5, 0, -8.5], [8.5, 2.5, -5], 'stone')
c('broken_stone_fragment', [8.5, 0, -9.5], [10, 1.25, -7.5], 'stone')
c('exposed_root', [3, 0, -5], [6.5, 1.75, -3.5], 'root')

# 4. Raised interior soil bed with 6x6 central hollow socket for lone tree trunk
c('soil_north', [-6, 0, 3], [6, 1.5, 6.5], 'soil')
c('soil_south', [-6, 0, -6.5], [6, 1.5, -3], 'soil')
c('soil_east', [3, 0, -3], [6.5, 1.5, 3], 'soil')
c('soil_west', [-6.5, 0, -3], [-3, 1.5, 3], 'soil')

regions = {
    'stone': (0, 0, 'stonebrick.png', 32, 32),
    'soil': (32, 0, 'dirt_with_roots.png', 16, 16),
    'root': (48, 0, 'log_oak.png', 16, 16)
}

plan = {
    'reference': 'https://www.davey.com/indianapolis-tree-service/blog/how-to-build-a-tree-ring-with-stones-and-mulch/',
    'used': 'octagonal raised stone border curb surrounding tree base with soil bed and root heave detail',
    'limitations': [
        '18x18 footprint with 6x6 central hollow trunk socket',
        'displaced SE curb stone and exposed root heave illustrate abandoned garden state',
        'original stonebrick, dirt_with_roots, and log_oak pixels unchanged; no pack integration'
    ]
}

D = build('lone_tree_surround', cs, a, regions, plan, area='flat_flower')
checker(D, [0, 1.5, 0], [28, 24, -30])
views(D, [0, 1.5, 0], {
    'front': [0, 18, -36],
    'three_quarter': [26, 22, -28],
    'back': [-26, 22, 28],
    'gameplay_scale': [42, 34, -48],
    'top': [0, 42, -1]
})
print('Lone-tree surround ready', flush=True)
