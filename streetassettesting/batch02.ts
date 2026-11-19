/** Street Fight UK: isolated British environment testing, batch 02. */
import * as THREE from 'three';
export const ASSETS=[
{id:'cardTerminal',label:'UK chip-and-PIN terminal',category:'retail'},
{id:'backBarShelves',label:'British pub back-bar bottle shelves',category:'pub'},
{id:'receptionCounter',label:'UK reception desk',category:'interior'},
{id:'pottedTree',label:'Indoor potted tree',category:'interior'},
{id:'wineBottle',label:'Wine bottle',category:'pub'},
{id:'oilDrum',label:'Industrial oil drum',category:'industrial'},
{id:'wallClock',label:'Wall clock',category:'interior'},
{id:'chalkboardMenu',label:'Pub chalkboard menu',category:'pub'},
{id:'pastryCabinet',label:'Hot food and pastry cabinet',category:'retail'},
{id:'waitingSofa',label:'Reception waiting sofa',category:'interior'}
] as const;
export type AssetId=typeof ASSETS[number]['id'];
export function createAsset(id:AssetId):THREE.Group{
 const g=new THREE.Group();g.name='SFUK_B02_'+id;
 const mat=(c:number,metal=0,rough=.7)=>new THREE.MeshStandardMaterial({color:c,metalness:metal,roughness:rough});
 const oak=mat(0x805d3e),darkOak=mat(0x453327),black=mat(0x25292b),steel=mat(0x8a9397,.72,.42),cream=mat(0xe6e0d1),green=mat(0x386849),blue=mat(0x305f8a),red=mat(0x9b3d38),glass=mat(0x8eb6b5,.2,.22),brass=mat(0xb29553,.65,.38),card=mat(0xb5a68a),slate=mat(0x313b35),cushion=mat(0x4a595b);
 const box=(w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;g.add(o);return o};
 const cyl=(r:number,h:number,x:number,y:number,z:number,m:THREE.Material,n=24)=>{const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,n),m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;g.add(o);return o};
 const sphere=(r:number,x:number,y:number,z:number,m:THREE.Material)=>{const o=new THREE.Mesh(new THREE.SphereGeometry(r,18,12),m);o.position.set(x,y,z);g.add(o);return o};
 const rod=(a:[number,number,number],b:[number,number,number],r:number,m:THREE.Material)=>{const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),d=q.clone().sub(p);const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,d.length(),10),m);o.position.copy(p.add(q).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());g.add(o);return o};
 const bottle=(x:number,y:number,z:number,color:THREE.Material)=>{cyl(.046,.25,x,y+.125,z,color);cyl(.018,.085,x,y+.29,z,color);cyl(.023,.018,x,y+.335,z,brass);box(.075,.075,.008,x,y+.15,z+.046,cream)};
 if(id==='cardTerminal'){
  box(.15,.075,.24,0,.13,0,black);const screen=box(.125,.009,.087,0,.179,-.047,blue);screen.rotation.x=-.23;
  for(let i=0;i<12;i++)box(.027,.008,.023,-.042+(i%3)*.042,.178,.018+Math.floor(i/3)*.036,i>8?red:steel);
  box(.16,.045,.13,0,.06,.06,black);box(.1,.014,.10,0,.188,-.075,glass);
 }
 if(id==='backBarShelves'){
  box(2.35,2.25,.07,0,1.125,-.29,darkOak);
  for(const x of [-1.13,1.13])box(.055,2.2,.45,x,1.1,0,darkOak);
  for(const y of [.25,.72,1.19,1.66,2.13]){
   box(2.30,.055,.46,0,y,0,oak);box(2.3,.027,.025,0,y+.035,.22,brass);
  }
  for(let row=0;row<4;row++)for(let i=0;i<12;i++)bottle(-1.01+i*.18,.30+row*.47,.06,[green,blue,red,glass][(i+row)%4]);
 }
 if(id==='receptionCounter'){
  box(2.2,.97,.7,0,.485,0,oak);box(2.26,.06,.75,0,.99,0,darkOak);
  box(1.95,.70,.015,0,.49,.357,cream);for(const x of [-.94,.94])box(.028,.77,.035,x,.48,.37,brass);
  box(.48,.07,.30,.40,1.055,-.1,black);box(.4,.28,.018,.40,1.22,-.14,blue);
  box(.25,.04,.20,-.47,1.04,-.04,black);box(.17,.014,.13,-.47,1.069,-.02,steel);
  box(2.12,.08,.06,0,.07,.38,darkOak);
 }
 if(id==='pottedTree'){
  cyl(.27,.36,0,.19,0,slate,10);cyl(.30,.045,0,.39,0,steel,10);cyl(.25,.03,0,.415,0,darkOak,10);
  rod([0,.4,0],[0,1.75,0],.05,darkOak);
  for(let i=0;i<9;i++){const a=i*2.4,y=.95+(i%4)*.24,r=.27+(i%3)*.09;rod([0,y-.25,0],[Math.cos(a)*r,y,Math.sin(a)*r],.022,darkOak);const p=sphere(.27,Math.cos(a)*r,y,Math.sin(a)*r,green);p.scale.set(1,.68,1.2);}
  sphere(.27,0,1.87,0,green);
 }
 if(id==='wineBottle'){bottle(0,0,0,green);cyl(.04,.007,0,.25,.047,cream,18);}
 if(id==='oilDrum'){
  cyl(.31,.88,0,.46,0,blue,32);for(const y of [.09,.25,.64,.85])cyl(.316,.025,0,y,0,steel,32);
  cyl(.29,.028,0,.912,0,black,32);for(const x of [-.17,.17])cyl(.037,.015,x,.932,0,steel,16);
  box(.31,.22,.014,0,.5,.31,cream);box(.22,.05,.016,0,.57,.32,black);
 }
 if(id==='wallClock'){
  const face=cyl(.31,.07,0,.31,0,black,48);face.rotation.x=Math.PI/2;
  const dial=cyl(.28,.008,0,.31,.043,cream,48);dial.rotation.x=Math.PI/2;
  for(let i=0;i<12;i++){const a=i*Math.PI/6;box(.018,.042,.008,Math.sin(a)*.235,.31+Math.cos(a)*.235,.052,black);}
  rod([0,.31,.065],[.15,.39,.065],.008,black);rod([0,.31,.065],[-.055,.48,.065],.011,black);
  cyl(.016,.02,0,.31,.07,brass,12).rotation.x=Math.PI/2;
 }
 if(id==='chalkboardMenu'){
  box(.88,1.25,.055,0,.65,0,darkOak);box(.78,1.14,.012,0,.65,.038,slate);
  for(let i=0;i<6;i++){box(.48-i%3*.045,.013,.009,-.06,.99-i*.15,.05,cream);box(.10,.012,.009,.29,.99-i*.15,.05,cream);}
  box(.36,.035,.009,0,1.17,.053,brass);for(const x of [-.43,.43])box(.055,1.25,.09,x,.65,0,oak);
 }
 if(id==='pastryCabinet'){
  box(1.16,.18,.64,0,.09,0,black);box(1.12,.95,.60,0,.65,0,glass);
  for(const y of [.25,.55,.85]){box(1.05,.022,.52,0,y,0,steel);for(let i=0;i<5;i++){const p=sphere(.075,-.40+i*.2,y+.09,.04,card);p.scale.set(1.1,.58,.85);}}
  box(1.19,.095,.66,0,1.17,0,black);
  for(const x of [-.55,.55])box(.022,.98,.02,x,.65,.31,steel);
  box(.38,.10,.02,0,.14,.334,cream);
 }
 if(id==='waitingSofa'){
  box(1.75,.27,.68,0,.36,0,cushion);box(1.75,.78,.17,0,.74,-.28,cushion);
  for(const x of [-.81,.81])box(.15,.49,.72,x,.47,0,cushion);
  for(const x of [-.44,.44]){box(.79,.13,.55,x,.53,.04,blue);box(.78,.49,.13,x,.79,-.18,blue);}
  for(const x of [-.72,.72])for(const z of [-.24,.24])box(.065,.15,.065,x,.10,z,black);
 }

 // Batch 02 polish pass: model-specific structure, fittings, materials and believable UK usage.
 const nickel=mat(0xa4a9a6,.72,.36),rubber=mat(0x171c1d,.1,.85),paperWhite=mat(0xf2efe4),priceRed=mat(0xb9423e),tan=mat(0xa17c50),leafLight=mat(0x59834d),leafDark=mat(0x294d36),shadow=mat(0x292f2e),warm=mat(0xcaa86b,.35,.55);
 if(id==='cardTerminal'){
  // Angled contactless reader and separate receipt-slot/secure keypad zones.
  const contact=box(.105,.012,.065,0,.196,-.055,paperWhite);contact.rotation.x=-.22;
  for(let i=0;i<3;i++){const a=i*.024;rod([-.033+a,.206,-.069],[-.033+a,.206,-.048],.002,blue);}
  box(.16,.012,.035,0,.185,.122,rubber);
  for(let i=0;i<4;i++)box(.018,.007,.018,-.056+i*.038,.191,.08,i===3?priceRed:nickel);
  box(.125,.026,.018,0,.07,.172,rubber);
 }
 if(id==='backBarShelves'){
  // Traditional British pub gantry: mirrored rear panels, shelf lips, optics and pint-glass racks.
  box(2.19,1.89,.009,0,1.18,-.247,glass);
  for(const y of [.25,.72,1.19,1.66,2.13])box(2.29,.025,.02,0,y+.045,.229,brass);
  for(let i=0;i<8;i++){const x=-.9+i*.255;rod([x,1.97,.05],[x,1.84,.05],.012,nickel);cyl(.045,.035,x,1.81,.05,brass);}
  for(let i=0;i<7;i++){const x=-.84+i*.28;cyl(.042,.105,x,1.36,.14,glass,16);cyl(.052,.012,x,1.42,.14,nickel,16);}
  box(2.34,.09,.49,0,.075,0,darkOak);
 }
 if(id==='receptionCounter'){
  // Recessed front panels, visitor side lower ledge and counter accessories.
  for(const x of [-.72,0,.72])box(.60,.58,.018,x,.52,.369,darkOak);
  for(const x of [-.72,0,.72])box(.53,.49,.021,x,.52,.382,oak);
  box(.58,.045,.22,-.64,.78,.43,oak);
  box(.30,.02,.19,-.53,1.045,-.10,paperWhite);
  for(let i=0;i<6;i++)box(.02,.005,.09,-.64+i*.045,1.061,-.10,black);
  box(.16,.07,.22,.83,1.045,-.03,black);box(.13,.015,.12,.83,1.088,-.03,blue);
 }
 if(id==='pottedTree'){
  // Soil rim, drainage feet and layered asymmetric leaf clusters.
  cyl(.24,.022,0,.428,0,shadow,12);
  for(let i=0;i<10;i++){const a=i*2.399,y=1.08+(i%4)*.19,r=.19+(i%3)*.11;const p=sphere(.13,Math.cos(a)*r,y,Math.sin(a)*r,(i%3===0)?leafLight:leafDark);p.scale.set(1.1,.46,1.45);}
  for(let i=0;i<3;i++){const a=i*Math.PI*2/3;box(.08,.045,.08,Math.cos(a)*.18,.024,Math.sin(a)*.18,rubber);}
 }
 if(id==='wineBottle'){
  // Glass shoulder, neck foil, rear label and cork.
  cyl(.045,.025,0,.245,0,glass,20);
  cyl(.019,.043,0,.338,0,priceRed,20);
  box(.081,.12,.008,0,.125,-.046,paperWhite);
  box(.063,.017,.009,0,.17,.051,priceRed);
  box(.063,.008,.009,0,.11,.052,black);
  cyl(.014,.012,0,.367,0,tan,12);
 }
 if(id==='oilDrum'){
  // Industrial steel drum: ribbed shell, rolled chimes, bung closures and safety stencil.
  for(const y of [.04,.13,.43,.76,.90])cyl(.322,.017,0,y,0,nickel,40);
  for(let i=0;i<3;i++)box(.22,.012,.013,0,.48-i*.055,.326,black);
  box(.29,.12,.014,0,.28,.323,paperWhite);
  for(let i=0;i<5;i++)box(.013,.07,.014,-.1+i*.045,.28,.335,black);
  for(const x of [-.17,.17])cyl(.027,.012,x,.95,0,rubber,16);
 }
 if(id==='wallClock'){
  // Black-rimmed UK station/office clock, proper minute divisions and glass ring.
  const ring=cyl(.298,.018,0,.31,.055,nickel,48);ring.rotation.x=Math.PI/2;
  for(let i=0;i<60;i++){const a=i*Math.PI/30;const major=i%5===0;const t=box(major?.014:.006,major?.039:.015,.007,Math.sin(a)*.255,.31+Math.cos(a)*.255,.058,black);t.rotation.z=-a;}
  sphere(.015,0,.31,.084,brass);
 }
 if(id==='chalkboardMenu'){
  // A-frame pub specials board with hinged rear leg and chalk-like price lines.
  rod([-.37,1.21,-.035],[0,.12,-.43],.027,darkOak);
  rod([.37,1.21,-.035],[0,.12,-.43],.027,darkOak);
  rod([-.36,.26,0],[0,.22,-.38],.009,brass);
  for(let i=0;i<5;i++){box(.14,.007,.012,-.22,.97-i*.15,.065,paperWhite);box(.075,.008,.012,.24,.97-i*.15,.065,paperWhite);}
  box(.48,.008,.012,0,1.11,.065,warm);
 }
 if(id==='pastryCabinet'){
  // Heated UK bakery display: curved-looking segmented front, trays and product tags.
  for(const y of [.24,.54,.84]){box(1.08,.018,.42,0,y+.02,0,nickel);for(let i=0;i<5;i++){box(.115,.018,.075,-.4+i*.2,y+.036,.25,paperWhite);}}
  for(let i=0;i<5;i++)box(.11,.028,.02,-.4+i*.2,.21,.333,paperWhite);
  for(const x of [-.54,.54])box(.025,1.01,.024,x,.66,-.30,nickel);
  box(1.12,.065,.022,0,.96,.323,black);
  box(.70,.03,.07,0,1.18,.12,cream);
 }
 if(id==='waitingSofa'){
  // Two-seat British waiting-room sofa: seams, back cushions and arm caps.
  for(const x of [-.44,.44]){box(.012,.13,.55,x+.39,.55,.04,black);box(.72,.028,.02,x,.64,.32,steel);}
  for(const x of [-.81,.81])box(.17,.035,.65,x,.735,0,darkOak);
  for(const x of [-.42,.42])box(.65,.05,.035,x,.34,.335,black);
  box(1.46,.045,.04,0,.17,.32,steel);
 }
 const bounds=new THREE.Box3().setFromObject(g);if(Number.isFinite(bounds.min.y))for(const child of g.children)child.position.y-=bounds.min.y;
 g.userData={collection:'streetassettesting',batch:2,units:'metres',status:'review-required',id,style:'British high street',revision:'polish-v2'};
 return g;
}
