from views import *
from PIL import Image
import hashlib
import re
from audit_geometry import audit_full_coverage

S = ROOT / 'bedrock-samples-v1.26.70.23-preview-full/textures/blocks'

def build(folder, cs, assign, regions, plan, area='library'):
    D = ROOT / 'paradise_exe_v2' / area / folder
    D.mkdir(exist_ok=True, parents=True)
    stem = area + '_' + folder
    for f in D.glob('*.bbmodel'):
        f.unlink()
    cap = call('get_capabilities', {})
    current = cap.get('project')
    if current and current.get('name') == stem:
        call('risky_eval', {'code': 'Project && Project.close(true)'})
    call('create_project', {'name': stem, 'format': 'bedrock_block'})
    assert call('get_project_info', {})['project']['name'] == stem
    dump(D / 'plan.json', dict(plan, materials=regions))
    dump(D / 'build_elements.json', cs)
    call('place_cube', {'elements': cs, 'faces': False})
    
    im = Image.new('RGBA', (64, 64))
    tile = Image.open(S / next(iter(regions.values()))[2]).convert('RGBA')
    for x in range(0, 64, 16):
        for y in range(0, 64, 16):
            im.paste(tile, (x, y))
    for reg in regions.values():
        x, y, f = reg[:3]
        w, h = reg[3:] if len(reg) > 3 else (16, 16)
        for xx in range(x, x + w, 16):
            for yy in range(y, y + h, 16):
                im.paste(Image.open(S / f).convert('RGBA').crop((0, 0, 16, 16)), (xx, yy))
    im.save(D / (folder + '.png'))
    call('create_texture', {'name': folder, 'data': str(D / (folder + '.png'))})
    
    # 100% Full Texture Coverage: Every face of every cube is textured with 1 px/unit UV density
    for q in cs:
        dx, dy, dz = [b - a for a, b in zip(q['from'], q['to'])]
        m, off, rot = assign[q['name']]
        x, y, f = regions[m][:3]
        faces = {}
        for f, (w, h) in {'north': (dx, dy), 'south': (dx, dy), 'east': (dz, dy), 'west': (dz, dy), 'up': (dx, dz), 'down': (dx, dz)}.items():
            r = 90 if rot and f in ['north', 'south', 'east', 'west'] else 0
            if r:
                w, h = h, w
            faces[f] = {'uv': [x / 4, y / 4, (x + w) / 4, (y + h) / 4], 'texture': folder, 'rotation': r}
        call('set_cube_uv', {'id': q['name'], 'box_uv': False, 'faces': faces})
        
    dump(D / 'uv_audit.json', [call('get_cube_uv', {'id': q['name']}) for q in cs])
    return D

