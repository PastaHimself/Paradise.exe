import sys
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
from audit_geometry import check_z_fighting_and_collisions

cs = []
a = {}
def c(n, lo, hi, m, off=[]):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, off, False)

# 1. Base Plate (Heavy black recycled rubber base with beveled corners)
c('base_center', [-3.5, 0.0, -2.75], [3.5, 0.6, 2.75], 'rubber', off=['down', 'north', 'south'])
c('base_north',  [-2.75, 0.0, 2.75], [2.75, 0.6, 3.5], 'rubber', off=['down', 'south'])
c('base_south',  [-2.75, 0.0, -3.5], [2.75, 0.6, -2.75], 'rubber', off=['down', 'north'])

# Molded stacking collar boss (recessed transition from rubber base to cone)
c('base_boss',   [-2.5, 0.6, -2.5], [2.5, 1.0, 2.5], 'rubber', off=['down'])

# 2. Conical Body Tiers (Orange PVC with retroreflective white collars)
c('cone_tier1',  [-2.2, 1.0, -2.2], [2.2, 2.5, 2.2], 'orange', off=['down'])
c('cone_tier2',  [-1.85, 2.5, -1.85], [1.85, 4.5, 1.85], 'orange', off=['down'])
c('cone_collar_lo', [-1.55, 4.5, -1.55], [1.55, 6.25, 1.55], 'white_collar', off=['down'])
c('cone_mid_spacer', [-1.3, 6.25, -1.3], [1.3, 7.75, 1.3], 'orange', off=['down'])
c('cone_collar_hi', [-1.05, 7.75, -1.05], [1.05, 11.25, 1.05], 'white_collar', off=['down'])
c('cone_stem',   [-0.8, 11.25, -0.8], [0.8, 13.5, 0.8], 'orange', off=['down', 'up'])

# 3. Top Rim with Physical Hollow Hole
# Recessed floor at bottom of inner throat
c('top_hole_floor', [-0.45, 13.5, -0.45], [0.45, 13.75, 0.45], 'dark_inner', off=['down', 'north', 'south', 'east', 'west'])
# 4 perimeter lip segments enclosing the recess
c('rim_n', [-0.95, 13.5, 0.45], [0.95, 14.5, 0.95], 'orange', off=['south'])
c('rim_s', [-0.95, 13.5, -0.95], [0.95, 14.5, -0.45], 'orange', off=['north'])
c('rim_w', [-0.95, 13.5, -0.45], [-0.45, 14.5, 0.45], 'orange', off=['east', 'north', 'south'])
c('rim_e', [0.45, 13.5, -0.45], [0.95, 14.5, 0.45], 'orange', off=['west', 'north', 'south'])

errs = check_z_fighting_and_collisions(cs, a)
print(f"Total cubes: {len(cs)}")
print(f"Total audit errors: {len(errs)}")
for e in errs:
    print("  ", e)
