from pipeline import *
from checker import checker
from glyphs import lettering
import sys
word,folder,width=sys.argv[1],sys.argv[2],float(sys.argv[3]);cs=[{'name':'backing','from':[-width/2,0,7.75],'to':[width/2,6,8]}];a={'backing':('backing',[],False)}
lettering(cs,a,word,.5,1.75,7.75)
D=build(folder,cs,a,{'backing':(0,0,'concrete_black.png',32,16),'ink':(32,0,'quartz_block_side.png',32,16)},{'reference':'https://www.combicraft.nl/aluminium-deurbordje-archive.html','used':'shared actual flat wall plaque reference; thin rectangular backing and flush wall mount','limitations':[word+' lettering is shallow front-face cuboid geometry using native quartz pixels','no custom printed pixels or runtime bindings']})
checker(D,[0,3,8],[30,18,-38]);views(D,[0,3,8],{'front':[0,10,-43],'three_quarter':[30,18,-38],'back':[-30,16,50],'gameplay_scale':[48,24,-65]});print(word+' sign ready')
