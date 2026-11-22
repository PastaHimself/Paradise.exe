import sys
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
from pipeline import *
from checker import checker
from audit_geometry import check_z_fighting_and_collisions

cs = []
a = {}
def c(n, lo, hi, m, off=[]):
    cs.append({'name': n, 'from': lo, 'to': hi})
    a[n] = (m, off, False)

# 1. Base Ash Bed & Soot (Y: 0.0 to 0.4)
c('ash_bed_main', [-7.0, 0.0, -6.5], [6.0, 0.4, 4.0], 'volcanic_ash', off=['down'])
c('soot_fringe', [-5.0, 0.0, 4.0], [6.5, 0.2, 7.2], 'carbon_soot', off=['down', 'north'])

# 2. Charred Tire Fragment (calcined rubber & steel bead wire)
c('tire_chunk', [-5.5, 0.4, -4.5], [-2.5, 2.6, -2.0], 'carbon_soot', off=['down'])
c('bead_wires', [-2.5, 0.8, -4.0], [-1.5, 1.8, -2.5], 'structural_steel', off=['west'])

# 3. Solidified Melted Aluminum Slag Puddle
c('aluminum_slag', [1.0, 0.4, -5.0], [5.5, 0.9, -1.5], 'molten_aluminum', off=['down'])

# 4. Calcined Battery / Accessory Housing
c('battery_casing', [2.0, 0.9, -4.2], [5.0, 3.2, -2.0], 'charred_casing', off=['down'])
c('terminal_post', [2.5, 3.2, -3.5], [3.2, 3.8, -2.8], 'structural_steel', off=['down'])

# 5. Scorched Twisted Sheet Metal Fragment
c('sheet_base', [-3.0, 0.4, 0.0], [3.0, 2.2, 4.0], 'scorched_sheet', off=['down'])
c('curled_flap', [-2.0, 2.2, 1.5], [1.5, 4.0, 3.5], 'scorched_sheet', off=['down'])

# 6. Smoldering Glowing Ember Core (nestled in center)
c('ember_core', [-1.0, 0.4, -2.0], [1.0, 1.2, 0.0], 'glowing_ember', off=['down', 'south', 'east'])

# 7. Vitrified Melted Glass Clusters
c('glass_clump_1', [-6.5, 0.4, 2.0], [-4.5, 0.8, 3.8], 'melted_glass', off=['down'])
c('glass_clump_2', [4.5, 0.4, 1.0], [5.8, 0.8, 3.5], 'melted_glass', off=['down'])

print(f"Total cubes defined: {len(cs)}")
errs = check_z_fighting_and_collisions(cs, a)
assert len(errs) == 0, f"Audit errors found: {errs}"

regions = {
    'volcanic_ash': (0, 0, 'basalt_top.png', 16, 16),
    'carbon_soot': (16, 0, 'coal_block.png', 16, 16),
    'structural_steel': (32, 0, 'netherite_block.png', 16, 16),
    'molten_aluminum': (48, 0, 'iron_block.png', 16, 16),
    'charred_casing': (0, 16, 'blackstone_top.png', 16, 16),
    'scorched_sheet': (16, 16, 'raw_iron_block.png', 16, 16),
    'glowing_ember': (32, 16, 'magma.png', 16, 16),
    'melted_glass': (48, 16, 'obsidian.png', 16, 16)
}

plan = {
    'reference': 'https://www.shutterstock.com/search/abandoned-burnt-out-vehicle-on-roadside, https://www.alamy.com/stock-photo/highway-fire-damage-asphalt-burn.html',
    'used': 'freeway post-fire charred debris scatter featuring base volcanic ash and soot fall bed, calcined burned tire chunk with protruding radial steel bead wires, solidified molten aluminum slag puddle, heat-cracked battery accessory housing with terminal post, scorched twisted sheet metal hood shard with curled heat-warped flap, smoldering glowing ember magma core, and vitrified dark glass droplets on asphalt',
    'limitations': [
        'modular 14-unit wide roadside charred wreckage scatter fitting strictly within 30x30x30 bounding box with 0 volume overlaps and 0 coplanar z-fighting',
        'original basalt_top, coal_block, netherite_block, iron_block, blackstone_top, raw_iron_block, magma, obsidian pixels unchanged; active ember and extinguished variants'
    ]
}

D = build('charred_debris', cs, a, regions, plan, area='burning_highway')

checker(D, [0, 1.5, 0.0], [18, 16, 18])
views(D, [0, 1.5, 0.0], {
    'front': [0, 1.5, 18],
    'three_quarter': [16, 14, 16],
    'back': [-16, 14, -16],
    'gameplay_scale': [22, 20, 22],
    'ember_close': [0, 1.5, -6.0],
    'tire_close': [-4.0, 2.0, -3.0]
})

# Create extinguished variant texture and views (ember extinguished to blackstone)
im_ext = Image.open(D/'charred_debris.png').convert('RGBA')
im_ext.paste(Image.open(S/'basalt_top.png').convert('RGBA'), (0, 0))
im_ext.paste(Image.open(S/'coal_block.png').convert('RGBA'), (16, 0))
im_ext.paste(Image.open(S/'netherite_block.png').convert('RGBA'), (32, 0))
im_ext.paste(Image.open(S/'raw_iron_block.png').convert('RGBA'), (48, 0))
im_ext.paste(Image.open(S/'blackstone_top.png').convert('RGBA'), (0, 16))
im_ext.paste(Image.open(S/'blackstone_top.png').convert('RGBA'), (16, 16))
im_ext.paste(Image.open(S/'blackstone_top.png').convert('RGBA'), (32, 16)) # extinguished core
im_ext.paste(Image.open(S/'obsidian.png').convert('RGBA'), (48, 16))
im_ext.save(D/'charred_debris_extinguished.png')
(D/'charred_debris_active.png').write_bytes((D/'charred_debris.png').read_bytes())

call('create_texture', {'name': 'charred_debris_extinguished', 'data': str(D/'charred_debris_extinguished.png')})
audit = json.loads((D/'uv_audit.json').read_text())
try:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': 'charred_debris_extinguished'} for f, v in q['faces'].items() if v['texture'] is not None}})
    views(D, [0, 1.5, 0.0], {
        'front_extinguished': [0, 1.5, 18],
        'three_quarter_extinguished': [16, 14, 16]
    })
finally:
    for q in audit:
        call('set_cube_uv', {'id': q['uuid'], 'faces': {f: {'texture': v['texture']} for f, v in q['faces'].items()}})

# Normal finish (exports models, verifies UVs, closes project tab)
finish('charred_debris', 'Charred debris', 'Stone masonry', 'Loose brick', area='burning_highway')

# Write variant verification
(D/'variant_verification.json').write_text(json.dumps({
    'variants': ['active_ember', 'extinguished'],
    'textures': ['charred_debris.png', 'charred_debris_extinguished.png'],
    'views': ['front.png', 'three_quarter.png', 'back.png', 'gameplay_scale.png', 'ember_close.png', 'tire_close.png', 'front_extinguished.png', 'three_quarter_extinguished.png']
}, indent=2))

# Update TODO.md header to point to Catacombs
todo_path = ROOT / 'paradise_exe_v2/TODO.md'
txt = todo_path.read_text()
txt = re.sub(r'Current: \*\*.*?\*\*', 'Current: **Catacombs Stone masonry — IN PROGRESS**', txt, count=1)
txt = re.sub(r'Next: \*\*.*?\*\*', 'Next: **Catacombs Loose brick**', txt, count=1)
todo_path.write_text(txt)

print("Charred debris complete and verified! Burning Highway 100% COMPLETE!")
