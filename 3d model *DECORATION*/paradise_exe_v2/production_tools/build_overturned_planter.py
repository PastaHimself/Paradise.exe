from pipeline import *
from checker import checker
import math,itertools
angle=math.atan(14);s=math.sin(angle);co=math.cos(angle);pivot=4*s/(1-co);degrees=math.degrees(angle)
cs=[];a={}
def c(n,lo,hi,m='body',off=[]):cs.append({'name':n,'from':lo,'to':hi,'origin':[0,pivot,0],'rotation':[0,0,degrees]});a[n]=(m,off,False)
h=.375
c('base_front',[-4,0,-4],[4,.5,-h])
c('base_back',[-4,0,h],[4,.5,4])
c('base_left',[-4,0,-h],[-h,.5,h],off=['north','south'])
c('base_right',[h,0,-h],[4,.5,h],off=['north','south'])
c('wall_left',[-4,.5,-4],[-3.5,7,4],off=['up','down'])
c('wall_right',[3.5,.5,-4],[4,7,4],off=['up','down'])
c('wall_front',[-3.5,.5,-4],[3.5,7,-3.5],off=['up','down','east','west'])
c('wall_back',[-3.5,.5,3.5],[3.5,7,4],off=['up','down','east','west'])
c('rim_front',[-4.5,7,-4.5],[4.5,8,-3.25],'rim')
c('rim_back',[-4.5,7,3.25],[4.5,8,4.5],'rim')
c('rim_left',[-4.5,7,-3.25],[-3.25,8,3.25],'rim',['north','south'])
c('rim_right',[3.25,7,-3.25],[4.5,8,3.25],'rim',['north','south'])
D=build('overturned_planter',cs,a,{'body':(0,0,'hardened_clay.png'),'rim':(16,0,'hardened_clay_stained_orange.png')},{'reference':'https://tienda.viveroyanez.com.mx/products/maceta-barro-natural-cuadro','used':'square clay planter proportions, deep open interior, broad rim and drainage hole','limitations':['square corners simplify rounded clay reference','hollow body and 0.75-unit square drainage hole; no contents','fixed 85.914 degree overturn rests on base edge and rim edge','native clay pixels unchanged; no custom damage or pack integration']},area='flat_flower')
points=[]
for q in cs:
 for x,y,z in itertools.product(*zip(q['from'],q['to'])):points.append([x*co-(y-pivot)*s,pivot+x*s+(y-pivot)*co,z])
lo=[min(v[i] for v in points) for i in range(3)];hi=[max(v[i] for v in points) for i in range(3)];assert abs(lo[1])<1e-8;dump(D/'transformed_bounds.json',{'min':lo,'max':hi,'floor_contacts':'base left edge and rim left/bottom edge','rotation_z':degrees})
checker(D,[0,4.5,0],[-18,13,-18]);views(D,[0,4.5,0],{'front':[-23,9,0],'three_quarter':[-18,13,-18],'back':[20,12,18],'gameplay_scale':[-34,25,-42],'underside':[20,6,0]});print('Overturned planter ready',flush=True)
