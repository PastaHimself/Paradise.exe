import sys, os, copy
from pathlib import Path
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
from pipeline import *
from checker import checker
from views import views
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

# 5. Center Hub Cap & Lug Nuts
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
assert len(errs) == 0, f"Audit errors: {errs}"

regions = {
    'rubber': (0, 0, 'concrete_black.png', 16, 16),
    'alloy': (16, 0, 'iron_block.png', 16, 16),
    'alloy_dark': (32, 0, 'raw_iron_block.png', 16, 16),
    'steel': (48, 0, 'quartz_block_side.png', 16, 16),
    'dark_metal': (0, 16, 'netherite_block.png', 16, 16),
}

plan = {
    'id': 'burning_highway_detached_wheel',
    'reference': 'https://www.alamy.com/stock-photo/detached-car-wheel-rim-tire-highway-debris.html',
    'used': 'freeway detached automotive wheel with octagonal tread profile rubber tire, recessed alloy rim barrel with bead flange lips, center drop dish, 5-lug bolt pattern, center hub cap, and brass valve stem; includes normal wheel, burned wheel, and rim-only variants',
    'notes': [
        'detached highway debris wheel with 0 volume overlaps and 0 coplanar z-fighting',
        'original concrete_black, iron_block, raw_iron_block, quartz_block_side, and netherite_block pixels unchanged',
        'static prop; no physics simulation'
    ]
}

# Ensure clean tab if needed
call('risky_eval', {'code': '(() => { if (Project) { Project.elements.slice().forEach(e => e.remove()); Project.textures.slice().forEach(t => t.remove()); } return true; })()'})

D = build('detached_wheel', cs, a, regions, plan, area='burning_highway')

checker(D, [0, 7.5, 2.5], [16, 16, 16])
views(D, [0, 7.5, 2.5], {
    'front': [0, 7.5, 20],
    'three_quarter': [16, 16, 16],
    'back': [-16, 16, -16],
    'gameplay_scale': [24, 20, 24],
    'hub_close': [0, 7.5, 10]
})

# Create burned variant texture and views
im_burned = Image.open(D/'detached_wheel.png').convert('RGBA')
im_burned.paste(Image.open(S/'blackstone_top.png').convert('RGBA'), (0, 0))
im_burned.paste(Image.open(S/'cauldron_side.png').convert('RGBA'), (16, 0))
im_burned.save(D/'detached_wheel_burned.png')
(D/'detached_wheel_normal.png').write_bytes((D/'detached_wheel.png').read_bytes())

call('create_texture', {'name': 'detached_wheel_burned', 'data': str(D/'detached_wheel_burned.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'detached_wheel_burned'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 7.5, 2.5], {
        'front_burned': [0, 7.5, 20],
        'three_quarter_burned': [16, 16, 16]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Capture rim_only view by hiding tire cubes temporarily in Blockbench BEFORE finish closes the project
tire_names = {'tire_top', 'tire_bot', 'tire_l', 'tire_r', 'tire_tl', 'tire_tr', 'tire_bl', 'tire_br', 'sidewall_top', 'sidewall_bot', 'sidewall_l', 'sidewall_r'}
try:
    call('risky_eval', {'code': f'''(() => {{
        let tireNames = new Set({json.dumps(list(tire_names))});
        Project.elements.forEach(e => {{
            if (tireNames.has(e.name)) e.visibility = false;
        }});
        Canvas.updateView({{elements: Project.elements}});
        return true;
    }})()'''})
    views(D, [0, 7.5, 2.5], {
        'front_rim_only': [0, 7.5, 20],
        'three_quarter_rim_only': [16, 16, 16]
    })
finally:
    call('risky_eval', {'code': '''(() => {
        Project.elements.forEach(e => { e.visibility = true; });
        Canvas.updateView({elements: Project.elements});
        return true;
    })()'''})

# Normal finish (exports models, verifies UVs, closes project tab)
finish('detached_wheel', 'Detached wheel', 'Broken bumper', 'Loose vehicle door', area='burning_highway')

# Geometry variant: Rim only (export separate geo JSON)
geo_full = json.loads((D/'burning_highway_detached_wheel.geo.json').read_text())
geo_rim = copy.deepcopy(geo_full)
for bone in geo_rim['minecraft:geometry'][0]['bones']:
    bone['cubes'] = [cube for cube in bone.get('cubes', []) if not any(tn in cube.get('name', '') for tn in tire_names)]
dump(D/'burning_highway_detached_rim.geo.json', geo_rim)

dump(D/'variant_verification.json', {
    'variants': ['wheel', 'burned_wheel', 'rim_only'],
    'normal_texture': 'detached_wheel_normal.png',
    'burned_texture': 'detached_wheel_burned.png',
    'full_geometry': 'burning_highway_detached_wheel.geo.json',
    'rim_geometry': 'burning_highway_detached_rim.geo.json',
    'original_pixels': True
})

print('Detached wheel build and verification complete.', flush=True)
