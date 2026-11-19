/** Batch 05 — 20 independently reviewable neighbourhood props; no CCTV/security assets. */
import * as THREE from 'three';
export const ASSETS=[{"id":"laundretteWasher","label":"Laundrette washing machine","gameId":"laundretteWasher"},{"id":"laundretteDryer","label":"Laundrette tumble dryer","gameId":"laundretteDryer"},{"id":"bakeryDisplay","label":"Bakery bread display","gameId":"bakeryDisplay"},{"id":"takeawayCounter","label":"Takeaway serving counter","gameId":"takeawayCounter"},{"id":"pubDartboard","label":"Pub dartboard cabinet","gameId":"pubDartboard"},{"id":"bikeRack","label":"Sheffield bicycle stand","gameId":"bikeRack"},{"id":"arcadeCabinet","label":"Arcade video game cabinet","gameId":"arcadeCabinet"},{"id":"dumpster","label":"Commercial trade waste bin","gameId":"dumpster"},{"id":"pallet","label":"Timber shipping pallet","gameId":"pallet"},{"id":"trafficLight","label":"UK traffic light assembly","gameId":"trafficLight"},{"id":"vendingMachine","label":"Snack vending machine","gameId":"vendingMachine"},{"id":"parkingMeter","label":"Pay-and-display parking machine","gameId":"parkingMeter"},{"id":"cashMachine","label":"High-street cashpoint kiosk","gameId":"cashMachine"},{"id":"noticeBoard","label":"Community notice board","gameId":"noticeBoard"},{"id":"gardenShed","label":"Timber garden shed","gameId":"gardenShed"},{"id":"cafeMenuStand","label":"Pavement cafe menu stand","gameId":"cafeMenuStand"},{"id":"newspaperStand","label":"Newsagent newspaper rack","gameId":"newspaperStand"},{"id":"shoppingBasket","label":"Supermarket hand basket","gameId":"shoppingBasket"},{"id":"deliveryTrolley","label":"Warehouse sack truck","gameId":"deliveryTrolley"},{"id":"marketStall","label":"Market stall canopy","gameId":"marketStall"}] as const;
export type AssetId=typeof ASSETS[number]['id'];
export function createAsset(id:AssetId):THREE.Group{
const T=THREE,g=new T.Group();g.name='SFUK_B05_'+id;
const m=(c:number,metal=0)=>new T.MeshStandardMaterial({color:c,metalness:metal,roughness:metal?.42:.77,side:T.DoubleSide});
const steel=m(0x687b82,.72),dark=m(0x26313a,.38),red=m(0xb92725,.24),cream=m(0xe6ded0),glass=m(0x8fb3bd,.18),wood=m(0x98734d),green=m(0x286e51),yellow=m(0xe8b532),black=m(0x171e22),grey=m(0x90989b,.35);
const B=(w:number,h:number,d:number,x:number,y:number,z:number,mat:T.Material)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),mat);o.position.set(x,y,z);g.add(o);return o};
const C=(r:number,h:number,x:number,y:number,z:number,mat:T.Material,n=24)=>{const o=new T.Mesh(new T.CylinderGeometry(r,r,h,n),mat);o.position.set(x,y,z);g.add(o);return o};
const R=(a:number[],b:number[],r:number,mat:T.Material)=>{const p=new T.Vector3(...a),q=new T.Vector3(...b),v=q.clone().sub(p);const o=new T.Mesh(new T.CylinderGeometry(r,r,v.length(),10),mat);o.position.copy(p.add(q).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());g.add(o);return o};
if(id==='laundretteWasher'){B(.65,.82,.65,0,.44,0,cream);const d=C(.23,.025,0,.44,.34,glass);d.rotation.x=Math.PI/2;B(.56,.13,.035,0,.79,.35,dark);}
if(id==='laundretteDryer'){B(.67,1.35,.67,0,.70,0,cream);for(const y of [.40,1.00]){const d=C(.23,.025,0,y,.35,glass);d.rotation.x=Math.PI/2;}B(.54,.08,.02,0,1.32,.35,dark);}
if(id==='bakeryDisplay'){B(1.25,.12,.53,0,.73,0,wood);for(const x of [-.52,.52])B(.055,1.3,.055,x,.68,0,wood);for(const y of [.42,.85,1.22]){B(1.17,.045,.50,0,y,0,wood);for(let i=0;i<5;i++){const loaf=new T.Mesh(new T.SphereGeometry(.09,12,8),yellow);loaf.position.set(-.44+i*.22,y+.10,0);g.add(loaf);}}}
if(id==='takeawayCounter'){B(1.75,.95,.68,0,.48,0,dark);B(1.90,.09,.78,0,1,0,grey);B(1.50,.45,.025,0,.60,.36,red);B(.48,.35,.35,.42,1.23,-.12,steel);}
if(id==='pubDartboard'){B(.65,.78,.09,0,1.45,0,wood);const face=C(.27,.022,0,1.45,.065,black,40);face.rotation.x=Math.PI/2;for(let i=0;i<3;i++){const ring=new T.Mesh(new T.TorusGeometry(.08+i*.075,.009,6,48),i===1?red:green);ring.position.set(0,1.45,.085);g.add(ring);}}
if(id==='bikeRack'){R([-.35,.02,0],[-.35,.78,0],.025,steel);R([.35,.02,0],[.35,.78,0],.025,steel);R([-.35,.78,0],[.35,.78,0],.025,steel);for(const x of [-.35,.35])C(.095,.025,x,.015,0,grey);}
if(id==='arcadeCabinet'){B(.68,1.35,.65,0,.72,0,dark);B(.68,.36,.65,0,1.55,-.03,red);B(.54,.48,.025,0,1.12,.34,glass);B(.57,.20,.31,0,.76,.33,steel);for(const x of [-.15,.15])C(.035,.06,x,.87,.43,yellow);}
if(id==='dumpster'){B(1.48,1.02,.89,0,.65,0,green);B(1.56,.075,.96,0,1.19,0,dark);for(const x of [-.57,.57])for(const z of [-.34,.34])C(.09,.06,x,.11,z,black);for(const x of [-.43,.43])B(.10,.10,.98,x,.70,0,steel);}
if(id==='pallet'){
 // EXACT single-pallet construction extracted from approved Batch 03 palletStack.
 const plank=[m(0x8b7359),m(0x76614b),m(0x9a8060),m(0x695441)],woodDark=m(0x574431);
 const base=0,ox=0,oz=0,k=0;
 for(let j=0;j<5;j++) B(.18,.024,.79,ox-.40+j*.20,base+.132,oz,plank[(j+k)%4]);
 for(const x of [-.39,0,.39])for(const z of [-.30,.30])B(.16,.088,.17,ox+x,base+.072,oz+z,woodDark);
 for(const x of [-.39,0,.39])B(.16,.023,.79,ox+x,base+.018,oz,plank[(k+1)%4]);
 for(const z of [-.32,.32])B(1.0,.025,.12,ox,base+.114,oz+z,woodDark);
}
if(id==='trafficLight'){C(.07,.11,0,.055,0,grey);C(.043,2.45,0,1.24,0,steel);B(.33,.96,.26,0,2.18,.10,black);for(let i=0;i<3;i++){const lens=C(.115,.023,0,2.47-i*.29,.244,[red,yellow,green][i],32);lens.rotation.x=Math.PI/2;}B(.36,.065,.33,0,2.69,.10,dark);}
if(id==='vendingMachine'){B(.87,1.72,.72,0,.88,0,dark);B(.58,1.19,.025,-.11,1.06,.37,glass);for(let i=0;i<4;i++)for(let j=0;j<3;j++)B(.11,.14,.07,-.32+j*.20,.65+i*.26,.39,[red,green,yellow][j]);B(.12,.38,.025,.34,1.10,.38,grey);B(.55,.16,.06,0,.28,.39,black);}
if(id==='parkingMeter'){B(.29,.13,.27,0,.07,0,dark);B(.16,1.27,.16,0,.75,0,steel);B(.43,.68,.30,0,1.67,0,dark);B(.31,.24,.012,0,1.81,.157,glass);B(.13,.025,.014,0,1.53,.16,cream);B(.10,.10,.014,0,1.35,.16,yellow);}
if(id==='cashMachine'){B(.86,1.85,.55,0,.93,0,grey);B(.68,.72,.025,0,1.35,.29,dark);B(.50,.29,.026,0,1.53,.31,glass);B(.30,.025,.025,0,1.12,.32,black);B(.36,.23,.03,0,.82,.30,steel);}
if(id==='noticeBoard'){for(const x of [-.69,.69])B(.075,1.95,.075,x,1.01,0,wood);B(1.45,.96,.09,0,1.39,0,wood);B(1.30,.79,.012,0,1.39,.054,cream);for(let i=0;i<5;i++)B(.19,.29,.013,-.48+i*.24,1.37,.066,[green,yellow,red,glass,grey][i]);B(1.58,.12,.28,0,1.95,0,dark);}
if(id==='gardenShed'){B(1.72,1.72,1.34,0,.88,0,wood);for(let x=-.72;x<=.75;x+=.24)B(.025,1.65,.02,x,.88,.68,dark);B(.64,1.37,.045,0,.72,.70,dark);B(.28,.028,.03,.20,.73,.74,steel);const roof=B(1.92,.10,1.56,0,1.80,0,grey);roof.rotation.z=.10;}
if(id==='cafeMenuStand'){for(const x of [-.34,.34])R([x,0,0],[x,1.18,0],.027,wood);B(.86,1.00,.065,0,1.36,0,wood);B(.75,.88,.013,0,1.36,.04,black);for(let i=0;i<5;i++)B(.56,.013,.015,0,1.64-i*.14,.052,cream);}
if(id==='newspaperStand'){for(const x of [-.55,.55])R([x,0,0],[x,1.52,0],.025,steel);for(let y=.4;y<=1.45;y+=.31){B(1.18,.055,.39,0,y,0,steel);for(let j=0;j<5;j++)B(.18,.22,.015,-.43+j*.21,y+.13,.15,[cream,red,green,yellow,glass][j]);}}
if(id==='shoppingBasket'){B(.55,.04,.35,0,.08,0,red);for(const z of [-.19,.19])B(.59,.31,.025,0,.25,z,red);for(const x of [-.29,.29])B(.025,.31,.39,x,.25,0,red);for(let x=-.20;x<=.21;x+=.10)for(const z of [-.204,.204])B(.045,.11,.009,x,.26,z,dark);R([-.22,.43,0],[0,.76,0],.019,black);R([0,.76,0],[.22,.43,0],.019,black);}
if(id==='deliveryTrolley'){B(.52,.045,.36,0,.12,.16,steel);for(const x of [-.23,.23]){R([x,.12,.14],[x,1.27,-.22],.025,steel);const w=C(.105,.045,x,.12,-.22,black);w.rotation.z=Math.PI/2;}R([-.23,1.27,-.22],[.23,1.27,-.22],.026,steel);B(.38,.52,.30,0,.43,.10,wood);}
if(id==='marketStall'){for(const x of [-.91,.91])for(const z of [-.50,.50])R([x,0,z],[x,2.15,z],.026,steel);B(2.0,.09,1.13,0,2.18,0,red);for(let i=0;i<7;i++)B(.27,.012,1.14,-.83+i*.277,2.236,0,i%2?cream:red);B(1.82,.09,.80,0,.96,0,wood);for(const x of [-.74,.74])B(.06,.88,.06,x,.49,0,steel);}

