import sys
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
from audit_geometry import check_z_fighting_and_collisions

cs = []
a = {}
def c(n, lo, hi, m, off=[]):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, off, False)

# 1. Backing Ruined Masonry Wall (Z: 4.0 to 8.0)
# Left tall fractured wall tooth (Y: 0.0 to 8.0)
c('wall_left_tooth', [-8.0, 0.0, 4.0], [-3.0, 8.0, 8.0], 'masonry_brick', off=['down', 'east'])
# Broken wall gap center (Y: 0.0 to 3.0)
c('wall_center_break', [-3.0, 0.0, 4.0], [2.0, 3.0, 8.0], 'masonry_brick', off=['down', 'west', 'east'])
# Right wall section (Y: 0.0 to 5.0)
c('wall_right_stub', [2.0, 0.0, 4.0], [8.0, 5.0, 8.0], 'masonry_brick', off=['down', 'west'])

# 2. Spilled Rubble Scree Slope (Z: -2.0 to 4.0)
# Base gravel / crushed lime mortar bedding
c('scree_base_l', [-7.5, 0.0, -1.5], [0.0, 0.8, 4.0], 'mortar_gravel', off=['down', 'east'])
c('scree_base_r', [0.0, 0.0, -1.5], [7.5, 0.8, 4.0], 'mortar_gravel', off=['down', 'west'])

# Upper scree terrace
c('scree_upper', [-4.5, 0.8, 1.5], [5.0, 2.0, 4.0], 'mortar_gravel', off=['down'])

# 3. Dislodged Fallen Ashlar Blocks
# Block 1: tumbled forward on left
c('fallen_block_1', [-6.0, 0.8, 0.0], [-2.0, 3.0, 3.0], 'cracked_brick', off=['down'])
# Block 2: wedged forward on right
c('fallen_block_2', [1.5, 0.0, -4.0], [5.5, 2.2, -1.5], 'cracked_brick', off=['down'])
# Block 3: half-buried in center
c('fallen_block_3', [-1.5, 0.0, -3.0], [1.5, 1.6, -0.5], 'cracked_brick', off=['down'])

# 4. Scattered Stone Chips and Mortar Fragments on Floor
c('chip_1', [-6.8, 0.0, -4.5], [-5.5, 0.7, -3.2], 'cracked_brick', off=['down'])
c('chip_2', [5.5, 0.0, -2.5], [6.8, 0.8, -1.2], 'cracked_brick', off=['down'])
c('chip_3', [-1.2, 0.0, -5.2], [0.2, 0.5, -4.0], 'mortar_gravel', off=['down'])

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
print(f"Audit errors count: {len(errs)}")
for e in errs:
    print(e)
assert len(errs) == 0
print("Rubble edge geometry 100% clean with ZERO errors!")
