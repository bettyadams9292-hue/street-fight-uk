/** Street Fight UK — 30 bicycle, e-bike, scooter and motorcycle concepts.
 * Procedural Three.js review prototypes based on user reference photos.
 * Units metres, Y-up, wheels on ground, side view along X.
 * ISOLATED: not approved; not imported into gameplay.
 */
import * as THREE from 'three';
type Kind='roadster'|'step'|'road'|'hybrid'|'mtb'|'bmx'|'fold'|'cargo'|'tandem'|'ebike'|'rental'|'fat'|'surron'|'dirt'|'supermoto'|'sport'|'cruiser'|'moped'|'scooter'|'kick';
type Spec={id:string;label:string;kind:Kind;color:number;wheel?:number;accent?:number;basket?:boolean;carrier?:boolean;fender?:boolean;electric?:boolean;old?:boolean;full?:boolean;thick?:boolean};
export const BIKE_ASSETS:Spec[]=[
{id:'b01_roadster_1950',label:'1950s British roadster',kind:'roadster',color:0x252c27,carrier:true,fender:true,old:true},
{id:'b02_shopper_1970',label:'1970s step-through shopper',kind:'step',color:0x638bb1,basket:true,carrier:true,fender:true,old:true},
{id:'b03_chopper_1970',label:'1970s high-bar chopper bicycle',kind:'roadster',color:0xb84b23,old:true},
{id:'b04_school_bike',label:'Worn school commuter bicycle',kind:'hybrid',color:0x49596b,old:true,fender:true},
{id:'b05_city_stepthrough',label:'Modern step-through city bicycle',kind:'step',color:0x8ba3a2,basket:true,fender:true},
{id:'b06_hybrid_commuter',label:'UK hybrid commuter bicycle',kind:'hybrid',color:0x333d47,fender:true,carrier:true},
{id:'b07_road_racer',label:'Lightweight drop-bar road bicycle',kind:'road',color:0x9e2328},
{id:'b08_gravel',label:'Gravel adventure bicycle',kind:'road',color:0x807c61,thick:true},
{id:'b09_touring',label:'Steel touring bicycle with racks',kind:'road',color:0x3d6472,carrier:true,fender:true},
{id:'b10_mtb_hardtail',label:'Hardtail mountain bicycle',kind:'mtb',color:0x202a29,thick:true},
{id:'b11_mtb_full',label:'Full-suspension trail mountain bike',kind:'mtb',color:0x526b33,full:true,thick:true},
{id:'b12_bmx',label:'Small-wheel BMX street bike',kind:'bmx',color:0x773d8c,wheel:.265,thick:true},
{id:'b13_folding',label:'Compact folding commuter bike',kind:'fold',color:0x353c43,wheel:.245,fender:true},
{id:'b14_delivery_cargo',label:'Front-load delivery cargo bicycle',kind:'cargo',color:0xb48a3b,carrier:true},
{id:'b15_family_longtail',label:'Longtail family utility bicycle',kind:'cargo',color:0x5e7c78,carrier:true},
{id:'b16_tandem',label:'Two-person tandem bicycle',kind:'tandem',color:0x803f35},
{id:'b17_city_ebike',label:'Modern electric city bicycle',kind:'ebike',color:0x2e5a75,electric:true,carrier:true,fender:true},
{id:'b18_rental_ebike',label:'Green shared rental e-bike',kind:'rental',color:0x3bdb4d,electric:true,basket:true,fender:true},
{id:'b19_fat_ebike',label:'Orange fat-tyre electric bicycle',kind:'fat',color:0xdb912d,electric:true,thick:true},
{id:'b20_e_mtb',label:'Electric full-suspension mountain bike',kind:'mtb',color:0x3d4146,electric:true,full:true,thick:true},
{id:'b21_light_bee',label:'Lightweight electric trail motorbike',kind:'surron',color:0x9eae41,electric:true,thick:true},
{id:'b22_e_dirt',label:'Full-size electric dirt bike',kind:'dirt',color:0x7aa33b,electric:true,thick:true},
{id:'b23_mini_e_mx',label:'Youth electric motocross bike',kind:'dirt',color:0x2367b1,electric:true,wheel:.28,thick:true},
{id:'b24_petrol_mx',label:'Number-plate motocross race bike',kind:'dirt',color:0xf1c72b,accent:0x2871c5,thick:true},
{id:'b25_supermoto',label:'Urban supermoto motorcycle',kind:'supermoto',color:0x242c2c,thick:true},
{id:'b26_sportbike',label:'Red fully-faired sport motorcycle',kind:'sport',color:0xe42a27,thick:true},
{id:'b27_cruiser',label:'Chrome-and-red cruiser motorcycle',kind:'cruiser',color:0x9b262b,thick:true},
{id:'b28_delivery_moped',label:'Small delivery moped with top box',kind:'moped',color:0x54636e,carrier:true},
{id:'b29_standup_escooter',label:'Black stand-up electric scooter',kind:'kick',color:0x24282b,electric:true,wheel:.16},
{id:'b30_seated_escooter',label:'Compact seated electric scooter',kind:'scooter',color:0x454a50,electric:true,wheel:.23}
];
const mat=(c:number,metal=.1,rough=.65)=>new THREE.MeshStandardMaterial({color:c,metalness:metal,roughness:rough});
const rubber=mat(0x16191b),steel=mat(0x8b9297,.75,.3),dark=mat(0x25292d,.4),seatMat=mat(0x181a1c),glass=mat(0x525e67,.2,.25),lamp=mat(0xe2d9b0);
export function createBikeAsset(id:string):THREE.Group{
 const s=BIKE_ASSETS.find(a=>a.id===id);if(!s)throw Error('Unknown bike: '+id);
 const g=new THREE.Group();g.name=id;const paint=mat(s.color,.28,.38),accent=mat(s.accent||s.color,.25,.4);
 const line=(a:number[],b:number[],r:number,m:THREE.Material=paint)=>{
  const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),d=q.clone().sub(p);
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,d.length(),10),m);
  mesh.position.copy(p.add(q).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());g.add(mesh);return mesh;
 };
 const block=(w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material=paint)=>{
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);g.add(mesh);return mesh;
 };
 const disk=(r:number,depth:number,x:number,y:number,z:number,m:THREE.Material)=>{
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,depth,24),m);
  mesh.rotation.x=Math.PI/2;mesh.position.set(x,y,z);g.add(mesh);return mesh;
 };
 const wheel=(x:number,r:number,thick:boolean)=>{
  const tyre=new THREE.Mesh(new THREE.TorusGeometry(r,.021*(thick?1.9:1),9,48),rubber);
  tyre.position.set(x,r,0);g.add(tyre);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(r-.031,.008,7,48),steel);rim.position.set(x,r,0);g.add(rim);
  disk(.034,.055,x,r,0,dark);
  for(let i=0;i<20;i++){const t=i*Math.PI/10;
    line([x,r,.006],[x+Math.cos(t)*(r-.035),r+Math.sin(t)*(r-.035),.006],.0016,steel);
  }
  if(thick)for(let i=0;i<28;i++){const t=i*Math.PI/14;
    const a=x+Math.cos(t)*(r+.016),b=r+Math.sin(t)*(r+.016);
    block(.027,.009,.054,a,b,0,rubber);
  }
 };
 const moto=['surron','dirt','supermoto','sport','cruiser','moped','scooter'].includes(s.kind);
 const kick=s.kind==='kick';
 const r=s.wheel|| (moto?.355:.345);
 const rearX=moto?-.64:-.57,frontX=moto?.69:.57,cy=r;
 wheel(rearX,r,!!s.thick);wheel(frontX,r,!!s.thick);
 if(kick){
   block(1.08,.055,.20,0,.17,0,dark);
   line([frontX,.17,0],[frontX,1.18,0],.022,dark);
   line([frontX-.19,1.18,0],[frontX+.19,1.18,0],.018,steel);
   block(.30,.07,.11,-.29,.21,0,paint);
   block(.09,.10,.14,-.28,.16,0,dark);
 }else if(moto){
   const h=moto?1.04:.92;
   // Motorcycles have a long sloping chassis, engine, rear swingarm and telescopic forks.
   line([rearX,cy,0],[-.21,.53,0],.036,dark);
   line([-.21,.53,0],[.20,.69,0],.044,paint);
   line([.20,.69,0],[frontX,cy,0],.033,steel);
   line([.20,.69,0],[.38,h,0],.036,paint);
   line([.38,h,0],[frontX,cy,0],.027,steel);
   line([-.24,.53,0],[-.32,.98,0],.030,paint);
   block(.58,.10,.27,-.22,.99,0,seatMat);
   disk(.20,.18,-.15,.57,0,dark);
   disk(.105,.20,-.15,.57,.01,steel);
   block(.40,.30,.20,.07,.79,0,accent);
   line([.28,h,0],[.49,h+.04,0],.022,dark);
   line([.49,h+.04,-.25],[.49,h+.04,.25],.018,steel);
   block(.24,.025,.19,.43,.99,0,paint);
   if(['surron','dirt','supermoto'].includes(s.kind)){
      block(.52,.065,.21,-.18,1.00,0,seatMat);
      block(.42,.10,.19,.19,.84,0,paint);
      block(.24,.04,.19,frontX-.09,.80,0,paint);
      block(.18,.18,.08,.45,1.07,0,accent);
      for(const z of [-.10,.10])line([.39,1.02,z],[frontX,cy,z],.012,steel);
   }
   if(s.kind==='sport'){
      block(.60,.42,.29,.34,.80,0,paint);
      block(.26,.26,.30,.56,.94,0,accent);
      block(.25,.23,.025,.52,1.09,0,glass);
      block(.36,.07,.26,-.43,1.01,0,seatMat);
   }
   if(s.kind==='cruiser'){
      block(.47,.20,.29,.00,.78,0,paint);
      block(.38,.07,.29,-.48,.86,0,seatMat);
      line([.38,.98,0],[.40,1.27,0],.025,steel);
      line([.40,1.27,-.33],[.40,1.27,.33],.018,steel);
      for(const z of [-.16,.16])line([-.30,.50,z],[.18,.47,z],.028,steel);
   }
   if(s.kind==='moped'||s.kind==='scooter'){
      block(.44,.43,.25,.40,.66,0,paint);
      block(.45,.07,.29,-.37,.91,0,seatMat);
      block(.40,.04,.26,.05,.40,0,dark);
      if(s.carrier)block(.40,.28,.33,-.75,1.06,0,dark);
   }
   if(s.electric){
      block(.30,.34,.20,-.04,.78,0,dark);
      block(.22,.24,.018,-.04,.78,.112,paint);
   }
   // Disc brakes and front headlamp for roadgoing models.
   for(const x of [rearX,frontX])disk(r*.25,.009,x,cy,.045,steel);
   if(['sport','cruiser','moped','scooter','supermoto'].includes(s.kind))disk(.06,.06,frontX-.10,1.02,0,lamp);
 }else{
   // Bicycle diamond/step-through frames are deliberately different from motorbikes.
   const bb=[-.12,.47,0],seat=[-.20,.96,0],head=[.32,1.04,0];
   line([rearX,cy,0],bb,.018,paint);
   line(bb,head,.019,paint);
   line(head,[frontX,cy,0],.022,steel);
   if(['step','rental'].includes(s.kind)){
     line([rearX,cy,0],seat,.019,paint);
     line(bb,[.08,.61,0],.019,paint);
     line([.08,.61,0],head,.019,paint);
   }else if(s.kind==='fold'){
     line([rearX,cy,0],[-.10,.77,0],.018,paint);
     line([-.10,.77,0],head,.024,paint);
     disk(.045,.025,-.05,.80,0,steel);
   }else{
     line([rearX,cy,0],seat,.018,paint);
     line(seat,head,.018,paint);
     line(seat,bb,.019,paint);
   }
   // Fork, steering stem, handlebar and saddle.
   line(head,[.38,1.18,0],.015,steel);
   line([.21,1.19,0],[.53,1.19,0],.015,dark);
   line([-.20,.96,0],[-.23,1.12,0],.015,steel);
   block(.24,.045,.19,-.24,1.14,0,seatMat);
   disk(.105,.019,bb[0],bb[1],0,steel);
   for(const z of [-.11,.11]){
     line([bb[0],bb[1],z],[bb[0]+.14,bb[1]-.11,z],.012,dark);
     block(.11,.018,.055,bb[0]+.16,bb[1]-.11,z,dark);
   }
   if(s.kind==='road'){for(const z of [-.14,.14])line([.48,1.20,z],[.52,1.06,z],.014,dark)}
   if(s.kind==='bmx'){line([.28,1.13,0],[.40,1.36,0],.015,steel);line([.13,1.36,0],[.65,1.36,0],.015,dark)}
   if(s.kind==='tandem'){
     line([-.42,.94,0],[-.45,1.12,0],.015,steel);block(.20,.04,.18,-.45,1.14,0,seatMat);
     line([-.48,.92,0],[-.33,1.10,0],.017,paint);
   }
   if(s.kind==='cargo'){
     block(.52,.055,.36,rearX-.05,.98,0,dark);
     for(const z of [-.18,.18])line([rearX-.35,.98,z],[rearX+.20,.98,z],.010,steel);
   }
   if(s.basket){
     const bx=s.kind==='rental'?frontX+.07:frontX+.09;
     block(.30,.14,.31,bx,.91,0,s.kind==='rental'?paint:dark);
     for(let i=0;i<5;i++)line([bx-.13+i*.065,.85,.16],[bx-.13+i*.065,.98,.16],.003,steel);
   }
   if(s.carrier){
     block(.42,.018,.30,rearX,.93,0,steel);
     for(const z of [-.13,.13])line([rearX,.93,z],[rearX,cy,z],.008,steel);
   }
   if(s.fender)for(const x of [rearX,frontX]){
     const curve=new THREE.EllipseCurve(0,0,r+.043,r+.043,Math.PI*.15,Math.PI*.86,false,0);
     const pts=curve.getPoints(32).map(p=>new THREE.Vector3(x+p.x,cy+p.y,0));
     const mesh=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),32,.012,6,false),dark);g.add(mesh);
   }
   if(s.electric){
     block(.09,.35,.12,.01,.77,0,dark);
     disk(.07,.10,rearX,cy,0,dark);
   }
 }
 // Ground alignment and stable metadata for later asset placement.
 g.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(g);
 for(const child of g.children)child.position.y-=bounds.min.y;
 g.userData={id:s.id,label:s.label,kind:s.kind,collection:'SFUK_30_Bikes',status:'pending-review',units:'metres',prototype:true,gameplayIntegrated:false};
 return g;
}
