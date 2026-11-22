from pipeline import *
from checker import checker

cs = []
a = {}

def c(n, lo, hi, m='wood', off=[], rot=False):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, off, rot)

# 1. Structural posts
# Left standing post (weathered 1.5x1.5 timber, 16 units high)
c('left_post', [-8, 0, -1], [-6.5, 16, 0.5], 'wood', rot=True)
# Right broken post stump (snapped off at height 5.5 units)
c('broken_right_stump', [6.5, 0, -1], [8, 5.5, 0.5], 'wood', rot=True)

# 2. Leaning / fallen frame rails
# Lower frame rail (supported at left post, sloping down to ground near broken post)
c('lower_frame_rail', [-6.5, 3, -0.75], [6.5, 4.25, 0.5], 'wood', off=['east', 'west'])
# Top frame rail (partly detached, leaning forward at right side)
c('top_frame_rail', [-6.5, 13.5, -0.75], [7, 15, 2], 'wood', off=['west'])

# 3. Lattice vertical slats (slender 0.75x0.5 battens)
c('vertical_slat_0', [-5, 3.5, -0.25], [-4.25, 14, 0.25], 'wood', rot=True, off=['up', 'down'])
c('vertical_slat_1', [-2, 3.5, 0.0], [-1.25, 14.25, 0.6], 'wood', rot=True, off=['up', 'down'])
# Slat 2 is broken halfway
c('broken_vertical_slat', [1, 3.5, 0.3], [1.75, 9, 1.0], 'wood', rot=True, off=['up', 'down'])
c('vertical_slat_3', [4, 4.0, 0.6], [4.75, 14.5, 1.6], 'wood', rot=True, off=['up', 'down'])

# 4. Horizontal crossing lattice slats
c('cross_slat_lower', [-6, 6, -0.2], [6, 6.75, 0.8], 'wood', off=['east', 'west'])
c('cross_slat_mid', [-6, 9.5, 0.1], [5.5, 10.25, 1.2], 'wood', off=['east', 'west'])
c('cross_slat_upper', [-6, 12, 0.3], [6, 12.75, 1.6], 'wood', off=['east', 'west'])

# 5. Detached fallen lattice piece resting on ground
c('fallen_lattice_piece', [1.5, 0, 1.5], [5.5, 0.5, 2.25], 'wood', off=['up', 'down'])

regions = {
    'wood': (0, 0, 'planks_spruce.png', 32, 32)
}

plan = {
    'reference': 'https://fencingexpert.co.nz/fix-a-leaning-fence-or-collapsed-trellis/',
    'used': 'wooden garden trellis with standing left post, snapped right post, leaning lattice frame and fallen slat fragment',
    'limitations': [
        '16-unit width, 16-unit height trellis framework with leaning horizontal rails and broken center slat',
        'fallen slat fragment on ground illustrates structural collapse without physics',
        'original spruce planks pixels unchanged; no pack integration'
    ]
}

D = build('collapsed_trellis', cs, a, regions, plan, area='flat_flower')
checker(D, [0, 8, 0], [28, 22, -32])
views(D, [0, 8, 0], {
    'front': [0, 16, -38],
    'three_quarter': [26, 20, -30],
    'back': [-26, 20, 30],
    'gameplay_scale': [42, 30, -50],
    'top': [0, 40, -1]
})
print('Collapsed trellis ready', flush=True)
