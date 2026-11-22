from mcp import *
from PIL import Image
D=ROOT/'paradise_exe_v2/library/card_reader_terminal';D.mkdir(exist_ok=True)
assert call('get_project_info',{})['project']['name']=='library_card_reader_terminal'
cs=[];mats={}
def c(n,a,b,m,off=[]):cs.append({'name':n,'from':a,'to':b});mats[n]=(m,off)
c('base',[-2,0,-3],[2,1,3],'black')
c('display_housing',[-2,1,1],[2,2.4,3],'gray',['down'])
c('display',[-1.6,2.4,1.35],[1.6,2.45,2.6],'blue',['down'])
for row in range(4):
 for col in range(3):
  x=-1.6+col*1.1;z=-2.55+row*.8
  c('key_%s_%s'%(row,col),[x,1,z],[x+.7,1.12,z+.5],('red' if col==0 else 'green' if col==2 else 'gray') if row==3 else 'gray',['down'])
for n,a,b in [('slot_lower',[-2,0,-3.2],[2,.3,-3]),('slot_upper',[-2,.7,-3.2],[2,1,-3]),('slot_left',[-2,.3,-3.2],[-1.4,.7,-3]),('slot_right',[1.4,.3,-3.2],[2,.7,-3])]:c(n,a,b,'gray',['south'])
regions={'black':(0,0,'concrete_black.png'),'gray':(16,0,'concrete_silver.png'),'blue':(0,16,'concrete_light_blue.png'),'red':(16,16,'concrete_red.png'),'green':(32,0,'concrete_lime.png')}
S=ROOT/'bedrock-samples-v1.26.70.23-preview-full/textures/blocks'
im=Image.new('RGBA',(64,64))
base=Image.open(S/'concrete_black.png').convert('RGBA')
for x in range(0,64,16):
 for y in range(0,64,16):im.paste(base,(x,y))
for x,y,f in regions.values():im.paste(Image.open(S/f).convert('RGBA'),(x,y))
im.save(D/'card_reader_terminal.png');dump(D/'build_elements.json',cs)
dump(D/'plan.json',{'reference':'https://ipon.hu/shop/termek/reiner-sct-cyberjack-rfid-komfort-usb/1716183','reference_image':'../../references/card_reader_terminal.webp','used':'compact desktop body, rectangular display, tactile keypad and card slot; simplified chunky silhouette','materials':regions,'limitations':['blank keys and display; no exact text under original vanilla pixel rules','static prop; no card reading, wiring or pack integration'],'dimensions':[4,2.45,6.2],'texel_density':'1 original pixel per model unit'})
call('place_cube',{'elements':cs,'faces':False})
call('create_texture',{'name':'card_reader_terminal','data':str(D/'card_reader_terminal.png')})
for q in cs:
 dx,dy,dz=[b-a for a,b in zip(q['from'],q['to'])];m,off=mats[q['name']];x,y,f=regions[m]
 faces={f:{'uv':[x/4,y/4,(x+w)/4,(y+h)/4],'texture':'card_reader_terminal'} for f,(w,h) in {'north':(dx,dy),'south':(dx,dy),'east':(dz,dy),'west':(dz,dy),'up':(dx,dz),'down':(dx,dz)}.items()}
 for f in off:faces[f]={'texture':None}
 call('set_cube_uv',{'id':q['name'],'box_uv':False,'faces':faces})
dump(D/'uv_audit.json',[call('get_cube_uv',{'id':q['name']}) for q in cs])
print('Built',len(cs),'cubes')
