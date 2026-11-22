# Yellow Halls recessed fluorescent fixture
One static Bedrock Block model; 9 cubes, 44 active quads / 88 triangles.
Bounds: x -6..6, y 13..16, z -14..14. Ceiling mounting plane y=16.
Editable: yellow_halls_fluorescent_fixture.bbmodel (lit active, three texture variants included).
Runtime: yellow_halls_fluorescent_fixture.geo.json (same geometry/UVs for all three states).
Textures: fluorescent_lit.png, fluorescent_dim.png, fluorescent_burned_out.png, each 64×64.
One opaque atlas active per state. Every active face maps 1 image pixel per model unit.
Atlas copies whole original 16×16 tiles, including static sea-lantern frame 0, at original resolution with no painting, tint, blur or scaling. Provenance: vanilla_texture_manifest.json, © Mojang AB.
Materials: iron_block casing and socket bars; concrete_gray recessed pan.
Tube states: sea_lantern frame 0 (lit), quartz_block_side (dim), concrete_silver (burned out).
These are closest vanilla substitutes; ordinary editor shading is used. No runtime emission, block-state binding or in-game lighting was configured.
Native codec identifier geometry.unknown must be uniquely named at later pack integration; texture dimensions 16×16 are logical UV dimensions for 64×64 images.
State screenshots: *_three_quarter.png and *_gameplay.png. Underside and mounting_back.png complete inspection.
Gameplay views: camera about 4.2 blocks from fixture, 60° perspective FOV, 800×600.
Missing-tube geometry is a separate future asset. No new animation, gameplay or pack integration.
References: Lithonia PT3L troffer (https://www.homedepot.com/p/205527697), two-lamp recessed fixture (https://www.raptorsupplies.com/pd/lithonia-lighting/2pmo-g-b-3-32-27ls-mvolt-1-3-geb10is-lpg). Downloaded images retained in ../../references/fluorescent.
