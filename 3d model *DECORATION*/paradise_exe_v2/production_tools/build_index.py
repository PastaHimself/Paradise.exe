from pipeline import *
cs=[];assign={}
def c(n,a,b,m,off=[],rot=False):cs.append({'name':n,'from':a,'to':b});assign[n]=(m,off,rot)
for x in [-7,5.5]:
 for z in [-3.5,2]:c('leg_'+str(x)+'_'+str(z),[x,0,z],[x+1.5,3,z+1.5],'wood',['up'],True)
c('base',[-8,3,-4],[8,4,4],'wood')
c('top',[-8,15,-4],[8,16,4],'wood')
c('left',[-8,4,-4],[-7,15,4],'wood',['up','down'],True)
c('right',[7,4,-4],[8,15,4],'wood',['up','down'],True)
c('back',[-7,4,3.5],[7,15,4],'wood',['up','down','west','east'],True)
for row in range(4):
 for col in range(3):
  x=-7+col*(14/3);y=4+row*2.75;n=f'{row}_{col}'
  c('drawer_'+n,[x+.0625,y+.0625,-4],[x+14/3-.0625,y+2.6875,-3.5],'front',['south'])
  mid=x+7/3
  c('label_'+n,[mid-1,y+1.4,-4.05],[mid+1,y+2.2,-4],'paper',['south'])
  c('pull_'+n,[mid-.5,y+.65,-4.4],[mid+.5,y+.95,-4],'metal',['south'])
D=build('index_card_drawer_cabinet',cs,assign,{'wood':(0,0,'planks_spruce.png'),'front':(16,0,'planks_oak.png'),'paper':(0,16,'quartz_block_side.png'),'metal':(16,16,'gold_block.png')},{'reference':'https://www.chairish.com/product/31771803/mid-20th-century-globe-wernicke-30-drawer-index-card-library-file-catalog-cabinet-47','used':'wood cabinet frame, grid of shallow drawers, separate labels and pulls, four legs','limitations':['compact 3 by 4 drawer layout','blank labels; no lettering pixels available','static closed drawers']})
views(D,[0,8,0],{'front':[0,18,-35],'three_quarter':[26,22,-32],'back':[-25,20,32],'gameplay_scale':[38,30,-58]})
print('Index ready for inspection')
