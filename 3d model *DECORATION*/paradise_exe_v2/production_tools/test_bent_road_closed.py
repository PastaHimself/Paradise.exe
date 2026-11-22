import sys
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
from audit_geometry import check_z_fighting_and_collisions
from glyphs import FONT

cs = []
a = {}
def c(n, lo, hi, m, off=[]):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, off, False)

def sign_lettering_part(cs, a, text, pixel, y, z_front, x_offset, depth=0.08, material='ink', prefix='letter'):
    x = x_offset
    for col, ch in enumerate(text):
        if ch == ' ':
            x += 3 * pixel
            continue
        runs = []
        for line in FONT[ch]:
            row = []
            i = 0
            while i < len(line):
                if line[i] == '0':
                    i += 1
                    continue
                j = i + 1
                while j < len(line) and line[j] == '1':
                    j += 1
                row.append((i, j))
                i = j
            runs.append(row)
        seen = set()
        for row, items in enumerate(runs):
            for i, j in items:
                if (row, i, j) in seen:
                    continue
                k = row + 1
                while k < 5 and (i, j) in runs[k] and (k, i, j) not in seen:
                    k += 1
                for rr in range(row, k):
                    seen.add((rr, i, j))
                name = f'{prefix}_{col}_{row}_{i}'
                x_lo = x + i * pixel
                x_hi = x + j * pixel
                y_lo = y + (5 - k) * pixel
                y_hi = y + (5 - row) * pixel
                cs.append({'name': name, 'from': [x_lo, y_lo, z_front], 'to': [x_hi, y_hi, z_front + depth]})
                a[name] = (material, ['north', 'east', 'west', 'up', 'down'], False)
        x += (len(FONT[ch][0]) + 1) * pixel

# -------------------------------------------------------------------------
# BURNING HIGHWAY: BENT ROAD CLOSED SIGN (V-Fold Buckling Impact)
# -------------------------------------------------------------------------

# 1. Buckled Sign Plates (Left crushed backward, Right bent forward)
# Left plate: X in [-8.0, -0.4], Y in [4.8, 14.8], Z in [-0.8, -0.4]
c('plate_l', [-8.0, 4.8, -0.8], [-0.4, 14.8, -0.4], 'white')
# Crease transition: X in [-0.4, 0.4], Y in [5.1, 15.1], Z in [-0.4, 0.2]
c('plate_crease', [-0.4, 5.1, -0.4], [0.4, 15.1, 0.2], 'white', off=['west', 'east'])
# Right plate: X in [0.4, 8.0], Y in [5.5, 15.5], Z in [0.2, 0.6]
c('plate_r', [0.4, 5.5, 0.2], [8.0, 15.5, 0.6], 'white')

# 2. Black Borders on Left Plate (Z: -0.4 to -0.32)
c('border_l_top', [-8.0, 14.4, -0.4], [-0.4, 14.8, -0.32], 'ink', off=['north'])
c('border_l_bot', [-8.0, 4.8, -0.4], [-0.4, 5.2, -0.32], 'ink', off=['north'])
c('border_l_outer', [-8.0, 5.2, -0.4], [-7.6, 14.4, -0.32], 'ink', off=['north', 'up', 'down'])

# 3. Black Borders on Right Plate (Z: 0.6 to 0.68)
c('border_r_top', [0.4, 15.1, 0.6], [8.0, 15.5, 0.68], 'ink', off=['north'])
c('border_r_bot', [0.4, 5.5, 0.6], [8.0, 5.9, 0.68], 'ink', off=['north'])
c('border_r_outer', [7.6, 5.9, 0.6], [8.0, 15.1, 0.68], 'ink', off=['north', 'up', 'down'])

# 4. Folded Lettering
# Line 1: 'ROAD' -> 'RO' on left plate (Z = -0.4), 'AD' on right plate (Z = 0.6)
# width of RO = 7 pixels * 0.42 = 2.94. x offset: -3.8
sign_lettering_part(cs, a, 'RO', 0.42, 10.7, -0.4, -3.8, depth=0.08, material='ink', prefix='let_ro')
# width of AD = 7 pixels * 0.42 = 2.94. x offset: 0.8
sign_lettering_part(cs, a, 'AD', 0.42, 11.4, 0.6, 0.8, depth=0.08, material='ink', prefix='let_ad')

# Line 2: 'CLOSED' -> 'CLO' on left plate, 'SED' on right plate
# width of CLO = 11 pixels * 0.42 = 4.62. x offset: -5.4
sign_lettering_part(cs, a, 'CLO', 0.42, 6.7, -0.4, -5.1, depth=0.08, material='ink', prefix='let_clo')
# width of SED = 11 pixels * 0.42 = 4.62. x offset: 0.8
sign_lettering_part(cs, a, 'SED', 0.42, 7.4, 0.6, 0.8, depth=0.08, material='ink', prefix='let_sed')

# 5. Support Posts (Severely bent on left, tilted on right)
# Left post:
# Lower stub: Y in [0, 3.2]
c('post_l_stub', [-5.6, 0.0, -0.6], [-5.0, 3.2, 0.0], 'steel', off=['down', 'up'])
# Bent elbow: Y in [3.2, 5.2]
c('post_l_kink', [-5.8, 3.2, -0.2], [-5.0, 5.2, 0.5], 'steel', off=['down', 'up'])
# Upper post behind left plate: Y in [5.2, 14.5], Z in [-1.4, -0.8]
c('post_l_upper', [-5.6, 5.2, -1.4], [-5.0, 14.5, -0.8], 'steel', off=['down', 'south'])

# Right post:
# Lower post: Y in [0, 4.5]
c('post_r_lower', [5.0, 0.0, -0.6], [5.6, 4.5, 0.0], 'steel', off=['down', 'up', 'south'])
# Upper tilted post behind right plate: Y in [4.5, 15.5], Z in [-0.4, 0.2]
c('post_r_upper', [4.9, 4.5, -0.4], [5.5, 15.5, 0.2], 'steel', off=['down', 'south'])

# 6. Twisted Backing Stringers
# Left stringers: mounted to back of left plate (Z in [-1.2, -0.8])
c('str_l_top', [-7.5, 12.6, -1.8], [-0.4, 13.6, -1.4], 'steel', off=['south'])
c('str_l_bot', [-7.5, 6.2, -1.8], [-0.4, 7.2, -1.4], 'steel', off=['south'])
# Right stringers: mounted to back of right plate (Z in [-0.2, 0.2])
c('str_r_top', [0.4, 13.2, -0.8], [7.5, 14.2, -0.4], 'steel', off=['south'])
c('str_r_bot', [0.4, 6.8, -0.8], [7.5, 7.8, -0.4], 'steel', off=['south'])

# 7. Mounting Hardware Bolts (torn / sheared on left, intact on right)
c('bolt_bl', [-5.8, 6.5, -0.4], [-5.4, 6.9, -0.2], 'dark_metal', off=['north'])
c('bolt_tr', [5.0, 13.5, 0.6], [5.4, 13.9, 0.8], 'dark_metal', off=['north'])
c('bolt_br', [5.0, 7.1, 0.6], [5.4, 7.5, 0.8], 'dark_metal', off=['north'])

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
print(f"Total audit errors: {len(errs)}")
for e in errs:
    print("  ", e)
