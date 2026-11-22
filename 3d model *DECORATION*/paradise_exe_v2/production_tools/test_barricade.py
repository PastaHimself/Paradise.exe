import sys
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
from audit_geometry import check_z_fighting_and_collisions

cs = []
a = {}
def c(n, lo, hi, m, off=[]):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, off, False)

# -------------------------------------------------------------------------
# Test Striped Rail generator
# -------------------------------------------------------------------------
def make_striped_rail(prefix, y_lo, y_hi, z_lo, z_hi):
    # Board height = y_hi - y_lo
    y_mid = (y_lo + y_hi) / 2.0
    # Tier 1 (bottom): Y in [y_lo, y_mid]
    # Stripes pattern with width 2.5, shifting by 1.25 on tier 2
    # Tier 1 segments:
    t1_x = [-8.0, -5.5, -3.0, -0.5, 2.0, 4.5, 7.0, 8.0]
    for i in range(len(t1_x)-1):
        x1, x2 = t1_x[i], t1_x[i+1]
        mat = 'orange' if (i % 2 == 0) else 'white'
        off = ['up'] # cull mating face with tier 2
        if i > 0: off.append('west')
        if i < len(t1_x)-2: off.append('east')
        c(f'{prefix}_t1_{i}', [x1, y_lo, z_lo], [x2, y_mid, z_hi], mat, off=off)

    # Tier 2 (top): Y in [y_mid, y_hi], shifted by +1.25
    t2_x = [-8.0, -6.75, -4.25, -1.75, 0.75, 3.25, 5.75, 8.0]
    for i in range(len(t2_x)-1):
        x1, x2 = t2_x[i], t2_x[i+1]
        mat = 'white' if (i % 2 == 0) else 'orange'
        off = ['down'] # cull mating face with tier 1
        if i > 0: off.append('west')
        if i < len(t2_x)-2: off.append('east')
        c(f'{prefix}_t2_{i}', [x1, y_mid, z_lo], [x2, y_hi, z_hi], mat, off=off)

make_striped_rail('rail1', 4.0, 8.0, 0.3, 0.8)

errs = check_z_fighting_and_collisions(cs, a)
print(f"Total cubes for 1 rail: {len(cs)}")
print(f"Total audit errors: {len(errs)}")
for e in errs:
    print("  ", e)
