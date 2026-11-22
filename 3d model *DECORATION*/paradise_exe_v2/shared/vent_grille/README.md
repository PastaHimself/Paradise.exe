# Shared wall vent grille
16×12×1.75 units; five louvers at 22.5° inside four frame bars, with recessed dark duct backing.
10 cubes; 60 active quads / 120 triangles. Static; one opaque atlas per material variant.
32×32 original-pixel atlases: iron_block (Yellow Halls/Staircase), netherite_block (Library), exposed_copper (Highway), concrete_black backing in all states.
No painting, recolor, generated texture, alpha holes or PBR dependency. Slat spacing/depth is geometry.
Each copied 16×16 tile compared against local source RGBA pixels; external and embedded PNG bytes match.
All active faces 1 px/unit, including rotated louvers (rigid rotation preserves edge lengths).
Native MCP three material views, front, back and gameplay_scale screenshots inspected.
Editable vent_grille.bbmodel; Bedrock vent_grille.geo.json. Original local texture paths in plan.json.
Native geometry.unknown naming, block bindings and in-game lighting/placement validation remain for later integration.
References: https://www.ebay.de/itm/334689976069 and https://rsvr.nu/blog/vagledning-om-ventilation
