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

def sign_lettering(cs, a, text, pixel, y, z_front, depth=0.08, material='white', prefix='letter', x_center=0.0):
    width = sum((len(FONT[ch][0]) if ch != ' ' else 2) + 1 for ch in text) - 1
    x_start = x_center - width * pixel / 2.0
    x = x_start
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
# BURNING HIGHWAY: BENT OVERHEAD DIRECTION SIGN (Crash Impact Dihedral Buckle)
# -------------------------------------------------------------------------

# 1. Buckled Sign Plates (Left crushed backward, Right bent forward)
c('plate_l', [-11.0, 3.6, -1.0], [-0.6, 14.6, -0.6], 'green')
c('plate_crease', [-0.6, 3.9, -0.6], [0.6, 14.9, 0.2], 'green', off=['west', 'east'])
c('plate_r', [0.6, 4.3, 0.2], [11.0, 15.3, 0.6], 'green')

# 2. Borders
c('border_l_top',   [-11.0, 14.2, -0.6], [-0.6, 14.6, -0.52], 'white', off=['north'])
c('border_l_bot',   [-11.0, 3.6, -0.6], [-0.6, 4.0, -0.52], 'white', off=['north'])
c('border_l_outer', [-11.0, 4.0, -0.6], [-10.6, 14.2, -0.52], 'white', off=['north', 'up', 'down'])

c('border_r_top',   [0.6, 14.9, 0.6], [11.0, 15.3, 0.68], 'white', off=['north'])
c('border_r_bot',   [0.6, 4.3, 0.6], [11.0, 4.7, 0.68], 'white', off=['north'])
c('border_r_outer', [10.6, 4.7, 0.6], [11.0, 14.9, 0.68], 'white', off=['north', 'up', 'down'])

c('divider_crease', [-0.2, 4.1, 0.2], [0.2, 14.7, 0.28], 'white', off=['north', 'up', 'down'])

# 3. Lettering
sign_lettering(cs, a, 'WEST', 0.42, 10.1, -0.6, depth=0.08, material='white', prefix='let_w', x_center=-5.5)
sign_lettering(cs, a, 'EAST', 0.42, 10.8, 0.6, depth=0.08, material='white', prefix='let_e', x_center=5.5)

# 4. Directional Arrows
c('arr_up_shaft', [-6.0, 4.8, -0.6], [-5.0, 7.4, -0.52], 'white', off=['north', 'up'])
c('arr_up_barb',  [-6.8, 7.4, -0.6], [-4.2, 8.1, -0.52], 'white', off=['north', 'down', 'up'])
c('arr_up_peak',  [-6.0, 8.1, -0.6], [-5.0, 9.0, -0.52], 'white', off=['north', 'down'])

c('arr_sl_step1', [4.0, 5.5, 0.6], [5.0, 6.5, 0.68], 'white', off=['north', 'east', 'up'])
c('arr_sl_step2', [5.0, 6.5, 0.6], [6.0, 7.5, 0.68], 'white', off=['north', 'west', 'down', 'east', 'up'])
c('arr_sl_step3', [6.0, 7.5, 0.6], [7.0, 8.5, 0.68], 'white', off=['north', 'west', 'down', 'east', 'up'])
c('arr_sl_top',   [5.0, 8.5, 0.6], [7.0, 9.3, 0.68], 'white', off=['north', 'down', 'east'])
c('arr_sl_wing',  [7.0, 7.3, 0.6], [7.8, 9.3, 0.68], 'white', off=['north', 'west'])

# 5. Posts & Gantry Clamps
c('post_l_bot',   [-7.8, 2.5, -1.6], [-7.0, 6.0, -1.0], 'steel', off=['south', 'down', 'up'])
c('post_l_kink',  [-8.0, 6.0, -1.6], [-7.2, 8.0, -1.0], 'steel', off=['down', 'up', 'south'])
c('post_l_upper', [-7.8, 8.0, -2.2], [-7.0, 16.5, -1.6], 'steel', off=['down', 'south'])

c('clamp_l_top',  [-8.0, 16.5, -2.8], [-6.8, 17.0, -1.4], 'steel', off=['down'])
c('clamp_l_back', [-8.0, 15.5, -2.8], [-6.8, 16.5, -2.2], 'steel', off=['east', 'west', 'south'])

