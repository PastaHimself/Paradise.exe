from pipeline import *
from checker import checker
cs=[];a={}
def c(n,lo,hi,m,off=[],rot=False):cs.append({'name':n,'from':lo,'to':hi});a[n]=(m,off,rot)
c('left_panel',[-9,0,-7],[-8,22,7],'wood',[],True)
c('right_panel',[8,0,-7],[9,22,7],'wood',[],True)
c('back_panel',[-8,0,6],[8,22,7],'wood',['east','west'],True)
c('work_surface',[-8,11,-7],[8,12,6],'top',['east','west','south'])
c('lower_book_shelf',[-8,6,2],[8,7,6],'shelf',['east','west','south'])
D=build('study_carrel',cs,a,{'wood':(0,0,'planks_spruce.png',32,32),'top':(32,0,'concrete_gray.png'),'shelf':(32,16,'planks_oak.png')},{'reference':'https://www.theclassroom.co/all-school-tables/advanced-panel-end-study-carrel.html','used':'panel-supported private study bay, high back and sides, recessed work surface','limitations':['square upper corners simplify rounded reference','one lower rear shelf added for library storage','static furniture']})
checker(D,[0,11,0],[28,26,-36]);views(D,[0,11,0],{'front':[0,21,-42],'three_quarter':[28,26,-36],'back':[-28,24,36],'gameplay_scale':[44,32,-64],'underside':[20,3,-25]});print('Study carrel ready')
