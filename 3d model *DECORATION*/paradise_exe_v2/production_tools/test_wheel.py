import sys, os
from pathlib import Path
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
from audit_geometry import check_z_fighting_and_collisions

cs = []
a = {}
def c(n, lo, hi, m, off=[]):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, off, False)

# -------------------------------------------------------------------------
# BURNING HIGHWAY: DETACHED WHEEL
# Diameter: 15.0 (X: [-7.5, 7.5], Y: [0.0, 15.0]), Width: 5.0 (Z: [0.0, 5.0])
# -------------------------------------------------------------------------

# 1. Outer Rubber Tire (Octagonal Tread Profile)
c('tire_top', [-4.0, 14.0, 0.0], [4.0, 15.0, 5.0], 'rubber', off=['down'])
c('tire_bot', [-4.0, 0.0, 0.0],  [4.0, 1.0, 5.0],  'rubber', off=['up', 'down'])
c('tire_l',   [-7.5, 4.0, 0.0],  [-6.5, 11.0, 5.0], 'rubber', off=['east'])
c('tire_r',   [6.5, 4.0, 0.0],   [7.5, 11.0, 5.0],  'rubber', off=['west'])

c('tire_tl',  [-6.5, 11.0, 0.0], [-4.0, 14.0, 5.0], 'rubber', off=['east', 'down'])
c('tire_tr',  [4.0, 11.0, 0.0],  [6.5, 14.0, 5.0],  'rubber', off=['west', 'down'])
c('tire_bl',  [-6.5, 1.0, 0.0],  [-4.0, 4.0, 5.0],  'rubber', off=['east', 'up'])
c('tire_br',  [4.0, 1.0, 0.0],   [6.5, 4.0, 5.0],   'rubber', off=['west', 'up'])

# 2. Tire Sidewall Fillers
c('sidewall_top', [-4.0, 12.0, 0.0], [4.0, 14.0, 5.0], 'rubber', off=['down', 'up'])
c('sidewall_bot', [-4.0, 1.0, 0.0],  [4.0, 3.0, 5.0],  'rubber', off=['up', 'down'])
c('sidewall_l',   [-6.5, 4.0, 0.0],  [-4.5, 11.0, 5.0], 'rubber', off=['east', 'west'])
c('sidewall_r',   [4.5, 4.0, 0.0],   [6.5, 11.0, 5.0],  'rubber', off=['west', 'east'])

# 3. Rim Outer Bead Flange (Alloy / Steel Rim Barrel)
c('rim_top', [-2.5, 11.5, 0.4], [2.5, 12.0, 4.6], 'alloy', off=['down'])
c('rim_bot', [-2.5, 3.0, 0.4],  [2.5, 3.5, 4.6],  'alloy', off=['up'])
c('rim_l',   [-4.5, 5.0, 0.4],  [-4.0, 10.0, 4.6], 'alloy', off=['east'])
c('rim_r',   [4.0, 5.0, 0.4],   [4.5, 10.0, 4.6],  'alloy', off=['west'])

c('rim_tl',  [-4.0, 10.0, 0.4], [-2.5, 11.5, 4.6], 'alloy', off=['east', 'down'])
c('rim_tr',  [2.5, 10.0, 0.4],  [4.0, 11.5, 4.6],  'alloy', off=['west', 'down'])
c('rim_bl',  [-4.0, 3.5, 0.4],  [-2.5, 5.0, 4.6],  'alloy', off=['east', 'up'])
c('rim_br',  [2.5, 3.5, 0.4],   [4.0, 5.0, 4.6],   'alloy', off=['west', 'up'])

# 4. Rim Drop Dish & Spoke Face (Z: 1.0 to 4.0)
c('rim_dish', [-2.5, 5.0, 1.0], [2.5, 10.0, 4.0], 'alloy', off=['north'])

# 5. Center Hub Cap & Lug Nuts (resting flush on front of rim_dish at Z=1.0)
c('hub_center', [-1.2, 6.3, 0.5], [1.2, 8.7, 1.0], 'alloy_dark', off=['south'])

c('lug_top', [-0.35, 9.0, 0.5], [0.35, 9.7, 1.0], 'steel', off=['south'])
c('lug_tr',  [1.3, 7.8, 0.5],   [2.0, 8.5, 1.0],  'steel', off=['south'])
c('lug_br',  [0.9, 5.5, 0.5],   [1.6, 6.2, 1.0],  'steel', off=['south'])
c('lug_bl',  [-1.6, 5.5, 0.5],  [-0.9, 6.2, 1.0], 'steel', off=['south'])
c('lug_tl',  [-2.0, 7.8, 0.5],  [-1.3, 8.5, 1.0], 'steel', off=['south'])

# 6. Valve Stem
c('valve_stem', [2.0, 10.5, 0.3], [2.4, 11.2, 1.0], 'dark_metal')

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
print(f"Audit errors count: {len(errs)}")
for e in errs:
    print(e)
assert len(errs) == 0
print("Wheel geometry 100% clean with ZERO errors!")
