from mcp import *
from PIL import Image
import hashlib
S=ROOT/'paradise_exe_v2/yellow_halls/exit_sign_normal';D=ROOT/'paradise_exe_v2/library/exit_texture';D.mkdir(exist_ok=True)
assert (S/'verification.json').exists()
p=json.loads((S/'plan.json').read_text());im=Image.open(S/'exit_sign_normal.png').convert('RGBA')
for x,y,w,h,f in p['materials']:
 tile=Image.open(ROOT/'bedrock-samples-v1.26.70.23-preview-full/textures/blocks'/f).convert('RGBA')
 for xx in range(x,x+w,16):
  for yy in range(y,y+h,16):assert im.crop((xx,yy,xx+16,yy+16)).tobytes()==tile.tobytes()
outputs={}
for src,dst in [('exit_sign_normal.png','library_exit.png'),('front.png','preview.png'),('three_quarter.png','three_quarter.png')]:
 raw=(S/src).read_bytes();(D/dst).write_bytes(raw);assert (D/dst).read_bytes()==raw;outputs[dst]=hashlib.sha256(raw).hexdigest()
dump(D/'reuse_manifest.json',{'shared_source':'../../yellow_halls/exit_sign_normal/yellow_halls_exit_sign_normal.bbmodel','shared_geometry':'../../yellow_halls/exit_sign_normal/yellow_halls_exit_sign_normal.geo.json','reference':p['reference'],'materials':p['materials'],'outputs_sha256':outputs,'method':'Byte-identical reuse of verified EXIT atlas and actual Blockbench viewport previews; same geometry and UV mapping','project_tab':'No preview project needed; completed shared source remains closed'})
t=ROOT/'paradise_exe_v2/TODO.md';s=t.read_text().replace('- [ ] Library EXIT texture; references / paths: pending.','- [x] Library EXIT texture — `library/exit_texture/library_exit.png`, `preview.png`, `three_quarter.png`, `reuse_manifest.json`. Byte-identical atlas and actual Blockbench previews from completed shared `yellow_halls/exit_sign_normal/`; use its editable `.bbmodel` and `.geo.json`. Original concrete_green.png, quartz_block_side.png, iron_block.png, concrete_gray.png pixels reverified. Reference: https://www.combicraft.nl/aluminium-deurbordje-archive.html (shared flat plaque). No new project tab required; shared project stays closed.').replace('Current: **Library Library EXIT texture — IN PROGRESS**','Current: **Flat Flower field ground — IN PROGRESS**').replace('Next: **Library field ground**','Next: **Flat Flower dense flower cluster**');t.write_text(s);print('Library EXIT reuse verified')
