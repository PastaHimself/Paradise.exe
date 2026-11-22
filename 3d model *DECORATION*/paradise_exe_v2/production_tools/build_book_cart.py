from pipeline import *
from checker import checker
cs=[];a={}
def c(n,lo,hi,m,off=[]):cs.append({'name':n,'from':lo,'to':hi});a[n]=(m,off,False)
for x in [-6.5,6.5]:
 for z in [-3,3]:
  n=f'{x}_{z}'
  c('post_'+n,[x-.5,3,z-.5],[x+.5,17,z+.5],'blue',['up'])
  c('caster_stem_'+n,[x-.25,2,z-.25],[x+.25,3,z+.25],'metal',['up','down'])
  c('wheel_middle_'+n,[x-.375,.5,z-1],[x+.375,1.5,z+1],'rubber')
  c('wheel_top_'+n,[x-.375,1.5,z-.5],[x+.375,2,z+.5],'rubber',['down'])
  c('wheel_bottom_'+n,[x-.375,0,z-.5],[x+.375,.5,z+.5],'rubber',['up'])
 c('handle_'+str(x),[x-.5,17,-3.5],[x+.5,18,3.5],'blue')
for y in [3,9,15]:c('shelf_'+str(y),[-6,y,-3.5],[6,y+.5,3.5],'blue')
D=build('rolling_book_cart',cs,a,{'blue':(0,0,'concrete_blue.png',32,32),'metal':(32,0,'iron_block.png'),'rubber':(32,16,'concrete_black.png')},{'reference':'https://www.bibliorpl.com/en/metal-booktrucks/2039-demco-library-quiet-booktruck-with-3-flat-shelves.html','used':'three flat shelves, end handles, open access and four swivel-caster silhouettes','limitations':['static empty cart','stepped cuboid wheels approximate round casters','no wheel animation or transport behavior']})
checker(D,[0,9,0],[25,23,-32]);views(D,[0,9,0],{'front':[0,17,-34],'three_quarter':[25,23,-32],'back':[-25,20,32],'gameplay_scale':[40,30,-56],'underside':[23,-7,-28]});print('Book cart ready')
