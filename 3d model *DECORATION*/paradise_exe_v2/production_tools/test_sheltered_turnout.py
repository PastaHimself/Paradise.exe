import sys
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
from audit_geometry import check_z_fighting_and_collisions

cs = []
a = {}
def c(n, lo, hi, m, off=[]):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, off, False)

# 1. Base Roadway / Emergency Bay Pavement (Y: 0.0 to 1.0)
c('floor_l', [-12.0, 0.0, -8.0], [0.0, 1.0, 8.0], 'asphalt', off=['down', 'east'])
c('floor_r', [0.0, 0.0, -8.0], [12.0, 1.0, 8.0], 'asphalt', off=['down', 'west'])

# High-vis emergency bay border line
c('bay_line_l', [-10.0, 1.0, -7.5], [0.0, 1.15, -6.5], 'marking_yellow', off=['down', 'east'])
c('bay_line_r', [0.0, 1.0, -7.5], [10.0, 1.15, -6.5], 'marking_yellow', off=['down', 'west'])

# 2. Rear Concrete Retaining Wall (Y: 1.0 to 18.0, Z: [6.0, 8.0])
c('wall_rear_l', [-12.0, 1.0, 6.0], [0.0, 18.0, 8.0], 'concrete_wall', off=['down', 'east'])
c('wall_rear_r', [0.0, 1.0, 6.0], [12.0, 18.0, 8.0], 'concrete_wall', off=['down', 'west'])

# 3. Cantilever Overhead Canopy Roof (Y: 18.0 to 20.0, Z: [-2.0, 8.0])
c('canopy_roof_l', [-12.0, 18.0, -2.0], [0.0, 20.0, 8.0], 'concrete_wall', off=['down', 'east'])
c('canopy_roof_r', [0.0, 18.0, -2.0], [12.0, 20.0, 8.0], 'concrete_wall', off=['down', 'west'])

# Cantilever support corbel brackets
c('bracket_l', [-9.5, 14.0, 0.0], [-8.5, 18.0, 6.0], 'structural_steel', off=['north', 'up', 'south'])
c('bracket_r', [8.5, 14.0, 0.0], [9.5, 18.0, 6.0], 'structural_steel', off=['north', 'up', 'south'])

# 4. Crash-Protection Concrete Jersey Barriers (Left and Right returns)
c('barrier_l', [-12.0, 1.0, -6.0], [-10.0, 5.0, 6.0], 'concrete_barrier', off=['down', 'north', 'south'])
c('barrier_r', [10.0, 1.0, -6.0], [12.0, 5.0, 6.0], 'concrete_barrier', off=['down', 'north', 'south'])

# 5. Pedestrian Refuge Bench against rear wall
c('bench_seat', [-4.0, 1.0, 3.5], [4.0, 3.5, 6.0], 'concrete_barrier', off=['down', 'north', 'south'])

# 6. Emergency Call Box on Wall
c('call_box', [-6.5, 5.5, 5.2], [-4.5, 9.5, 6.0], 'phone_orange', off=['north', 'south'])

# 7. Blue ERA Placard Sign on Wall
c('era_sign', [4.5, 7.0, 5.6], [7.5, 10.0, 6.0], 'era_blue', off=['north', 'south'])

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
print(f"Audit errors count: {len(errs)}")
for e in errs:
    print(e)
assert len(errs) == 0
print("Sheltered turnout geometry 100% clean with ZERO errors!")
