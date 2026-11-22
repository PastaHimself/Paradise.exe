import sys
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
from audit_geometry import check_z_fighting_and_collisions

cs = []
a = {}
def c(n, lo, hi, m, off=[]):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, off, False)

# 1. Concrete Footing Pad
# Footing on ground: Y: [0.0, 2.0]
c('footing_pad', [-6.0, 0.0, -5.0], [6.0, 2.0, 5.0], 'concrete_base', off=['down'])

# Anchor mounting flange base
c('base_flange', [-5.4, 2.0, -4.4], [5.4, 2.5, 4.4], 'structural_steel', off=['down'])

# 2. Main Aluminum Cabinet Body (Y: 2.5 to 17.0)
c('cabinet_body', [-5.0, 2.5, -4.0], [5.0, 17.0, 4.0], 'aluminum_body', off=['down'])

# 3. Sloped Weather Canopy Roof (Y: 17.0 to 18.0)
c('canopy_roof', [-5.5, 17.0, -4.5], [5.5, 18.0, 4.5], 'aluminum_body', off=['down'])

# Roof exhaust fan shroud on top (Y: 18.0 to 19.0)
c('exhaust_shroud', [-2.5, 18.0, -2.5], [2.5, 19.0, 2.5], 'structural_steel', off=['down'])

# 4. Front Service Door
c('door_front', [-4.5, 3.0, 4.0], [4.5, 16.5, 4.4], 'aluminum_body', off=['north'])

# Front door lower intake louver hood
c('louver_front', [-3.5, 4.0, 4.4], [3.5, 6.5, 4.7], 'louver_grille', off=['north'])

# Front door latch handle
c('latch_handle', [3.2, 9.5, 4.4], [4.0, 11.5, 4.8], 'hardware', off=['north'])

# Door hinges on left side
c('hinge_upper', [-4.9, 13.5, 4.0], [-4.5, 15.5, 4.5], 'hardware', off=['north', 'east'])
c('hinge_lower', [-4.9, 4.0, 4.0], [-4.5, 6.0, 4.5], 'hardware', off=['north', 'east'])

# Police auxiliary door panel (upper front)
c('police_door', [-2.0, 12.5, 4.4], [1.0, 15.0, 4.6], 'structural_steel', off=['north'])

# 5. Side Louver Filter Hoods
c('louver_left', [-5.3, 8.0, -2.5], [-5.0, 14.0, 2.5], 'louver_grille', off=['east'])
c('louver_right', [5.0, 8.0, -2.5], [5.3, 14.0, 2.5], 'louver_grille', off=['west'])

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
print(f"Audit errors count: {len(errs)}")
for e in errs:
    print(e)
assert len(errs) == 0
print("Utility cabinet geometry 100% clean with ZERO errors!")
