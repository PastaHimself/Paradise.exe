import sys
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
from audit_geometry import check_z_fighting_and_collisions

cs = []
a = {}
def c(n, lo, hi, m, off=[]):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, off, False)

# 1. Main Front Fascia
c('center_nose', [-5.0, 0.0, 1.2], [5.0, 3.8, 2.2], 'plastic', off=['down'])
c('left_cheek',  [-9.5, 0.0, -1.2], [-5.0, 3.8, 1.2], 'plastic', off=['down', 'east'])
c('right_cheek', [5.0, 0.0, -1.2], [9.5, 3.8, 1.2], 'plastic', off=['down', 'west'])

# 2. Lower Chin Splitter
c('chin_lip', [-7.0, 0.0, 2.2], [7.0, 0.8, 3.0], 'scuffed_plastic', off=['down', 'north'])

# 3. Lower Air Dam Grille
c('lower_grille', [-4.0, 0.8, 2.2], [4.0, 2.0, 2.5], 'dark_grille', off=['down', 'north'])

# 4. Fog Light Pockets
c('fog_pocket_l', [-7.5, 1.0, 1.2], [-5.5, 2.4, 1.6], 'scuffed_plastic', off=['north'])
c('fog_pocket_r', [5.5, 1.0, 1.2], [7.5, 2.4, 1.6], 'scuffed_plastic', off=['north'])

# 5. Mounting Tabs & Metal Clips
c('mount_tab_l', [-6.5, 3.8, 0.0], [-5.5, 4.5, 0.8], 'plastic', off=['down', 'up'])
c('mount_tab_r', [5.5, 3.8, 0.0], [6.5, 4.5, 0.8], 'plastic', off=['down', 'up'])

c('clip_l', [-6.2, 4.5, 0.2], [-5.8, 5.0, 0.6], 'metal_clip', off=['down'])
c('clip_r', [5.8, 4.5, 0.2], [6.2, 5.0, 0.6], 'metal_clip', off=['down'])

# 6. Crack / Fracture Scar
c('crack_scar', [-5.4, 0.8, 2.2], [-4.8, 3.8, 2.4], 'scuffed_plastic', off=['down', 'north'])

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
print(f"Audit errors count: {len(errs)}")
for e in errs:
    print(e)
assert len(errs) == 0
print("Broken bumper geometry 100% clean with ZERO errors!")