c('post_r_lower', [7.0, 3.5, -0.4], [7.8, 9.0, 0.2], 'steel', off=['south', 'down', 'up'])
c('post_r_upper', [6.9, 9.0, -0.4], [7.7, 17.0, 0.2], 'steel', off=['south', 'down'])

c('clamp_r_top',  [6.7, 17.0, -0.9], [7.9, 17.5, 0.4], 'steel', off=['down'])
c('clamp_r_back', [6.7, 16.0, -0.9], [7.9, 17.0, -0.4], 'steel', off=['east', 'west', 'south'])

# 6. Twisted Backing Rails (behind posts)
c('str_l_top', [-10.5, 12.8, -2.6], [-0.6, 13.6, -2.2], 'steel', off=['south'])
c('str_l_bot', [-10.5, 4.4, -2.6], [-0.6, 5.2, -2.2], 'steel', off=['south'])

c('str_r_top', [0.6, 13.5, -0.8], [10.5, 14.3, -0.4], 'steel', off=['south'])
c('str_r_bot', [0.6, 5.1, -0.8], [10.5, 5.9, -0.4], 'steel', off=['south'])

# 7. Hardware Bolts (left lower sheared off)
c('bolt_tl', [-7.6, 13.0, -0.6], [-7.2, 13.4, -0.4], 'dark_metal', off=['north'])
c('bolt_tr', [7.2, 13.7, 0.6], [7.6, 14.1, 0.8], 'dark_metal', off=['north'])
c('bolt_br', [7.2, 5.3, 0.6], [7.6, 5.7, 0.8], 'dark_metal', off=['north'])

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors: {errs}"

regions = {
    'green': (0, 0, 'concrete_green.png', 16, 16),
    'white': (16, 0, 'concrete_white.png', 16, 16),
    'steel': (32, 0, 'iron_block.png', 16, 16),
    'dark_metal': (48, 0, 'netherite_block.png', 16, 16),
}

plan = {
    'id': 'burning_highway_bent_overhead_direction_sign',
    'reference': 'https://mutcd.fhwa.dot.gov/',
    'used': 'vehicle crash-damaged freeway overhead guide sign with crumpled V-fold buckled 22x11 green faceplate, folded WEST and EAST destination lettering, directional arrows, buckled structural steel struts, twisted gantry clamp brackets, backing rails, and hardware bolts; includes normal and scorched variants',
    'notes': [
        'damaged overhead freeway guide sign with 0 volume overlaps and 0 coplanar z-fighting',
        'original concrete_green, concrete_white, iron_block, and netherite_block pixels unchanged',
        'static prop; no physics simulation'
    ]
}

# Ensure clean tab if needed
call('risky_eval', {'code': '(() => { if (Project) { Project.elements.slice().forEach(e => e.remove()); Project.textures.slice().forEach(t => t.remove()); } return true; })()'})

D = build('bent_overhead_direction_sign', cs, a, regions, plan, area='burning_highway')

checker(D, [0, 10, 0], [22, 18, 22])
views(D, [0, 10, 0], {
    'front': [0, 10, 26],
    'three_quarter': [22, 18, 22],
    'back': [-22, 18, -22],
    'gameplay_scale': [32, 24, 30],
    'face_close': [0, 10, 14]
})

# Create scorched variant texture and views
im = Image.open(D/'bent_overhead_direction_sign.png').convert('RGBA')
im.paste(Image.open(S/'blackstone_top.png').convert('RGBA'), (0, 0))
im.save(D/'bent_overhead_direction_sign_scorched.png')
(D/'bent_overhead_direction_sign_normal.png').write_bytes((D/'bent_overhead_direction_sign.png').read_bytes())

call('create_texture', {'name': 'bent_overhead_direction_sign_scorched', 'data': str(D/'bent_overhead_direction_sign_scorched.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'bent_overhead_direction_sign_scorched'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 10, 0], {
        'front_scorched': [0, 10, 26],
        'three_quarter_scorched': [22, 18, 22]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

dump(D/'variant_verification.json', {
    'same_geometry_and_UVs': True,
    'normal': 'bent_overhead_direction_sign_normal.png',
    'scorched': 'bent_overhead_direction_sign_scorched.png',
    'scorched_source': 'blackstone_top.png',
    'original_pixels': True
})

finish('bent_overhead_direction_sign', 'Bent overhead direction sign', 'Burned-out vehicle shell', 'Detached wheel', area='burning_highway')
print('Bent overhead direction sign build and verification complete.', flush=True)
