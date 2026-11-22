import sys
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
from audit_geometry import check_z_fighting_and_collisions

cs = []
a = {}
def c(n, lo, hi, m, off=[]):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, off, False)

# 1. Concrete Gutter Apron / Frame
# North apron (behind grate, below curb): Y: [0.0, 2.0], Z: [5.2, 8.0]
c('apron_north', [-8.0, 0.0, 5.2], [8.0, 2.0, 8.0], 'concrete_gutter', off=['down'])
# South apron (road side): Y: [0.0, 2.0], Z: [-8.0, -5.2]
c('apron_south', [-8.0, 0.0, -8.0], [8.0, 2.0, -5.2], 'concrete_gutter', off=['down'])
# West apron: X: [-8.0, -5.2], Y: [0.0, 2.0], Z: [-5.2, 5.2]
c('apron_west', [-8.0, 0.0, -5.2], [-5.2, 2.0, 5.2], 'concrete_gutter', off=['down', 'north', 'south'])
# East apron: X: [5.2, 8.0], Y: [0.0, 2.0], Z: [-5.2, 5.2]
c('apron_east', [5.2, 0.0, -5.2], [8.0, 2.0, 5.2], 'concrete_gutter', off=['down', 'north', 'south'])

# 2. Curb Rise Wall (North side curb edge)
c('curb_wall', [-8.0, 2.0, 6.2], [8.0, 5.0, 8.0], 'concrete_gutter', off=['down'])

# 3. Catch Basin Pit Bottom (Deep dark interior)
c('basin_pit_bottom', [-5.2, 0.0, -5.2], [5.2, 0.4, 5.2], 'dark_sump', off=['down', 'north', 'south', 'east', 'west'])

# 4. Cast Iron Grate Rim Frame (rests inside apron lip at Y: [1.4, 2.0])
c('grate_rim_n', [-5.2, 1.4, 4.4], [5.2, 2.0, 5.2], 'cast_iron', off=['down', 'south', 'west', 'east'])
c('grate_rim_s', [-5.2, 1.4, -5.2], [5.2, 2.0, -4.4], 'cast_iron', off=['down', 'north', 'west', 'east'])
c('grate_rim_w', [-5.2, 1.4, -4.4], [-4.4, 2.0, 4.4], 'cast_iron', off=['down', 'north', 'south', 'west'])
c('grate_rim_e', [4.4, 1.4, -4.4], [5.2, 2.0, 4.4], 'cast_iron', off=['down', 'north', 'south', 'east'])

# 5. Longitudinal Grate Bars (spanning Z: [-4.4, 4.4], Y: [1.4, 2.0])
c('grate_bar_1', [-3.6, 1.4, -4.4], [-2.8, 2.0, 4.4], 'cast_iron', off=['down', 'north', 'south'])
c('grate_bar_2', [-1.8, 1.4, -4.4], [-1.0, 2.0, 4.4], 'cast_iron', off=['down', 'north', 'south'])
c('grate_bar_3', [-0.4, 1.4, -4.4], [0.4, 2.0, 4.4], 'cast_iron', off=['down', 'north', 'south'])
c('grate_bar_4', [1.0, 1.4, -4.4], [1.8, 2.0, 4.4], 'cast_iron', off=['down', 'north', 'south'])
c('grate_bar_5', [2.8, 1.4, -4.4], [3.6, 2.0, 4.4], 'cast_iron', off=['down', 'north', 'south'])

# 6. Transverse Tie Bars (underneath longitudinal bars to reinforce, Y: [1.1, 1.4])
c('cross_tie_1', [-4.4, 1.1, -2.2], [4.4, 1.4, -1.6], 'cast_iron', off=['down'])
c('cross_tie_2', [-4.4, 1.1, 1.6], [4.4, 1.4, 2.2], 'cast_iron', off=['down'])

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
print(f"Audit errors count: {len(errs)}")
for e in errs:
    print(e)
assert len(errs) == 0
print("Drain grate geometry 100% clean with ZERO errors!")
