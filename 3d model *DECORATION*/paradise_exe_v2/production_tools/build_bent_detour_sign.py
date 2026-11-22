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
# BURNING HIGHWAY: BENT DETOUR SIGN (Crash Impact Deflection)
# -------------------------------------------------------------------------

# 1. Buckled Sign Plates (Left crushed backward, Right tilted)
c('plate_l', [-7.0, 4.4, -1.0], [-0.6, 12.4, -0.6], 'orange')
c('plate_crease', [-0.6, 4.8, -0.6], [-0.2, 12.6, 0.0], 'orange', off=['west', 'east'])
c('plate_r', [-0.2, 5.2, 0.0], [7.0, 13.2, 0.4], 'orange')

# 2. Black Borders on Left Plate (Z: -0.6 to -0.52)
c('border_l_top', [-7.0, 12.0, -0.6], [-0.6, 12.4, -0.52], 'ink', off=['north'])
c('border_l_bot', [-7.0, 4.4, -0.6], [-0.6, 4.8, -0.52], 'ink', off=['north'])
c('border_l_outer', [-7.0, 4.8, -0.6], [-6.6, 12.0, -0.52], 'ink', off=['north', 'up', 'down'])

# 3. Black Borders on Right Plate (Z: 0.4 to 0.48)
c('border_r_top', [-0.2, 12.8, 0.4], [7.0, 13.2, 0.48], 'ink', off=['north'])
c('border_r_bot', [-0.2, 5.2, 0.4], [7.0, 5.6, 0.48], 'ink', off=['north'])
c('border_r_outer', [6.6, 5.6, 0.4], [7.0, 12.8, 0.48], 'ink', off=['north', 'up', 'down'])

# 4. Lettering
sign_lettering_part(cs, a, 'DET', 0.42, 8.9, -0.6, -5.5, depth=0.08, material='ink', prefix='let_l')
sign_lettering_part(cs, a, 'OUR', 0.42, 9.7, 0.4, 0.8, depth=0.08, material='ink', prefix='let_r')

# 5. Directional Arrow (bent across fold)
c('arrow_shaft_l', [-3.5, 6.4, -0.6], [-0.6, 7.4, -0.52], 'ink', off=['north'])
c('arrow_shaft_r', [-0.2, 7.2, 0.4], [1.5, 8.2, 0.48], 'ink', off=['north', 'east'])
c('arrow_bar',     [1.5, 6.4, 0.4], [2.3, 9.0, 0.48], 'ink', off=['north', 'west', 'east'])
c('arrow_tip',     [2.3, 7.2, 0.4], [3.5, 8.2, 0.48], 'ink', off=['north', 'west'])

# 6. Bent Support Posts
c('post_l_stub', [-4.6, 0.0, -0.6], [-4.0, 3.2, 0.0], 'steel', off=['down', 'up'])
c('post_l_kink', [-4.7, 3.2, 0.0], [-3.9, 5.2, 0.6], 'steel', off=['down', 'up'])
c('post_l_upper',[-4.6, 5.2, -1.6], [-4.0, 11.2, -1.0], 'steel', off=['down', 'south'])

c('post_r_lower', [4.0, 0.0, -0.6], [4.6, 5.5, 0.0], 'steel', off=['down', 'up', 'south'])
c('post_r_upper', [3.9, 5.5, -0.6], [4.5, 13.0, 0.0], 'steel', off=['down', 'south'])

# 7. Hardware Bolts (torn / sheared on left, intact on right)
c('bolt_bl', [-4.5, 5.2, -0.6], [-4.1, 5.6, -0.4], 'dark_metal', off=['north'])
c('bolt_tr', [4.0, 12.0, 0.4], [4.4, 12.4, 0.6], 'dark_metal', off=['north'])
c('bolt_br', [4.0, 6.0, 0.4], [4.4, 6.4, 0.6], 'dark_metal', off=['north'])

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors: {errs}"

regions = {
    'orange': (0, 0, 'concrete_orange.png', 16, 16),
    'ink': (16, 0, 'concrete_black.png', 16, 16),
    'steel': (32, 0, 'iron_block.png', 16, 16),
    'dark_metal': (48, 0, 'netherite_block.png', 16, 16),
}

plan = {
    'id': 'burning_highway_bent_detour_sign',
    'reference': 'https://mutcd.fhwa.dot.gov/',
    'used': 'vehicle crash-damaged highway DETOUR sign with crumpled dual-plane buckled faceplate, kinked directional arrow, buckled U-channel impact post, sheared mounting hardware, and tilted upright; includes normal and scorched variants',
    'notes': [
        'damaged roadway warning sign with 0 volume overlaps and 0 coplanar z-fighting',
        'original concrete_orange, concrete_black, iron_block, and netherite_block pixels unchanged',
        'static prop; no physics simulation'
    ]
}

# Ensure clean tab if needed
call('risky_eval', {'code': '(() => { if (Project) { Project.elements.slice().forEach(e => e.remove()); Project.textures.slice().forEach(t => t.remove()); } return true; })()'})

D = build('bent_detour_sign', cs, a, regions, plan, area='burning_highway')

checker(D, [0, 8, 0], [18, 14, 18])
views(D, [0, 8, 0], {
    'front': [0, 9, 22],
    'three_quarter': [18, 14, 18],
    'back': [-18, 14, -18],
    'gameplay_scale': [28, 20, 26],
    'crease_close': [-0.5, 9, 8]
})

# Create scorched variant texture and views
im = Image.open(D/'bent_detour_sign.png').convert('RGBA')
im.paste(Image.open(S/'blackstone_top.png').convert('RGBA'), (0, 0))
im.save(D/'bent_detour_sign_scorched.png')
(D/'bent_detour_sign_normal.png').write_bytes((D/'bent_detour_sign.png').read_bytes())

call('create_texture', {'name': 'bent_detour_sign_scorched', 'data': str(D/'bent_detour_sign_scorched.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'bent_detour_sign_scorched'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 8, 0], {
        'front_scorched': [0, 9, 22],
        'three_quarter_scorched': [18, 14, 18]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

dump(D/'variant_verification.json', {
    'same_geometry_and_UVs': True,
    'normal': 'bent_detour_sign_normal.png',
    'scorched': 'bent_detour_sign_scorched.png',
    'scorched_source': 'blackstone_top.png',
    'original_pixels': True
})

finish('bent_detour_sign', 'Bent DETOUR sign', 'ROAD CLOSED sign', 'Bent ROAD CLOSED sign', area='burning_highway')
print('Bent DETOUR sign build and verification complete.', flush=True)
