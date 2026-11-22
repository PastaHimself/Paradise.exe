from pipeline import *
from checker import checker
cs=[];a={}
def c(n,lo,hi,m,off=[]):cs.append({'name':n,'from':lo,'to':hi});a[n]=(m,off,False)
c('front_timber',[-8,0,-8],[8,2.5,-7],'wood')
c('back_timber',[-8,0,7],[8,2.5,8],'wood')
c('left_timber',[-8,0,-7],[-7,2.5,7],'wood',['north','south'])
c('right_timber',[7,0,-7],[8,2.5,7],'wood',['north','south'])
c('empty_soil',[-7,0,-7],[7,1.25,7],'soil',['north','south','east','west'])
D=build('empty_flowerbed',cs,a,{'wood':(0,0,'planks_spruce.png'),'soil':(16,0,'dirt.png')},{'reference':'https://muddyfaces.co.uk/shop/products/low-wooden-planter-120cm-long','used':'low square timber frame filled below rim with bare soil, no plants','limitations':['16x16 footprint; 2.5-unit frame height','square butt joints simplify rounded timber ends','unchanged vanilla dirt and spruce pixels; no planting behavior or pack integration']},area='flat_flower')
for name in ['left_timber','right_timber']:call('set_cube_uv',{'id':name,'faces':{f:{'uv':[0,0,3.5,.25],'rotation':90,'texture':'empty_flowerbed'} for f in ['up','down']}})
dump(D/'uv_audit.json',[call('get_cube_uv',{'id':q['name']}) for q in cs])
checker(D,[0,1,0],[23,23,-29]);views(D,[0,1,0],{'front':[0,20,-31],'three_quarter':[23,23,-29],'back':[-23,20,29],'gameplay_scale':[38,33,-51],'top':[0,40,-1]});print('Empty flowerbed ready',flush=True)
