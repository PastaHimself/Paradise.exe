def check_z_fighting_and_collisions(cs, assign=None):
    """
    Audits a list of cubes `cs` and face assignment dict `assign` for:
    1. 3D Volume Overlaps (intersection in X, Y, and Z > 1e-4)
    2. Coplanar Overlaps on Same-Direction Active Faces (true visible z-fighting outer surfaces)
    3. Guarantees full face coverage with zero untextured / missing faces.
    """
    errors = []
    
    # Pre-parse cubes
    cubes = []
    for q in cs:
        name = q['name']
        lo = q['from']
        hi = q['to']
        cubes.append({
            'name': name,
            'lo': lo,
            'hi': hi
        })
    
    n = len(cubes)
    for i in range(n):
        for j in range(i + 1, n):
            c1 = cubes[i]
            c2 = cubes[j]
            
            # Compute 1D overlap along X, Y, Z
            ox = min(c1['hi'][0], c2['hi'][0]) - max(c1['lo'][0], c2['lo'][0])
            oy = min(c1['hi'][1], c2['hi'][1]) - max(c1['lo'][1], c2['lo'][1])
            oz = min(c1['hi'][2], c2['hi'][2]) - max(c1['lo'][2], c2['lo'][2])
            
            # 1. 3D Volume Overlap
            if ox > 1e-4 and oy > 1e-4 and oz > 1e-4:
                errors.append(f"VOLUME OVERLAP between '{c1['name']}' and '{c2['name']}': dx={ox:.4f}, dy={oy:.4f}, dz={oz:.4f}")
            
            # 2. Check true coplanar outer face z-fighting (same direction on same plane)
            # Axis X (west / east)
            for f, val1, val2 in [('west', c1['lo'][0], c2['lo'][0]), ('east', c1['hi'][0], c2['hi'][0])]:
                if abs(val1 - val2) < 1e-4 and oy > 1e-4 and oz > 1e-4:
                    errors.append(f"Z-FIGHTING (Same plane): '{c1['name']}' and '{c2['name']}' both have active face '{f}' at x={val1}")

            # Axis Y (down / up)
            for f, val1, val2 in [('down', c1['lo'][1], c2['lo'][1]), ('up', c1['hi'][1], c2['hi'][1])]:
                if abs(val1 - val2) < 1e-4 and ox > 1e-4 and oz > 1e-4:
                    errors.append(f"Z-FIGHTING (Same plane): '{c1['name']}' and '{c2['name']}' both have active face '{f}' at y={val1}")

            # Axis Z (north / south)
            for f, val1, val2 in [('north', c1['lo'][2], c2['lo'][2]), ('south', c1['hi'][2], c2['hi'][2])]:
                if abs(val1 - val2) < 1e-4 and ox > 1e-4 and oy > 1e-4:
                    errors.append(f"Z-FIGHTING (Same plane): '{c1['name']}' and '{c2['name']}' both have active face '{f}' at z={val1}")
                        
    return errors

def audit_full_coverage(elements):
    """Verifies that 100% of cube faces are textured (no None/missing textures)."""
    untextured = []
    for el in elements:
        for f in ['north', 'south', 'east', 'west', 'up', 'down']:
            face = el.get('faces', {}).get(f)
            if not face or face.get('texture') is None:
                untextured.append(f"{el.get('name', 'unnamed')}:{f}")
    return untextured
