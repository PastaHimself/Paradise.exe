import sys, os
from pathlib import Path
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
from pipeline import *
from checker import checker
from views import views
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
c('plate_l', [-8.0, 4.8, -0.8], [-0.4, 14.8, -0.4], 'white')
c('plate_crease', [-0.4, 5.1, -0.4], [0.4, 15.1, 0.2], 'white', off=['west', 'east'])
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
sign_lettering_part(cs, a, 'RO', 0.42, 10.7, -0.4, -3.8, depth=0.08, material='ink', prefix='let_ro')
sign_lettering_part(cs, a, 'AD', 0.42, 11.4, 0.6, 0.8, depth=0.08, material='ink', prefix='let_ad')

sign_lettering_part(cs, a, 'CLO', 0.42, 6.7, -0.4, -5.1, depth=0.08, material='ink', prefix='let_clo')
sign_lettering_part(cs, a, 'SED', 0.42, 7.4, 0.6, 0.8, depth=0.08, material='ink', prefix='let_sed')

# 5. Support Posts (Severely bent on left, tilted on right)
c('post_l_stub', [-5.6, 0.0, -0.6], [-5.0, 3.2, 0.0], 'steel', off=['down', 'up'])
c('post_l_kink', [-5.8, 3.2, -0.2], [-5.0, 5.2, 0.5], 'steel', off=['down', 'up'])
c('post_l_upper', [-5.6, 5.2, -1.4], [-5.0, 14.5, -0.8], 'steel', off=['down', 'south'])

c('post_r_lower', [5.0, 0.0, -0.6], [5.6, 4.5, 0.0], 'steel', off=['down', 'up', 'south'])
c('post_r_upper', [4.9, 4.5, -0.4], [5.5, 15.5, 0.2], 'steel', off=['down', 'south'])

# 6. Twisted Backing Stringers
c('str_l_top', [-7.5, 12.6, -1.8], [-0.4, 13.6, -1.4], 'steel', off=['south'])
c('str_l_bot', [-7.5, 6.2, -1.8], [-0.4, 7.2, -1.4], 'steel', off=['south'])
c('str_r_top', [0.4, 13.2, -0.8], [7.5, 14.2, -0.4], 'steel', off=['south'])
c('str_r_bot', [0.4, 6.8, -0.8], [7.5, 7.8, -0.4], 'steel', off=['south'])

# 7. Mounting Hardware Bolts (torn / sheared on left, intact on right)
c('bolt_bl', [-5.8, 6.5, -0.4], [-5.4, 6.9, -0.2], 'dark_metal', off=['north'])
c('bolt_tr', [5.0, 13.5, 0.6], [5.4, 13.9, 0.8], 'dark_metal', off=['north'])
c('bolt_br', [5.0, 7.1, 0.6], [5.4, 7.5, 0.8], 'dark_metal', off=['north'])

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors: {errs}"

regions = {
    'white': (0, 0, 'concrete_white.png', 16, 16),
    'ink': (16, 0, 'concrete_black.png', 16, 16),
    'steel': (32, 0, 'iron_block.png', 16, 16),
    'dark_metal': (48, 0, 'netherite_block.png', 16, 16),
}

plan = {
    'id': 'burning_highway_bent_road_closed_sign',
    'reference': 'https://mutcd.fhwa.dot.gov/',
    'used': 'vehicle crash-damaged highway ROAD CLOSED sign with crumpled V-fold buckled 16x10 faceplate, folded two-line ROAD CLOSED lettering, buckled U-channel impact post, sheared mounting bolt hardware, and twisted backing stringers; includes normal and scorched variants',
    'notes': [
        'damaged roadway warning sign with 0 volume overlaps and 0 coplanar z-fighting',
        'original concrete_white, concrete_black, iron_block, and netherite_block pixels unchanged',
        'static prop; no physics simulation'
    ]
}

# Ensure clean tab if needed
call('risky_eval', {'code': '(() => { if (Project) { Project.elements.slice().forEach(e => e.remove()); Project.textures.slice().forEach(t => t.remove()); } return true; })()'})

D = build('bent_road_closed_sign', cs, a, regions, plan, area='burning_highway')

checker(D, [0, 9, 0], [20, 16, 20])
views(D, [0, 9, 0], {
    'front': [0, 10, 24],
    'three_quarter': [20, 16, 20],
    'back': [-20, 16, -20],
    'gameplay_scale': [30, 22, 28],
    'crease_close': [0, 10, 8]
})

# Create scorched variant texture and views
im = Image.open(D/'bent_road_closed_sign.png').convert('RGBA')
im.paste(Image.open(S/'blackstone_top.png').convert('RGBA'), (0, 0))
im.save(D/'bent_road_closed_sign_scorched.png')
(D/'bent_road_closed_sign_normal.png').write_bytes((D/'bent_road_closed_sign.png').read_bytes())

call('create_texture', {'name': 'bent_road_closed_sign_scorched', 'data': str(D/'bent_road_closed_sign_scorched.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'bent_road_closed_sign_scorched'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 9, 0], {
        'front_scorched': [0, 10, 24],
        'three_quarter_scorched': [20, 16, 20]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

dump(D/'variant_verification.json', {
    'same_geometry_and_UVs': True,
    'normal': 'bent_road_closed_sign_normal.png',
    'scorched': 'bent_road_closed_sign_scorched.png',
    'scorched_source': 'blackstone_top.png',
    'original_pixels': True
})

finish('bent_road_closed_sign', 'Bent ROAD CLOSED sign', 'EMERGENCY EXIT sign', 'Bent EMERGENCY EXIT sign', area='burning_highway')
print('Bent ROAD CLOSED sign build and verification complete.', flush=True)
