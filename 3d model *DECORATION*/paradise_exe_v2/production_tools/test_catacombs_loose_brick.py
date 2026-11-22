import sys
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
from audit_geometry import check_z_fighting_and_collisions

cs = []
a = {}
def c(n, lo, hi, m, off=[]):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, off, False)

# 1. Main Ashlar Stone Brick (Y: 0.0 to 4.0)
c('brick_main', [-4.0, 0.0, -2.5], [4.0, 4.0, 2.5], 'ashlar_stone', off=['down'])

# 2. Chipped Ends & Fracture Steps
c('fracture_end_l', [-4.6, 0.0, -2.0], [-4.0, 2.6, 2.0], 'fracture_stone', off=['down', 'east'])
c('fracture_end_r', [4.0, 0.0, -1.8], [4.4, 2.2, 1.8], 'fracture_stone', off=['down', 'west'])

# 3. Adhering Lime Mortar Crusts
c('mortar_ridge_top', [-2.0, 4.0, -1.2], [2.0, 4.4, 1.2], 'lime_mortar', off=['down'])
c('mortar_crust_side', [-3.2, 0.8, -2.7], [3.2, 2.4, -2.5], 'lime_mortar', off=['south'])

# 4. Fallen Stone Chips & Rubble Crumbs on Floor
c('rubble_chip_1', [-5.8, 0.0, 0.8], [-4.8, 1.2, 2.0], 'fracture_stone', off=['down'])
c('rubble_chip_2', [4.8, 0.0, -3.2], [5.8, 0.9, -2.0], 'fracture_stone', off=['down'])
c('rubble_chip_3', [-1.8, 0.0, 3.0], [-0.8, 0.7, 4.2], 'fracture_stone', off=['down'])
c('mortar_crumb', [2.0, 0.0, 2.8], [3.0, 0.5, 3.8], 'lime_mortar', off=['down'])

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
print(f"Audit errors count: {len(errs)}")
for e in errs:
    print(e)
assert len(errs) == 0
print("Loose brick geometry 100% clean with ZERO errors!")
