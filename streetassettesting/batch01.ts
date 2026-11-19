/** Isolated Street Fight UK batch 01. No game imports or registrations. */
import * as THREE from 'three';
export const ASSETS=[
{id:'retailCounter',label:'Retail counter',category:'interior'},
{id:'highTable',label:'High café table',category:'interior'},
{id:'stockedShelves',label:'Stocked shop shelves',category:'interior'},
{id:'manholeCover',label:'Cast-iron manhole cover',category:'street'},
{id:'queueBarrier',label:'Queue barrier post',category:'interior'},
{id:'drinksFridge',label:'Glass-door drinks fridge',category:'interior'},
{id:'streetPlanter',label:'Street planter',category:'street'},
{id:'globeStreetLight',label:'Globe street light',category:'street'},
{id:'shopCounterTill',label:'Shop counter with till',category:'interior'},
{id:'cardboardBox',label:'Cardboard shipping box',category:'interior'}
] as const;
export type AssetId=typeof ASSETS[number]['id'];
export function createAsset(id:AssetId):THREE.Group{
 const g=new THREE.Group();g.name='SFUK_TEST_'+id;
 const m=(c:number,metal=0,rough=.7)=>new THREE.MeshStandardMaterial({color:c,metalness:metal,roughness:rough});
 const dark=m(0x262d33,.35),steel=m(0x88969c,.75,.4),wood=m(0x937253,0,.84),woodDark=m(0x554535,0,.86),glass=m(0x8ec1d3,.15,.18),cream=m(0xe4e3d9),black=m(0x151b20),green=m(0x3b7553),red=m(0xb33339),blue=m(0x3972a2),paper=m(0xb89b70);
 const box=(w:number,h:number,d:number,x:number,y:number,z:number,mat:THREE.Material)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;g.add(o);return o};
 const cyl=(r:number,h:number,x:number,y:number,z:number,mat:THREE.Material,n=32)=>{const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,n),mat);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;g.add(o);return o};
 const rod=(a:number[],b:number[],r:number,mat:THREE.Material)=>{const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),v=q.clone().sub(p);const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,v.length(),12),mat);o.position.copy(p.add(q).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());o.castShadow=true;g.add(o);return o};
 const sphere=(r:number,x:number,y:number,z:number,mat:THREE.Material)=>{const o=new THREE.Mesh(new THREE.SphereGeometry(r,24,16),mat);o.position.set(x,y,z);o.castShadow=true;g.add(o);return o};
 if(id==='retailCounter'||id==='shopCounterTill'){
  box(1.75,.88,.66,0,.44,0,woodDark);box(1.84,.065,.76,0,.91,0,wood);box(1.57,.58,.018,0,.45,.343,wood);
  for(const x of [-.65,.65])box(.035,.72,.04,x,.44,.36,steel);
  box(.48,.07,.34,.42,.995,-.08,dark);box(.40,.035,.25,.42,1.04,-.08,black);
  if(id==='shopCounterTill'){box(.29,.25,.10,.42,1.18,-.14,dark);box(.245,.175,.012,.42,1.20,-.082,blue);box(.22,.045,.18,-.25,1.0,-.06,steel);for(let i=0;i<12;i++)box(.037,.012,.026,-.34+(i%4)*.056,1.03,-.12+Math.floor(i/4)*.046,black);}
 }
 if(id==='highTable'){
  cyl(.43,.055,0,1.07,0,wood,48);cyl(.055,1.02,0,.54,0,steel);
  cyl(.30,.05,0,.035,0,dark);for(const a of [0,2.094,4.188])rod([0,.08,0],[Math.sin(a)*.35,.05,Math.cos(a)*.35],.025,dark);
  cyl(.39,.012,0,1.107,0,woodDark,48);
 }
 if(id==='stockedShelves'){
  for(const x of [-.85,.85])box(.055,2.1,.48,x,1.05,0,dark);
  for(const y of [.15,.62,1.09,1.56,2.02]){
   box(1.78,.055,.55,0,y,0,steel);box(1.78,.10,.035,0,y+.075,.26,dark);
  }
  for(let row=0;row<4;row++)for(let i=0;i<9;i++){
   const color=[red,blue,green,cream,paper][(i+row)%5],x=-.72+i*.18,y=.22+row*.47;
   box(.115,.24+(i%3)*.035,.21,x,y+.12,0,color);
   box(.09,.055,.012,x,y+.13,.113,cream);
  }
 }
 if(id==='manholeCover'){
  cyl(.49,.075,0,.045,0,dark,64);cyl(.445,.016,0,.09,0,steel,64);
  for(let i=0;i<12;i++){const a=i*Math.PI/6;const o=box(.055,.016,.27,Math.cos(a)*.29,.104,Math.sin(a)*.29,dark);o.rotation.y=-a;}
  for(const x of [-.12,.12])box(.12,.018,.035,x,.105,0,black);
 }
 if(id==='queueBarrier'){
  cyl(.19,.035,0,.018,0,dark);cyl(.035,.94,0,.49,0,steel);cyl(.078,.055,0,.965,0,dark);
  cyl(.095,.03,0,1.002,0,steel);box(.16,.08,.10,0,.92,0,dark);
  // Retractable belt housing only: a single post does not have a floating belt.
  box(.055,.028,.12,.09,.93,0,red);
 }
 if(id==='drinksFridge'){
  box(.88,1.93,.70,0,.965,0,dark);box(.80,1.72,.028,0,.98,.37,steel);
  box(.71,1.55,.013,0,1.0,.391,glass);
  for(const y of [.31,.68,1.05,1.42])box(.69,.027,.55,0,y,.04,steel);
  for(let row=0;row<4;row++)for(let i=0;i<5;i++){
   const x=-.27+i*.135,y=.34+row*.37;
   cyl(.043,.24,x,y+.12,.08,[red,green,blue,cream][(i+row)%4],12);
   cyl(.034,.016,x,y+.25,.08,steel,12);
  }
  box(.038,1.14,.045,.32,1.01,.416,dark);
  box(.84,.16,.72,0,1.85,0,blue);box(.83,.06,.72,0,.045,0,black);
 }
 if(id==='streetPlanter'){
  const pot=cyl(.43,.60,0,.32,0,woodDark,8);cyl(.47,.055,0,.62,0,steel,8);cyl(.38,.025,0,.65,0,woodDark,8);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;rod([Math.sin(a)*.14,.65,Math.cos(a)*.14],[Math.sin(a)*.34,1.12,Math.cos(a)*.34],.024,green);const foliage=sphere(.21,Math.sin(a)*.34,1.12,Math.cos(a)*.34,green);foliage.scale.y=1.6;}
  sphere(.28,0,1.18,0,green);
 }
 if(id==='globeStreetLight'){
  cyl(.18,.09,0,.045,0,dark);cyl(.065,3.15,0,1.63,0,dark);
  for(const y of [.22,2.75])cyl(.095,.09,0,y,0,steel);
  cyl(.17,.075,0,3.23,0,dark);sphere(.30,0,3.56,0,cream);
  cyl(.12,.035,0,3.85,0,dark);
 }
 if(id==='cardboardBox'){
  box(.65,.49,.52,0,.245,0,paper);box(.66,.018,.53,0,.49,0,wood);
  box(.065,.022,.53,0,.505,0,woodDark);
  for(const x of [-.322,.322])box(.012,.40,.015,x,.245,.08,woodDark);
  box(.23,.14,.008,.08,.27,.264,cream);
 }

 // UK high-street identity pass: measured fittings, practical fixtures, and grounded detailing.
 const brass=m(0xa88b54,.65,.35),ink=m(0x1b2229),brick=m(0x9c4c3f),yellow=m(0xe2b941),grey=m(0x626b71,.3),white=m(0xf1efe7),tape=m(0x9b7d53);
 const panel=(w:number,h:number,x:number,y:number,z:number,material:THREE.Material)=>box(w,h,.008,x,y,z,material);
 const label=(w:number,h:number,x:number,y:number,z:number,colour:THREE.Material)=>{panel(w,h,x,y,z,white);panel(w*.75,h*.20,x,y,z+.008,colour)};
 if(id==='retailCounter'||id==='shopCounterTill'){
  // Compact UK newsagent/corner-shop counter with protective kickboard, card terminal and shelf edging.
  box(1.77,.13,.055,0,.11,.354,ink);box(1.82,.025,.78,0,.955,0,grey);
  for(const x of [-.56,0,.56])box(.018,.64,.028,x,.47,.355,brass);
  box(.19,.095,.24,-.52,1.035,-.08,ink);box(.13,.014,.14,-.52,1.095,-.065,blue);
  box(.42,.07,.28,-.14,1.025,.02,cream);
  if(id==='shopCounterTill'){
   // Customer-facing chip-and-PIN terminal and receipt printer.
   box(.17,.065,.24,-.47,1.06,.09,dark);box(.13,.01,.09,-.47,1.1,.10,blue);
   box(.18,.14,.19,.68,1.045,-.16,grey);box(.12,.10,.006,.68,1.09,-.056,white);
  }
 }
 if(id==='highTable'){
  // British pub/café poseur table: robust dark timber, brass foot ring, stable weighted base.
  cyl(.38,.014,0,1.105,0,woodDark,48);
  cyl(.23,.035,0,.29,0,brass,48);
  for(let a=0;a<8;a++){const t=a*Math.PI/4;rod([Math.sin(t)*.22,.28,Math.cos(t)*.22],[Math.sin(t+.24)*.22,.28,Math.cos(t+.24)*.22],.011,brass);}
 }
 if(id==='stockedShelves'){
  // Newsagent-style price-edge rails, product facings and shelf backboard.
  box(1.8,2.06,.035,0,1.07,-.26,grey);
  for(let row=0;row<4;row++){
   const y=.23+row*.47;
   for(let i=0;i<9;i++){const x=-.72+i*.18;label(.095,.045,x,y+.005,.287,ink);}
  }
  box(1.75,.14,.04,0,2.14,.25,red);
 }
 if(id==='manholeCover'){
  // Flush UK ductile iron utility cover, double-lifting keyholes and anti-slip ribs.
  for(let i=0;i<7;i++){const z=-.30+i*.10;box(.56,.012,.024,0,.118,z,ink);}
  for(const x of [-.31,.31]){box(.075,.009,.035,x,.126,0,grey);box(.02,.009,.07,x,.13,0,ink);}
  cyl(.51,.025,0,.026,0,grey,64);
 }
 if(id==='queueBarrier'){
  // UK retractable queue stanchion, belt cartridge and stable circular weighted foot.
  cyl(.145,.018,0,.038,0,grey);cyl(.045,.07,0,.9,0,ink);
  box(.17,.052,.115,0,.985,0,ink);
  for(const x of [-.07,.07])box(.022,.022,.09,x,.984,0,steel);
 }
 if(id==='drinksFridge'){
  // Upright shop drinks chiller with black gasket, canopy, compressor grille and shelf labels.
  box(.74,1.58,.023,0,1,.407,ink);
  box(.68,1.49,.009,0,1,.423,glass);
  for(const y of [.32,.69,1.06,1.43]){
   box(.68,.026,.02,0,y,.429,steel);
   for(let i=0;i<5;i++)label(.085,.04,-.27+i*.135,y+.028,.445,ink);
  }
  for(let i=0;i<9;i++)box(.055,.022,.015,-.29+i*.073,.105,.368,grey);
  box(.65,.085,.012,0,1.85,.365,white);box(.58,.025,.012,0,1.85,.379,red);
  box(.04,1.1,.055,.337,1.0,.45,steel);
 }
 if(id==='streetPlanter'){
  // UK town-centre municipal planter: powder-coated steel bands and shrub foliage.
  for(const y of [.14,.36,.57])cyl(.46,.022,0,y,0,ink,8);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;const o=box(.075,.43,.014,Math.sin(a)*.425,.32,Math.cos(a)*.425,grey);o.rotation.y=a;}
  for(let i=0;i<12;i++){const a=i*2.399;const p=sphere(.10,Math.sin(a)*.24,1.04+(i%3)*.14,Math.cos(a)*.24,green);p.scale.set(1.2,.65,1.4);}
 }
 if(id==='globeStreetLight'){
  // Traditional UK heritage-style globe column: finial, fluted shaft and cast base.
  for(let i=0;i<8;i++){const a=i*Math.PI/4;rod([Math.sin(a)*.077,.30,Math.cos(a)*.077],[Math.sin(a)*.077,2.69,Math.cos(a)*.077],.009,grey);}
  for(const y of [.15,.35,2.84,3.18])cyl(.105,.045,0,y,0,brass);
  cyl(.11,.08,0,3.9,0,ink);sphere(.055,0,3.97,0,brass);
 }
 if(id==='cardboardBox'){
  // UK parcel carton: taped centre seam, side flaps, printed shipping label.
  box(.07,.012,.53,0,.512,0,tape);
  for(const z of [-.22,.22])box(.62,.012,.045,0,.515,z,tape);
  label(.29,.17,.07,.29,.271,ink);
  for(let i=0;i<7;i++)box(.008,.08,.009,-.03+i*.022,.26,.283,ink);
  box(.22,.012,.04,0,.18,.277,ink);
 }
 g.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(g);
 if(Number.isFinite(bounds.min.y)&&Math.abs(bounds.min.y)>.001)for(const child of g.children)child.position.y-=bounds.min.y;
 g.userData={collection:'streetassettesting',batch:1,standalone:true,id,units:'metres',status:'UK-aesthetic-review-required',revision:'UK-v2'};
 return g;
}