/** Batch 05 detail pass: recognisable UK materials, practical construction and scale. */
const rubber=m(0x202326),silver=m(0xb7bfc0,.65),ivory=m(0xf2ede1),brick=m(0x956d59),blue=m(0x2e536b),rust=m(0x785443,.3);
const tor=(major:number,tube:number,x:number,y:number,z:number,material:T.Material,rx=0)=>{const o=new T.Mesh(new T.TorusGeometry(major,tube,10,48),material);o.position.set(x,y,z);o.rotation.x=rx;g.add(o);return o};
const sphere=(radius:number,x:number,y:number,z:number,material:T.Material)=>{const o=new T.Mesh(new T.SphereGeometry(radius,16,12),material);o.position.set(x,y,z);g.add(o);return o};
const wheel=(x:number,y:number,z:number,r=.10)=>{const w=C(r,.055,x,y,z,rubber,28);w.rotation.z=Math.PI/2;const hub=C(r*.33,.058,x,y,z,silver,20);hub.rotation.z=Math.PI/2;};
if(id==='laundretteWasher'||id==='laundretteDryer'){
 const ys=id==='laundretteWasher'?[.44]:[.40,1.00];
 for(const y of ys){tor(.226,.023,0,y,.363,silver);tor(.17,.010,0,y,.375,rubber);const drum=C(.152,.012,0,y,.380,dark,48);drum.rotation.x=Math.PI/2;for(let i=0;i<12;i++){const a=i*Math.PI/6;const dot=C(.009,.009,Math.cos(a)*.105,y+Math.sin(a)*.105,.39,grey,10);dot.rotation.x=Math.PI/2;}}
 for(const x of [-.20,.14,.25]){const knob=C(x===-.20?.034:.019,.014,x,id==='laundretteWasher'?.79:1.32,.373,x===-.20?silver:green,24);knob.rotation.x=Math.PI/2;}
 B(.16,.043,.015,.04,id==='laundretteWasher'?.79:1.32,.372,black);
 for(const x of [-.30,.30])B(.035,.065,.035,x,.03,0,rubber);
}
if(id==='bakeryDisplay'){
 for(const z of [-.26,.26])B(1.30,.035,.032,0,1.39,z,wood);
 for(const y of [.42,.85,1.22])for(let j=0;j<5;j++){const loaf=B(.155,.095,.23,-.44+j*.22,y+.095,0,m(0xb17b3f));loaf.rotation.z=(j%3-1)*.055;for(let k=0;k<2;k++)B(.008,.007,.18,-.47+j*.22+k*.045,y+.146,.01,cream);}
 B(1.27,.018,.58,0,.03,0,wood);
}
if(id==='takeawayCounter'){
 for(const x of [-.70,.70])B(.065,.72,.04,x,.50,.375,steel);
 B(1.58,.08,.045,0,.83,.375,steel);
 B(.47,.22,.24,.42,1.38,-.13,black);
 B(.32,.05,.18,.42,1.58,-.13,cream);
 B(.36,.045,.22,-.42,1.065,-.08,red);
 for(let i=0;i<3;i++)B(.09,.07,.08,-.50+i*.12,1.12,-.10,cream);
}
if(id==='pubDartboard'){
 for(const x of [-.33,.33])B(.025,.76,.12,x,1.45,.055,wood);
 tor(.26,.013,0,1.45,.09,ivory);
 for(let i=0;i<20;i++){const a=i*Math.PI/10;R([0,1.45,.09],[Math.sin(a)*.258,1.45+Math.cos(a)*.258,.09],.003,silver);}
 sphere(.024,0,1.45,.107,red);
 B(.17,.05,.04,0,1.08,.09,black);
}
if(id==='bikeRack'){
 // Standard Sheffield hoop: uprights, crossbar and curved top corners.
 for(const x of [-.35,.35])tor(.055,.024,x,.76,0,steel);
 for(const x of [-.35,.35])B(.16,.018,.16,x,.014,0,grey);
}
if(id==='arcadeCabinet'){
 B(.59,.025,.035,0,1.46,.35,yellow);
 B(.55,.035,.03,0,.96,.36,black);
 for(const x of [-.22,-.07,.08,.23]){const b=C(.024,.018,x,.82,.46,x>0?red:green,16);b.rotation.x=Math.PI/2;}
 R([-.15,.78,.45],[-.15,.95,.45],.014,black);
 sphere(.045,-.15,.95,.45,red);
 B(.44,.12,.015,0,.30,.333,grey);
 B(.50,.10,.03,0,1.63,.34,cream);
}
if(id==='dumpster'){
 for(const x of [-.64,.64])B(.045,.90,.03,x,.65,.463,steel);
 for(let i=0;i<4;i++)B(.035,.75,.026,-.45+i*.30,.62,.468,green);
 B(.80,.07,.12,0,1.19,-.48,black);
 for(const x of [-.57,.57])for(const z of [-.34,.34])wheel(x,.115,z,.075);
 B(.16,.13,.045,0,.81,.468,ivory);
}
if(id==='trafficLight'){
 for(let i=0;i<3;i++){const y=2.47-i*.29;tor(.119,.013,0,y,.26,black);B(.27,.045,.13,0,y+.145,.245,black);}
 B(.24,.15,.20,0,1.66,.10,grey);
 B(.13,.07,.07,0,.22,0,steel);
}
if(id==='vendingMachine'){
 for(let i=0;i<4;i++)B(.55,.022,.10,-.10,.55+i*.27,.425,steel);
 for(let i=0;i<4;i++)for(let j=0;j<3;j++){B(.075,.018,.012,-.32+j*.20,.58+i*.26,.44,ivory);}
 B(.13,.06,.03,.34,1.40,.397,blue);
 B(.14,.025,.025,.34,.91,.40,black);
 B(.60,.08,.05,0,.35,.425,grey);
}
if(id==='parkingMeter'){
 B(.36,.06,.33,0,1.99,0,dark);
 B(.21,.14,.016,0,1.81,.171,blue);
 for(let i=0;i<3;i++)for(let j=0;j<3;j++)B(.045,.025,.015,-.09+j*.09,1.68-i*.07,.173,grey);
 B(.16,.025,.016,0,1.37,.174,black);
}
if(id==='cashMachine'){
 B(.63,.055,.04,0,1.78,.315,blue);
 for(let i=0;i<3;i++)for(let j=0;j<3;j++)B(.075,.045,.012,-.16+j*.16,1.00-i*.075,.33,grey);
 B(.25,.035,.03,0,1.16,.32,black);
 B(.20,.045,.03,0,.64,.32,blue);
}
if(id==='noticeBoard'){
 for(let i=0;i<5;i++){B(.13,.013,.018,-.48+i*.24,1.51,.075,cream);B(.14,.013,.018,-.48+i*.24,1.31,.075,grey);}
 for(const x of [-.67,.67])B(.11,.09,.20,x,.04,0,grey);
 B(1.49,.04,.08,0,1.90,.10,wood);
}
if(id==='gardenShed'){
 // Timber lap boards, roof felt, door hinges and an actual pitched ridge.
 for(let y=.22;y<1.71;y+=.17)for(const z of [-.67,.67])B(1.74,.025,.023,0,y,z,wood);
 for(let y=.22;y<1.71;y+=.17)for(const x of [-.86,.86])B(.025,.025,1.34,x,y,0,wood);
 for(const y of [.30,1.16])B(.10,.035,.025,.20,y,.746,steel);
 B(.12,.18,.03,-.20,.88,.745,black);
 for(const x of [-.42,.42]){const roof=B(1.12,.075,1.58,x,1.89,0,dark);roof.rotation.z=x<0?.20:-.20;}
 B(1.92,.035,.08,0,2.00,0,dark);
}
if(id==='cafeMenuStand'){
 for(const x of [-.35,.35])R([x,0,-.22],[x,.99,0],.024,wood);
 for(let i=0;i<5;i++)B(.32,.015,.012,-.10+(i%2)*.15,1.62-i*.14,.058,ivory);
 B(.89,.04,.07,0,.88,.025,wood);
}
if(id==='newspaperStand'){
 for(let i=0;i<4;i++)for(let j=0;j<5;j++){const x=-.43+j*.21,y=.53+i*.31;B(.16,.17,.01,x,y,.165,ivory);B(.15,.045,.012,x,y+.06,.173,[red,blue,green,dark,yellow][j]);B(.12,.015,.012,x,y+.015,.175,grey);}
 for(const x of [-.55,.55])B(.16,.025,.28,x,.03,0,dark);
}
if(id==='shoppingBasket'){
 // Basket has an open top, vented walls and two hinged handles.
 for(let i=0;i<4;i++)for(const z of [-.206,.206])B(.43,.025,.012,0,.14+i*.078,z,red);
 for(let i=0;i<3;i++)for(const x of [-.296,.296])B(.012,.025,.30,x,.14+i*.09,0,red);
 for(const x of [-.22,.22]){tor(.025,.009,x,.43,0,steel);B(.045,.035,.025,x,.43,0,black);}
 B(.48,.05,.055,0,.75,0,black);
}
if(id==='deliveryTrolley'){
 for(const x of [-.23,.23])wheel(x,.12,-.22,.105);
 B(.52,.035,.10,0,.10,.30,steel);
 for(const y of [.42,.72,1.03])R([-.23,y,-.12],[.23,y,-.12],.014,steel);
 B(.35,.035,.08,0,1.29,-.22,rubber);
}
if(id==='marketStall'){
 // Canvas valance, striped roof, market counter and rear bracing.
 for(let i=0;i<7;i++)B(.27,.15,.025,-.83+i*.277,2.12,.56,i%2?cream:red);
 for(const x of [-.89,.89])R([x,.20,-.5],[x,2.16,.50],.014,steel);
 for(let i=0;i<5;i++){const x=-.67+i*.34;B(.26,.13,.25,x,1.09,0,[green,yellow,red,green,yellow][i]);}
 B(1.88,.14,.10,0,.80,.39,wood);
}


