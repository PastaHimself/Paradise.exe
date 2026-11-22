import sys
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
from audit_geometry import check_z_fighting_and_collisions

cs = []
a = {}
def c(n, lo, hi, m, off=[]):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, off, False)

# -------------------------------------------------------------------------
# BURNING HIGHWAY: STRIPED ROADWORK BARRICADE (MUTCD Type III)
# -------------------------------------------------------------------------

# 1. Base Skid Feet (on pavement Y=0.0 to 0.6, Z: -4.0 to 4.0)
c('skid_l', [-6.0, 0.0, -4.0], [-5.0, 0.6, 4.0], 'galvanized', off=['down'])
c('skid_r', [5.0, 0.0, -4.0], [6.0, 0.6, 4.0], 'galvanized', off=['down'])

# Skid riser sockets (Y: 0.6 to 2.5)
c('socket_l', [-6.2, 0.6, -0.6], [-4.8, 2.5, 0.6], 'galvanized', off=['down'])
c('socket_r', [4.8, 0.6, -0.6], [6.2, 2.5, 0.6], 'galvanized', off=['down'])

# 2. Vertical Upright Posts (Square steel tube, Y: 2.5 to 23.5)
c('post_l', [-5.8, 2.5, -0.3], [-5.2, 23.5, 0.3], 'galvanized', off=['down'])
c('post_r', [5.2, 2.5, -0.3], [5.8, 23.5, 0.3], 'galvanized', off=['down'])

# 3. Rails & Mounting Brackets
def make_rail(prefix, y_lo, y_hi):
    y_mid = (y_lo + y_hi) / 2.0
    # Mounting spacer brackets between post and rail (Z: 0.3 to 0.4)
    c(f'{prefix}_brk_l', [-5.9, y_mid - 0.6, 0.3], [-5.1, y_mid + 0.6, 0.4], 'dark_metal', off=['north', 'south'])
    c(f'{prefix}_brk_r', [5.1, y_mid - 0.6, 0.3], [5.9, y_mid + 0.6, 0.4], 'dark_metal', off=['north', 'south'])

    # Striped board segments at Z: 0.4 to 0.9
    z_lo, z_hi = 0.4, 0.9
    # Tier 1 (bottom half)
    t1_x = [-8.0, -5.5, -3.0, -0.5, 2.0, 4.5, 7.0, 8.0]
    for i in range(len(t1_x)-1):
        x1, x2 = t1_x[i], t1_x[i+1]
        mat = 'orange' if (i % 2 == 0) else 'white'
        off = ['up']
        if i > 0: off.append('west')
        if i < len(t1_x)-2: off.append('east')
        c(f'{prefix}_t1_{i}', [x1, y_lo, z_lo], [x2, y_mid, z_hi], mat, off=off)

    # Tier 2 (top half, shifted by 1.25)
    t2_x = [-8.0, -6.75, -4.25, -1.75, 0.75, 3.25, 5.75, 8.0]
    for i in range(len(t2_x)-1):
        x1, x2 = t2_x[i], t2_x[i+1]
        mat = 'white' if (i % 2 == 0) else 'orange'
        off = ['down']
        if i > 0: off.append('west')
        if i < len(t2_x)-2: off.append('east')
        c(f'{prefix}_t2_{i}', [x1, y_mid, z_lo], [x2, y_hi, z_hi], mat, off=off)

    # Carriage bolts on front of rail (Z: 0.9 to 1.1)
    c(f'{prefix}_bolt_l', [-5.75, y_mid - 0.25, 0.9], [-5.25, y_mid + 0.25, 1.1], 'dark_metal', off=['north'])
    c(f'{prefix}_bolt_r', [5.25, y_mid - 0.25, 0.9], [5.75, y_mid + 0.25, 1.1], 'dark_metal', off=['north'])

make_rail('rail_bot', 3.5, 7.5)
make_rail('rail_mid', 10.5, 14.5)
make_rail('rail_top', 17.5, 21.5)

# 4. Ballast Sandbags on Skid Feet
c('sandbag_l', [-6.4, 0.6, 1.2], [-4.6, 1.9, 3.6], 'sandbag', off=['down'])
c('sandbag_r', [4.6, 0.6, -3.6], [6.4, 1.9, -1.2], 'sandbag', off=['down'])

# 5. Amber Warning Flasher Light on Top Left Post
c('flasher_bracket', [-5.9, 23.5, -0.4], [-5.1, 24.5, 0.4], 'dark_metal', off=['down'])
c('flasher_housing', [-6.5, 24.5, -0.6], [-4.5, 27.5, 0.6], 'dark_metal', off=['down'])
c('flasher_lens_f',  [-6.2, 24.8, 0.6], [-4.8, 27.2, 0.8], 'amber', off=['north'])
c('flasher_lens_b',  [-6.2, 24.8, -0.8], [-4.8, 27.2, -0.6], 'amber', off=['south'])

errs = check_z_fighting_and_collisions(cs, a)
print(f"Total cubes: {len(cs)}")
print(f"Total audit errors: {len(errs)}")
for e in errs:
    print("  ", e)
