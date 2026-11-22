import sys
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
from audit_geometry import check_z_fighting_and_collisions

cs = []
a = {}
def c(n, lo, hi, m, off=[]):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, off, False)

# 1. Road Deck Approaches
# North asphalt approach: Z: [3.0, 8.0]
c('road_north', [-8.0, 0.0, 3.0], [8.0, 2.0, 8.0], 'asphalt', off=['down', 'north'])
# South asphalt approach: Z: [-8.0, -3.0]
c('road_south', [-8.0, 0.0, -8.0], [8.0, 2.0, -3.0], 'asphalt', off=['down', 'south'])

# 2. Steel Header Armoring Plates
# North steel header: Z: [1.8, 3.0]
c('header_north', [-8.0, 1.2, 1.8], [8.0, 2.0, 3.0], 'structural_steel', off=['down', 'south'])
# Concrete support bed under north header
c('bed_north', [-8.0, 0.0, 1.8], [8.0, 1.2, 3.0], 'concrete_bed', off=['down', 'south', 'up'])

# South steel header: Z: [-3.0, -1.8]
c('header_south', [-8.0, 1.2, -3.0], [8.0, 2.0, -1.8], 'structural_steel', off=['down', 'north'])
# Concrete support bed under south header
c('bed_south', [-8.0, 0.0, -3.0], [8.0, 1.2, -1.8], 'concrete_bed', off=['down', 'north', 'up'])

# 3. Neoprene Waterstop Drainage Trough (Deep center gap Z: [-1.8, 1.8])
c('waterstop_trough', [-8.0, 0.0, -1.8], [8.0, 0.6, 1.8], 'rubber_seal', off=['down', 'north', 'south'])

# 4. North-facing Steel Finger Teeth (cantilevered south from north header at Z=1.8 down to Z=-1.2)
c('tooth_n_1', [-7.0, 1.4, -1.2], [-5.4, 2.0, 1.8], 'cast_steel', off=['down', 'south'])
c('tooth_n_2', [-3.0, 1.4, -1.2], [-1.4, 2.0, 1.8], 'cast_steel', off=['down', 'south'])
c('tooth_n_3', [1.0, 1.4, -1.2], [2.6, 2.0, 1.8], 'cast_steel', off=['down', 'south'])
c('tooth_n_4', [5.0, 1.4, -1.2], [6.6, 2.0, 1.8], 'cast_steel', off=['down', 'south'])

# 5. South-facing Steel Finger Teeth (cantilevered north from south header at Z=-1.8 up to Z=1.2)
c('tooth_s_0', [-8.0, 1.4, -1.8], [-7.4, 2.0, 1.2], 'cast_steel', off=['down', 'north'])
c('tooth_s_1', [-5.0, 1.4, -1.8], [-3.4, 2.0, 1.2], 'cast_steel', off=['down', 'north'])
c('tooth_s_2', [-1.0, 1.4, -1.8], [0.6, 2.0, 1.2], 'cast_steel', off=['down', 'north'])
c('tooth_s_3', [3.0, 1.4, -1.8], [4.6, 2.0, 1.2], 'cast_steel', off=['down', 'north'])
c('tooth_s_4', [7.0, 1.4, -1.8], [8.0, 2.0, 1.2], 'cast_steel', off=['down', 'north'])

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
print(f"Audit errors count: {len(errs)}")
for e in errs:
    print(e)
assert len(errs) == 0
print("Expansion joint geometry 100% clean with ZERO errors!")
