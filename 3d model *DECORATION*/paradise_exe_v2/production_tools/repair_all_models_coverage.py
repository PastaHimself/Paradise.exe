#!/usr/bin/env python3
import os
import sys
import json
from pathlib import Path

# Add production tools to path
sys.path.insert(0, '/home/pasta/Downloads/blockbench/paradise_exe_v2/production_tools')
from pipeline import ROOT
from audit_geometry import audit_full_coverage
import subprocess

def call_bb(code):
    cmd = ['mcptoon', 'call', 'blockbench', 'risky_eval', '--stdin', '--destructive', '--json']
    p = subprocess.run(cmd, input=json.dumps({'code': code}), text=True, capture_output=True)
    if p.returncode != 0:
        raise RuntimeError(f"mcptoon failed: {p.stderr}")
    try:
        res = json.loads(p.stdout)
        if isinstance(res, dict) and (res.get('error') or res.get('isError')):
            raise RuntimeError(f"risky_eval error: {res}")
        return res
    except json.JSONDecodeError:
        raise RuntimeError(f"Failed to parse json: {p.stdout}\nstderr: {p.stderr}")

def get_models_with_missing_textures(base_dir):
    candidates = []
    for root, dirs, files in os.walk(base_dir):
        for f in files:
            if f.endswith('.bbmodel'):
                p = os.path.join(root, f)
                try:
                    with open(p, 'r') as fp:
                        data = json.load(fp)
                except Exception as e:
                    print(f"Error reading {p}: {e}")
                    continue
                uncovered = audit_full_coverage(data.get('elements', []))
                if len(uncovered) > 0:
                    candidates.append((p, len(uncovered), len(data.get('elements', [])) * 6))
    return candidates

def repair_batch(model_paths):
    js_code = """
(() => {
    let fs = require('fs');
    let paths = """ + json.dumps(model_paths) + """;
    let results = [];
    
    for (let bb_path of paths) {
        let geo_path = bb_path.replace('.bbmodel', '.geo.json');
        
        try {
            if (typeof Project !== 'undefined' && Project) {
                Project.close(true);
            }
            
            let content = fs.readFileSync(bb_path, 'utf8');
            let data = JSON.parse(content);
            Codecs.project.load(data, {path: bb_path});
            
            let repaired = 0;
            for (let el of Outliner.elements) {
                if (el instanceof Cube) {
                    let dx = el.to[0] - el.from[0];
                    let dy = el.to[1] - el.from[1];
                    let dz = el.to[2] - el.from[2];
                    let spans = {
                        north: [dx, dy],
                        south: [dx, dy],
                        east:  [dz, dy],
                        west:  [dz, dy],
                        up:    [dx, dz],
                        down:  [dx, dz]
                    };
                    
                    let target_tex = null;
                    let mat_u = 0;
                    let mat_v = 0;
                    let rot = 0;
                    
                    for (let f of ['north', 'south', 'east', 'west', 'up', 'down']) {
                        let face = el.faces[f];
                        if (face && face.texture !== null && face.texture !== false) {
                            target_tex = face.texture;
                            rot = face.rotation || 0;
                            let umin = Math.min(face.uv[0], face.uv[2]);
                            let vmin = Math.min(face.uv[1], face.uv[3]);
                            mat_u = Math.floor(umin * 4) / 4;
                            mat_v = Math.floor(vmin * 4) / 4;
                            break;
                        }
                    }
                    if (target_tex === null) {
                        target_tex = Project.textures.length > 0 ? Project.textures[0] : null;
                    }
                    
                    for (let f of ['north', 'south', 'east', 'west', 'up', 'down']) {
                        let face = el.faces[f];
                        if (!face || face.texture === null || face.texture === false) {
                            let [w, h] = spans[f];
                            let r = (f === 'up' || f === 'down') ? 0 : rot;
                            if (r === 90 || r === 270) {
                                let tmp = w; w = h; h = tmp;
                            }
                            let u0 = mat_u;
                            let v0 = mat_v;
                            let u1 = mat_u + (w / 4);
                            let v1 = mat_v + (h / 4);
                            
                            face.texture = target_tex;
                            face.uv = [u0, v0, u1, v1];
                            face.rotation = r;
                            repaired++;
                        }
                    }
                }
            }
            
            Codecs.project.write(Codecs.project.compile(), bb_path);
            if (fs.existsSync(geo_path)) {
                Codecs.bedrock.write(Codecs.bedrock.compile(), geo_path);
            }
            Project.close(true);
            results.push({path: bb_path, repaired: repaired, success: true});
        } catch (err) {
            results.push({path: bb_path, error: err.toString(), success: false});
        }
    }
    return results;
})()
"""
    return call_bb(js_code)

def main():
    base_dir = '/home/pasta/Downloads/blockbench/paradise_exe_v2'
    models = get_models_with_missing_textures(base_dir)
    print(f"Found {len(models)} models with missing/uncovered texture faces.")
    
    batch_size = 15
    repaired_total = 0
    errors = []
    
    for i in range(0, len(models), batch_size):
        batch = models[i:i + batch_size]
        paths = [m[0] for m in batch]
        print(f"\nProcessing batch {i // batch_size + 1} / {(len(models) + batch_size - 1) // batch_size} ({len(batch)} models)...")
        results = repair_batch(paths)
        
        for res in results:
            p = res.get('path')
            rel = os.path.relpath(p, base_dir)
            if res.get('success'):
                # Audit to verify
                with open(p) as fp:
                    d = json.load(fp)
                uncovered = audit_full_coverage(d.get('elements', []))
                if len(uncovered) == 0:
                    print(f"  ✓ {rel}: fixed {res.get('repaired')} faces -> 100% full coverage verified!")
                    repaired_total += 1
                else:
                    print(f"  ✗ {rel}: {len(uncovered)} faces still untextured after repair!")
                    errors.append((rel, uncovered))
            else:
                print(f"  ✗ {rel}: error: {res.get('error')}")
                errors.append((rel, res.get('error')))

    print(f"\n==========================================")
    print(f"REPAIR SUMMARY:")
    print(f"Successfully repaired and verified: {repaired_total} / {len(models)}")
    if errors:
        print(f"Errors ({len(errors)}):")
        for e in errors:
            print(f"  {e[0]}: {e[1]}")
    else:
        print("ALL models now have 100% full texture coverage! Zero missing textures in entire repository!")

if __name__ == '__main__':
    main()