/* Batch 05 geometry rebuild — replace defective prototypes, don't stack patches. */
if(['bakeryDisplay','takeawayCounter','bikeRack','vendingMachine','parkingMeter','cashMachine','gardenShed','shoppingBasket','marketStall'].includes(id)){
 g.clear();
 const mat=(c:number,metal=0)=>new T.MeshStandardMaterial({color:c,metalness:metal,roughness:metal?.48:.76,side:T.DoubleSide});
 const oak=mat(0x92724f),pine=mat(0xb99870),cream2=mat(0xe6dfce),charcoal=mat(0x242a2c),chrome=mat(0x9da9ab,.72),paint=mat(0xb51c27),navy=mat(0x294459),display=mat(0x759cb1),crust=mat(0xb77937),gold=mat(0xdba14a),leaf=mat(0x497e38),tomato=mat(0xb73729);
 const box=(w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material)=>B(w,h,d,x,y,z,m);
 const rod=(a:number[],b:number[],r:number,m:T.Material)=>R(a,b,r,m);
 const ball=(r:number,x:number,y:number,z:number,m:T.Material)=>sphere(r,x,y,z,m);
 const line=(pts:number[][],r:number,m:T.Material)=>{for(let i=1;i<pts.length;i++)rod(pts[i-1],pts[i],r,m);};
 if(id==='bakeryDisplay'){
  for(const x of [-.62,.62])for(const z of [-.28,.28])box(.055,1.55,.055,x,.79,z,oak);
  for(const y of [.18,.64,1.10]){box(1.35,.048,.66,0,y,0,pine);box(1.35,.065,.04,0,y+.045,.33,oak);
   for(let i=0;i<4;i++){const x=-.45+i*.30;const loaf=new T.Mesh(new T.SphereGeometry(.125,20,12),i%2?gold:crust);loaf.scale.set(1.05,.52,.72);loaf.position.set(x,y+.115,0);g.add(loaf);
    for(let j=-1;j<=1;j++)rod([x+j*.035,y+.167,.082],[x+j*.035+.025,y+.177,.085],.004,cream2);
   }
  }
  box(1.40,.065,.73,0,1.57,0,oak);box(1.35,.10,.70,0,.07,0,oak);
 }
 if(id==='takeawayCounter'){
  box(1.85,.90,.72,0,.46,0,cream2);box(1.92,.065,.80,0,.94,0,charcoal);
  box(1.68,.58,.025,0,.48,.375,navy);box(1.70,.065,.045,0,.79,.398,oak);
  for(const x of [-.78,.78])box(.045,.67,.045,x,.49,.395,chrome);
  // A complete till sits ON the worktop, not floating above it.
  box(.48,.22,.30,.45,1.075,-.10,charcoal);
  const scr=box(.35,.16,.015,.45,1.15,.059,display);scr.rotation.x=-.15;
  box(.37,.035,.22,.45,.993,.09,chrome);
  for(let i=0;i<4;i++)for(let j=0;j<3;j++)box(.045,.009,.028,.30+j*.095,1.015,.04+i*.038,cream2);
  box(.16,.035,.12,-.50,.997,-.10,paint);box(.08,.035,.055,-.50,1.03,-.06,charcoal);
  box(.32,.025,.25,-.37,.987,.17,chrome);
 }
 if(id==='bikeRack'){
  // Sheffield stand: a SINGLE continuous bent tube, not three tubes and corner rings.
  const pts=[[-.37,.025,0],[-.37,.66,0],[-.35,.75,0],[-.28,.82,0],[-.18,.85,0],[.18,.85,0],[.28,.82,0],[.35,.75,0],[.37,.66,0],[.37,.025,0]];
  line(pts,.024,chrome);
  for(const x of [-.37,.37]){box(.16,.014,.13,x,.012,0,chrome);for(const z of [-.045,.045]){const bolt=C(.009,.008,x,.022,z,charcoal,12);}}
 }
 if(id==='vendingMachine'){
  // Recessed snack display: stock remains behind the glazing and front fascia.
  box(.88,1.76,.72,0,.89,0,charcoal);
  box(.62,1.32,.028,-.095,1.035,.365,navy);
  box(.565,1.25,.012,-.095,1.035,.384,display);
  for(let row=0;row<4;row++){
   const y=.60+row*.275;
   box(.54,.018,.075,-.095,y-.09,.305,chrome);
   for(let j=0;j<3;j++){
    const x=-.29+j*.19;
    box(.105,.145,.048,x,y,.316,[paint,leaf,gold][j]);
    box(.075,.027,.008,x,y-.057,.345,cream2);
   }
  }
  // Glazing and surrounding frame remain in front of recessed stock.
  box(.605,.038,.035,-.095,1.70,.403,charcoal);
  for(const x of [-.41,.22])box(.035,1.31,.042,x,1.035,.401,charcoal);
  box(.15,.31,.035,.335,1.11,.381,chrome);
  box(.105,.055,.018,.335,1.17,.408,charcoal);
  box(.11,.025,.019,.335,.99,.408,gold);
  box(.56,.15,.048,-.10,.255,.379,charcoal);
  box(.41,.024,.023,-.10,.29,.411,chrome);
 }
 if(id==='parkingMeter'){
  // British pay-and-display terminal with a compact integrated head.
  box(.18,1.17,.16,0,.67,0,navy);box(.34,.055,.30,0,.045,0,charcoal);
  box(.46,.75,.33,0,1.58,0,navy);box(.48,.055,.36,0,1.985,0,charcoal);
  box(.23,.12,.015,0,1.81,.175,display);box(.31,.035,.018,0,1.93,.174,cream2);
  box(.26,.14,.018,0,1.55,.175,charcoal);
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)box(.045,.024,.009,-.09+j*.09,1.585-i*.039,.189,chrome);
  box(.16,.019,.025,0,1.39,.179,chrome);box(.12,.04,.018,0,1.30,.175,gold);
  box(.30,.09,.018,0,1.19,.172,cream2);
 }
 if(id==='cashMachine'){
  // Flush recessed ATM fascia, distinct card / note / keypad positions.
  box(.88,1.85,.52,0,.93,0,chrome);box(.73,1.18,.026,0,1.18,.274,charcoal);
  box(.56,.40,.016,0,1.48,.294,navy);box(.47,.31,.018,0,1.48,.305,display);
  box(.29,.038,.018,-.13,1.18,.299,charcoal);box(.22,.018,.02,-.13,1.19,.31,chrome);
  box(.16,.10,.018,.22,1.17,.30,chrome);box(.09,.012,.025,.22,1.17,.317,charcoal);
  box(.38,.28,.025,0,.90,.303,navy);
  for(let i=0;i<4;i++)for(let j=0;j<3;j++)box(.072,.037,.012,-.105+j*.105,1.00-i*.065,.323,chrome);
  box(.38,.06,.027,0,.62,.305,charcoal);box(.26,.014,.035,0,.63,.328,chrome);
  box(.68,.06,.055,0,1.80,.29,navy);
 }
 if(id==='gardenShed'){
  // Continuous timber-clad walls and two correctly meeting roof slopes.
  box(1.72,1.65,1.34,0,.84,0,pine);
  for(let y=.17;y<1.66;y+=.15){for(const z of [-.683,.683])box(1.73,.018,.024,0,y,z,oak);for(const x of [-.87,.87])box(.024,.018,1.35,x,y,0,oak);}
  box(.69,1.38,.042,0,.71,.71,oak);box(.59,1.27,.02,0,.71,.74,pine);
  for(const y of [.26,1.13])box(.13,.045,.025,.25,y,.759,chrome);
  box(.09,.14,.025,-.20,.72,.765,charcoal);
  // Pitched gable roof: ridge runs front-to-back along Z, slopes left/right in X.
  // Each half is a single continuous sheet; the two upper edges meet at x=0.
  const halfRun=.94, rise=.37, pitch=Math.atan2(rise,halfRun);
  const slopeLength=Math.hypot(halfRun,rise);
  const ridgeY=2.075, eaveY=ridgeY-rise;
  for(const sign of [-1,1]){
   const panel=box(slopeLength+.035,.065,1.57,sign*halfRun/2,(ridgeY+eaveY)/2,0,charcoal);
   panel.rotation.z=-sign*pitch;
   // Fascia follows the actual eave, rather than crossing the roof.
   box(.055,.10,1.60,sign*halfRun,eaveY-.025,0,charcoal);
  }
  box(.085,.065,1.63,0,ridgeY+.012,0,charcoal);
  // Simple front/back triangular gable infill below the roof.
  for(const z of [-.685,.685]){
   const triangle=new T.Shape();
   triangle.moveTo(-.86,1.66);triangle.lineTo(.86,1.66);triangle.lineTo(0,ridgeY-.055);triangle.closePath();
   const mesh=new T.Mesh(new T.ShapeGeometry(triangle),pine);
   mesh.position.z=z+(z>0?.008:-.008);
   if(z<0)mesh.rotation.y=Math.PI;
   g.add(mesh);
  }
 }
 if(id==='shoppingBasket'){
  // Open slatted plastic hand basket, tapered profile and two realistic low-profile handles.
  box(.48,.035,.31,0,.065,0,paint);
  for(const z of [-.17,.17]){box(.56,.045,.025,0,.39,z,paint);for(let i=0;i<7;i++){const x=-.225+i*.075;rod([x*.87,.09,z*.82],[x,.37,z],.009,paint);}}
  for(const x of [-.28,.28]){box(.025,.045,.37,x,.39,0,paint);for(let i=0;i<5;i++){const z=-.13+i*.065;rod([x*.85,.09,z],[x,.37,z],.009,paint);}}
  for(let i=0;i<5;i++)box(.08,.012,.31,-.19+i*.095,.085,0,paint);
  for(const z of [-.17,.17]){line([[-.23,.405,z],[-.20,.55,z],[0,.63,z],[.20,.55,z],[.23,.405,z]],.014,charcoal);}
  box(.18,.038,.04,0,.635,-.17,charcoal);box(.18,.038,.04,0,.635,.17,charcoal);
 }
 if(id==='marketStall'){
  for(const x of [-.94,.94])for(const z of [-.55,.55])rod([x,.02,z],[x,2.02,z],.025,chrome);
  for(const x of [-.94,.94])rod([x,2.02,-.55],[x,2.36,0],.023,chrome);
  rod([-.94,2.36,0],[.94,2.36,0],.024,chrome);
  // Two sloping canvas halves with alternating stripes.
  for(let i=0;i<8;i++){const x=-.82+i*.235;for(const side of [-1,1]){const roof=box(.235,.023,.63,x,2.18,side*.27,i%2?cream2:paint);roof.rotation.x=side*.49;}}
  for(let i=0;i<8;i++)box(.235,.16,.022,-.82+i*.235,1.94,.57,i%2?cream2:paint);
  box(1.85,.07,.85,0,.99,0,oak);
  for(const x of [-.80,.80])for(const z of [-.33,.33])box(.06,.90,.06,x,.49,z,oak);
  for(let i=0;i<4;i++){const x=-.60+i*.40;box(.34,.13,.35,x,1.09,0,oak);for(let j=0;j<5;j++){const px=x+((j%3)-1)*.085,pz=(Math.floor(j/3)-.5)*.14;ball(.055,px,1.18,pz,i%3===0?tomato:i%3===1?leaf:gold);}}
  box(1.9,.09,.08,0,.91,.43,oak);
 }
}

g.userData={collection:'streetassettesting',batch:5,id,status:'review-required',units:'metres'};return g;}