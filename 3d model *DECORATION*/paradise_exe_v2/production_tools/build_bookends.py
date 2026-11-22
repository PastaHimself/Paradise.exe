from pipeline import *
from checker import checker
cs=[{'name':'left_base','from':[-4,0,-1.5],'to':[-2,.125,1.5]},{'name':'left_upright','from':[-4,.125,-1.5],'to':[-3.875,3.5,1.5]},{'name':'right_base','from':[2,0,-1.5],'to':[4,.125,1.5]},{'name':'right_upright','from':[3.875,.125,-1.5],'to':[4,3.5,1.5]}];a={q['name']:('metal',['down'] if 'upright' in q['name'] else [],False) for q in cs}
D=build('bookends',cs,a,{'metal':(0,0,'concrete_silver.png')},{'reference':'https://www.zumstein.ch/de/produkt/buchstuetze-alco-metall-85x14cm-125mm-hoch-grau-1paar','used':'paired thin L-shaped grey metal bookends, flat foot under books and upright support','limitations':['square corners; no drilled fastener hole','two mirrored static bookends in one reusable prop']})
checker(D,[0,1.75,0],[12,9,-15]);views(D,[0,1.75,0],{'front':[0,7,-17],'three_quarter':[12,9,-15],'back':[-12,8,15],'gameplay_scale':[25,18,-32]});print('Bookends ready')