def finish(folder, title, nexttitle, nextnext, area='library'):
    D = ROOT / 'paradise_exe_v2' / area / folder
    stem = area + '_' + folder
    i = call('get_project_info', {})
    assert i['project']['name'] == stem
    uuid = i['project']['uuid']
    for codec, ext in [('project', 'bbmodel'), ('bedrock', 'geo.json')]:
        call('export_model', {'codec_id': codec, 'path': str(D / (stem + '.' + ext)), 'overwrite': True, 'max_content_length': 0})
    b = json.loads((D / (stem + '.bbmodel')).read_text())
    g = json.loads((D / (stem + '.geo.json')).read_text())
    p = json.loads((D / 'plan.json').read_text())
    assert len(b['elements']) == sum(len(q.get('cubes', [])) for q in g['minecraft:geometry'][0]['bones'])
    im = Image.open(D / (folder + '.png')).convert('RGBA')
    for reg in p['materials'].values():
        x, y, f = reg[:3]
        w, h = reg[3:] if len(reg) > 3 else (16, 16)
        for xx in range(x, x + w, 16):
            for yy in range(y, y + h, 16):
                assert im.crop((xx, yy, xx + 16, yy + 16)).tobytes() == Image.open(S / f).convert('RGBA').crop((0, 0, 16, 16)).tobytes()
    assert base64.b64decode(b['textures'][0]['source'].split(',')[1]) == (D / (folder + '.png')).read_bytes()
    
    # Verify 100% full coverage (ZERO missing textures)
    uncovered = audit_full_coverage(b['elements'])
    assert len(uncovered) == 0, f"Uncovered / missing texture faces found: {uncovered}"
    
    count = 0
    for q in b['elements']:
        dx, dy, dz = [v - u for u, v in zip(q['from'], q['to'])]
        spans = {'north': (dx, dy), 'south': (dx, dy), 'east': (dz, dy), 'west': (dz, dy), 'up': (dx, dz), 'down': (dx, dz)}
        for f, v in q['faces'].items():
            assert v.get('texture') is not None, f"Face {f} on {q['name']} is untextured!"
            u = v['uv']
            w, h = spans[f]
            if v.get('rotation', 0) in [90, 270]:
                w, h = h, w
            assert abs(abs(u[2] - u[0]) * 4 - w) < 1e-4 and abs(abs(u[3] - u[1]) * 4 - h) < 1e-4
            assert all(0 <= n <= 16 for n in u)
            count += 1
            
    assert count == len(b['elements']) * 6, f"Expected {len(b['elements'])*6} fully textured quads, got {count}"
    
    for n in ['front', 'three_quarter', 'back', 'gameplay_scale']:
        shot = D / (n + '.png')
        if not shot.exists():
            shot = D / (n + '.jpg')
        assert Image.open(shot).width == 640
        
    r = call('risky_eval', {'code': f'(()=>{{if(Project.uuid!=={json.dumps(uuid)})throw Error("Target changed");Codecs.project.write(Codecs.project.compile(),{json.dumps(str(D/(stem+".bbmodel")))});return {{saved:Project.saved,path:Project.save_path}}}})()'})
    assert r['saved']
    dump(D / 'verification.json', {
        'cubes': len(b['elements']),
        'active_quads': count,
        'coverage': '100% full coverage (0 untextured faces)',
        'density': '1 pixel/model unit',
        'UV_bounds': True,
        'native_pixels': True,
        'embedded_texture_matches': True,
        'source_runtime_match': True,
        'native_save': r
    })
    call('trigger_action', {'action': 'close_project', 'confirmDialog': False})
    r = call('risky_eval', {'code': 'ModelProject.all.map(p=>({uuid:p.uuid,name:p.name}))'})
    assert not any(q['uuid'] == uuid for q in r)
    t = ROOT / 'paradise_exe_v2/TODO.md'
    s = t.read_text()
    old = '- [ ] ' + title + '; references / paths: pending.'
    note = f'- [x] {title} — {len(b["elements"])} cubes / {count} quads (100% coverage). Outputs: `{area}/{folder}/{stem}.bbmodel`, `.geo.json`, `{folder}.png`, front/three_quarter/back/gameplay_scale viewport images, verification.json. Reference: ' + p['reference'] + ' (' + p['used'] + '). Vanilla: ' + ', '.join(v[2] for v in p['materials'].values()) + '. ' + '; '.join(p.get('limitations', [])) + '. 100% full face coverage, native pixels, 1 pixel/unit UVs, embedded texture and runtime geometry verified; native saved tab closed and verified.'
    if old in s:
        s = re.sub(r'Current: \*\*.*?\*\*', 'Current: **' + area.replace('_', ' ').title() + ' ' + nexttitle + ' — IN PROGRESS**', s, count=1)
        s = re.sub(r'Next: \*\*.*?\*\*', 'Next: **' + area.replace('_', ' ').title() + ' ' + nextnext + '**', s, count=1)
        s = s.replace(old, note)
    else:
        s = re.sub(rf'- \[x\] {re.escape(title)} — [^\n]+', note, s)
    t.write_text(s)
    print(title + ' completed with 100% full coverage and closed')
