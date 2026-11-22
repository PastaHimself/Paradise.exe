from pipeline import *
from checker import checker
cs=[];a={}
def c(n,lo,hi,m,off=[],rot=False):cs.append({'name':n,'from':lo,'to':hi});a[n]=(m,off,rot)
c('plinth',[-8,0,-4],[8,2,4],'wood')
c('crown',[-8,28,-4],[8,28,4],'wood')
c('left_side',[-8,2,-4],[-7,28,4],'wood',['down','up'],True)
c('right_side',[7,2,-4],[8,28,4],'wood',['down','up'],True)
c('back',[-7,2,3.5],[7,28,4],'wood',['down','up','east','west'],True)
c('left_door',[-7,2.125,-4],[-.0625,27.875,-3.5],'door',['south'],True)
c('right_door',[.0625,2.125,-4],[7,27.875,-3.5],'door',['south'],True)
c('left_pull',[-1.75,13,-4.5],[-1.4,16,-4],'metal',['south'])
c('right_pull',[1.4,13,-4.5],[1.75,16,-4],'metal',['south'])
c('lock_plate',[-.7,15.5,-4.1],[.7,17.5,-4],'metal',['south'])
c('keyhole_head',[-.2,16.6,-4.12],[.2,17,-4.1],'dark',['south'])
c('keyhole_stem',[-.1,16.1,-4.12],[.1,16.6,-4.1],'dark',['south','up'])
D=build('locked_document_cabinet',cs,a,{'wood':(0,0,'planks_big_oak.png',32,32),'door':(32,0,'planks_spruce.png',32,32),'metal':(0,32,'gold_block.png'),'dark':(16,32,'concrete_black.png')},{'reference':'https://auctionet.com/sv/4496247-arkivskap-mahogny-sundsvalls-enskilda-bank-tidigt-1900-tal','used':'tall two-door wood archive cabinet on a plinth with brass keyhole hardware','limitations':['static closed doors; lock shape only','no text or dynamic access']})
checker(D,[0,15,0],[30,28,-48]);views(D,[0,15,0],{'front':[0,22,-57],'three_quarter':[30,28,-48],'back':[-30,26,48],'gameplay_scale':[48,38,-80]});print('Locked cabinet ready')
