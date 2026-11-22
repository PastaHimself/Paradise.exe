import sys
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
from audit_geometry import check_z_fighting_and_collisions

cs = []
a = {}
def c(n, lo, hi, m, off=[]):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, off, False)

# 1. Base Ash Bed & Soot (Y: 0.0 to 0.4)
c('ash_bed_main', [-7.0, 0.0, -6.5], [6.0, 0.4, 4.0], 'volcanic_ash', off=['down'])
c('soot_fringe', [-5.0, 0.0, 4.0], [6.5, 0.2, 7.2], 'carbon_soot', off=['down', 'north'])

# 2. Charred Tire Fragment (calcined rubber & steel bead wire)
c('tire_chunk', [-5.5, 0.4, -4.5], [-2.5, 2.6, -2.0], 'carbon_soot', off=['down'])
c('bead_wires', [-2.5, 0.8, -4.0], [-1.5, 1.8, -2.5], 'structural_steel', off=['west'])

# 3. Solidified Melted Aluminum Slag Puddle
c('aluminum_slag', [1.0, 0.4, -5.0], [5.5, 0.9, -1.5], 'molten_aluminum', off=['down'])

# 4. Calcined Battery / Accessory Housing
c('battery_casing', [2.0, 0.9, -4.2], [5.0, 3.2, -2.0], 'charred_casing', off=['down'])
c('terminal_post', [2.5, 3.2, -3.5], [3.2, 3.8, -2.8], 'structural_steel', off=['down'])

# 5. Scorched Twisted Sheet Metal Fragment
c('sheet_base', [-3.0, 0.4, 0.0], [3.0, 2.2, 4.0], 'scorched_sheet', off=['down'])
c('curled_flap', [-2.0, 2.2, 1.5], [1.5, 4.0, 3.5], 'scorched_sheet', off=['down'])

# 6. Smoldering Glowing Ember Core (nestled in center)
c('ember_core', [-1.0, 0.4, -2.0], [1.0, 1.2, 0.0], 'glowing_ember', off=['down', 'south', 'east'])

# 7. Vitrified Melted Glass Clusters
c('glass_clump_1', [-6.5, 0.4, 2.0], [-4.5, 0.8, 3.8], 'melted_glass', off=['down'])
c('glass_clump_2', [4.5, 0.4, 1.0], [5.8, 0.8, 3.5], 'melted_glass', off=['down'])

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
print(f"Audit errors count: {len(errs)}")
for e in errs:
    print(e)
assert len(errs) == 0
print("Charred debris geometry 100% clean with ZERO errors!")
