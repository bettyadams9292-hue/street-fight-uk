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
   // Saddle constructed below as tapered upholstered mesh.
   disk(.20,.18,-.15,.57,0,dark);
   disk(.105,.20,-.15,.57,.01,steel);
   block(.40,.30,.20,.07,.79,0,accent);
   line([.28,h,0],[.49,h+.04,0],.022,dark);
   line([.49,h+.04,-.25],[.49,h+.04,.25],.018,steel);
   block(.24,.025,.19,.43,.99,0,paint);
   if(['surron','dirt','supermoto'].includes(s.kind)){
      // Narrow motocross saddle is constructed below.
      block(.42,.10,.19,.19,.84,0,paint);
      block(.24,.04,.19,frontX-.09,.80,0,paint);
      block(.18,.18,.08,.45,1.07,0,accent);
      for(const z of [-.10,.10])line([.39,1.02,z],[frontX,cy,z],.012,steel);
   }
   if(s.kind==='sport'){
      block(.60,.42,.29,.34,.80,0,paint);
      block(.26,.26,.30,.56,.94,0,accent);
      block(.25,.23,.025,.52,1.09,0,glass);
      // Sport pillion seat is constructed below.
   }
   if(s.kind==='cruiser'){
      block(.47,.20,.29,.00,.78,0,paint);
      // Cruiser saddle is constructed below.
      line([.38,.98,0],[.40,1.27,0],.025,steel);
      line([.40,1.27,-.33],[.40,1.27,.33],.018,steel);
      for(const z of [-.16,.16])line([-.30,.50,z],[.18,.47,z],.028,steel);
   }
   if(s.kind==='moped'||s.kind==='scooter'){
      block(.44,.43,.25,.40,.66,0,paint);
      // Scooter saddle is constructed below.
      block(.40,.04,.26,.05,.40,0,dark);
      if(s.carrier)block(.40,.28,.33,-.75,1.06,0,dark);
   }
   if(s.electric){
      // Motorbike battery integrated into frame in V3.
      // Motorbike battery side cover integrated in V3.
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
   // Anatomical bicycle saddle is constructed below.
   disk(.105,.019,bb[0],bb[1],0,steel);
   for(const z of [-.11,.11]){
     line([bb[0],bb[1],z],[bb[0]+.14,bb[1]-.11,z],.012,dark);
     block(.11,.018,.055,bb[0]+.16,bb[1]-.11,z,dark);
   }
   if(s.kind==='road'){for(const z of [-.14,.14])line([.48,1.20,z],[.52,1.06,z],.014,dark)}
   if(s.kind==='bmx'){line([.28,1.13,0],[.40,1.36,0],.015,steel);line([.13,1.36,0],[.65,1.36,0],.015,dark)}
   if(s.kind==='tandem'){
     line([-.42,.94,0],[-.45,1.12,0],.015,steel);// Tandem rear saddle is constructed below.
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
     // E-bike battery aligned with frame in V3 assembly.
     disk(.07,.10,rearX,cy,0,dark);
   }
 }

 // V2 silhouette and mechanical-detail pass: bespoke assemblies for every category.
 const tyreGroove=mat(0x333639),chrome=mat(0xc0c7ca,.85,.23),brake=mat(0x767b7c,.65,.34),amber=mat(0xe1a046),tail=mat(0xb32c2d),meshMat=mat(0x555b5d,.35,.72);
 const sphere=(radius:number,x:number,y:number,z:number,m:THREE.Material)=>{
   const obj=new THREE.Mesh(new THREE.SphereGeometry(radius,12,10),m);obj.position.set(x,y,z);g.add(obj);return obj;
 };
 const curved=(points:number[][],radius:number,m:THREE.Material)=>{
   const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
   const obj=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(16,points.length*8),radius,7,false),m);g.add(obj);return obj;
 };
 const panel=(points:number[][],depth:number,m:THREE.Material)=>{
   const shape=new THREE.Shape();shape.moveTo(points[0][0],points[0][1]);
   for(let i=1;i<points.length;i++)shape.lineTo(points[i][0],points[i][1]);shape.closePath();
   const geom=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:.009,bevelThickness:.008,bevelSegments:2});
   const obj=new THREE.Mesh(geom,m);obj.position.z=-depth/2;g.add(obj);return obj;
 };
 // Wheel brakes, axle fasteners and sidewalls. Larger rotors on motorbikes.
 for(const x of [rearX,frontX]){
   disk(moto?r*.35:r*.22,.007,x,r,.044,brake);
   for(let i=0;i<8;i++){
     const t=i*Math.PI/4;
     disk(.006,.008,x+Math.cos(t)*r*(moto?.22:.14),r+Math.sin(t)*r*(moto?.22:.14),.051,dark);
   }
   disk(.022,.065,x,r,0,chrome);
   // Individual valve stem near the rim.
   line([x+r*.83,r+r*.33,.015],[x+r*.91,r+r*.36,.015],.003,dark);
 }
 if(!moto&&!kick){
   // Drivetrain: chainring, crank arms, rear sprocket and two chain runs.
   disk(.077,.014,-.12,.47,.087,dark);
   disk(.054,.017,rearX,r,.083,steel);
   line([rearX,r+.052,.088],[-.12,.47+.072,.088],.0035,dark);
   line([rearX,r-.052,.088],[-.12,.47-.072,.088],.0035,dark);
   for(const side of [-1,1]){
     line([-.12,.47,side*.10],[-.025,.36,side*.10],.011,chrome);
     block(.095,.016,.055,-.025,.36,side*.10,dark);
   }
   // Bowden brake and gear cables arc from the bar to the fork and frame.
   // Superseded by routed brake assembly in V4.
   // Superseded by routed brake assembly in V4.
   // Rear derailleur and chain tensioner on geared bikes.
   if(!['roadster','step','rental','bmx','fold'].includes(s.kind)){
     line([rearX,r,.084],[rearX-.05,r-.11,.084],.009,dark);
     disk(.022,.014,rearX-.05,r-.11,.084,steel);
   }
   // Rear brake, front brake and visible cable attachment points.
   block(.044,.038,.05,frontX-.04,r+.18,.05,dark);
   block(.044,.038,.05,rearX+.05,r+.17,.05,dark);
   if(s.old){
     // Aged paint, worn chain guard, traditional sprung saddle and bell.
     curved([[rearX+.12,r+.07,.11],[-.30,.37,.11],[-.10,.43,.11]],.013,paint);
     for(const x of [-.31,-.17])line([x,1.11,-.04],[x+.045,1.11,-.04],.009,steel);
     sphere(.026,.35,1.20,.04,chrome);
   }
   if(['mtb','fat'].includes(s.kind)||s.thick){
     // Knobbly tyres, fork crowns, twin suspension stanchions and disc calipers.
     for(const z of [-.065,.065]){
       line([.33,1.01,z],[frontX,r+.08,z],.014,chrome);
       line([.38,.89,z],[frontX,r+.10,z],.019,dark);
     }
     block(.18,.036,.16,.39,.91,0,dark);
   }
   if(s.full){
     // Exposed rear triangle and diagonal coil-over shock.
     line([rearX,r,-.07],[-.18,.73,-.07],.017,paint);
     line([rearX,r,.07],[-.18,.73,.07],.017,paint);
     line([-.17,.76,.07],[.05,.98,.07],.014,steel);
     for(let i=0;i<7;i++)sphere(.013,-.15+i*.025,.78+i*.026,.07,dark);
   }
   if(s.kind==='road'){
     // Curved drop bars and slim road calliper.
     for(const z of [-.13,.13])curved([[.40,1.19,z],[.56,1.18,z],[.58,1.10,z],[.51,1.07,z]],.011,dark);
   }
   if(s.kind==='bmx'){
     for(const x of [rearX,frontX])for(const z of [-.16,.16])line([x,r,z],[x,r,z+(z>0?.16:-.16)],.014,chrome);
     line([.19,1.33,0],[.56,1.33,0],.014,chrome);
   }
   if(s.kind==='fold'){
     disk(.041,.048,-.05,.80,.01,chrome);
     line([-.05,.76,.07],[-.05,.84,.07],.009,dark);
   }
   if(s.kind==='tandem'){
     disk(.073,.018,-.47,.47,.07,dark);
     line([-.47,.47,.07],[-.12,.47,.07],.0035,dark);
     line([-.47,.47,-.06],[-.47,.91,-.06],.018,paint);
   }
   if(s.kind==='cargo'){
     // Load-support rails and cargo platform, not just a floating slab.
     for(const z of [-.17,.17]){
       line([rearX-.27,.94,z],[rearX-.17,r+.08,z],.012,steel);
       line([rearX+.22,.94,z],[rearX+.11,r+.08,z],.012,steel);
     }
     if(s.id==='b14_delivery_cargo'){
       block(.47,.28,.33,rearX-.08,1.13,0,paint);
       block(.44,.016,.34,rearX-.08,1.28,0,dark);
     }else{
       for(const x of [rearX-.22,rearX+.20])line([x,.98,-.20],[x,1.16,-.20],.012,steel);
     }
   }
   if(s.kind==='rental'){
     // Shared-bike electronics and robust integrated basket.
     block(.14,.13,.10,.28,1.02,0,dark);
     // Rental battery housing integrated in V3.
     block(.07,.04,.055,.33,1.21,0,dark);
     disk(.075,.09,rearX,r,0,dark);
   }
   if(s.kind==='fat'){
     panel([[-.15,.54],[.04,.54],[.29,.95],[.17,1.04],[-.07,.84]],.17,paint);
     // Fat e-bike battery integrated below.
   }
   if(s.electric){
     // Charge socket and battery indicator.
     block(.038,.025,.009,.06,.85,.11,chrome);
     for(let i=0;i<4;i++)block(.008,.009,.002,.036+i*.011,.85,.118,paint);
   }
   if(s.kind==='roadster'||s.kind==='step'){
     // Traditional skirt guard / enclosed chaincase and dynamo light.
     panel([[rearX+.04,r+.04],[-.10,.40],[-.08,.49],[rearX+.05,r+.12]],.024,paint);
     disk(.047,.03,frontX-.10,1.06,.02,chrome);
     disk(.035,.004,frontX-.10,1.06,.042,lamp);
   }
 }
 if(moto){
   // Two actual fork tubes, triple clamps, engine cooling and rear suspension.
   for(const z of [-.105,.105]){
     line([.38,1.03,z],[frontX,r+.07,z],.014,chrome);
     line([.49,.82,z],[frontX,r+.08,z],.022,dark);
     line([rearX,r,z],[-.15,.60,z],.022,dark);
   }
   block(.22,.035,.29,.40,1.00,0,dark);
   for(let i=0;i<6;i++)line([-.31,.51+i*.024,.12],[-.02,.51+i*.024,.12],.004,steel);
   for(const z of [-.12,.12]){
     line([-.27,.60,z],[-.38,.89,z],.018,steel);
     for(let i=0;i<8;i++)sphere(.009,-.27-i*.012,.60+i*.035,z,dark);
   }
   // Foot pegs, rear brake, chain and sprockets.
   for(const z of [-.17,.17])line([-.17,.52,z],[-.17,.52,z+(z>0?.10:-.10)],.013,steel);
   disk(.09,.012,rearX,r,.105,steel);
   line([rearX,r+.065,.11],[-.17,.55,.11],.006,dark);
   line([rearX,r-.065,.11],[-.17,.47,.11],.006,dark);
   // Front brake discs with caliper.
   block(.07,.09,.055,frontX-.08,r+.07,.06,dark);
   if(['dirt','surron','supermoto'].includes(s.kind)){
     // Distinct angular side panels, raised front mudguard and rear number boards.
     panel([[-.27,.77],[.00,.72],[.30,.90],[.12,1.00],[-.19,.98]],.20,paint);
     panel([[-.48,.91],[-.15,.91],[-.07,1.04],[-.43,1.05]],.19,accent);
     curved([[.40,.82,0],[.59,.87,0],[.85,.80,0]],.022,paint);
     block(.17,.21,.018,.47,1.09,.10,accent);
     if(s.kind==='surron'){
       // Lightweight open frame and visible battery pack, not petrol engine.
       panel([[-.32,.63],[-.13,.54],[.23,.78],[.08,.95]],.10,paint);
       // Sur-Ron battery integrated in V3.
       for(let i=0;i<4;i++)line([-.15,.59+i*.07,.10],[.09,.59+i*.07,.10],.006,paint);
     }
     if(s.kind==='dirt'){
       block(.21,.24,.19,-.02,.67,0,dark);
       block(.29,.09,.23,.10,.82,0,accent);
       curved([[-.17,.56,.14],[.04,.53,.14],[.32,.68,.14]],.023,steel);
     }
     if(s.kind==='supermoto'){
       block(.27,.04,.24,.65,.77,0,paint);
       disk(.13,.012,frontX,r,.06,steel);
     }
   }
   if(s.kind==='sport'){
     // Layered side fairing with vent cutouts, tall screen and pointed nose.
     panel([[-.41,.67],[-.18,.49],[.28,.51],[.67,.73],[.57,.94],[.15,1.00],[-.22,.87]],.26,paint);
     panel([[.05,.68],[.35,.74],[.48,.90],[.19,.87]],.012,dark);
     panel([[.40,.87],[.70,.84],[.62,1.05],[.48,1.16]],.22,accent);
     panel([[.43,1.06],[.57,1.20],[.69,1.12]],.015,glass);
     for(const z of [-.145,.145])line([.38,1.11,z],[.46,1.13,z+(z>0?.12:-.12)],.009,dark);
     // Sport pillion seat constructed below.
     curved([[-.22,.49,.17],[-.04,.42,.17],[.27,.48,.17]],.023,dark);
   }
   if(s.kind==='cruiser'){
     // Wide teardrop tank, sweeping exhausts, large round headlamp and pannier.
     const tank=sphere(.25,.01,.84,0,paint);tank.scale.set(1.30,.55,.78);
     for(const z of [-.18,.18]){
       curved([[-.35,.53,z],[-.13,.40,z],[.22,.41,z],[.48,.44,z]],.026,chrome);
       block(.22,.23,.06,-.52,.70,z,paint);
     }
     disk(.11,.09,.46,1.04,0,chrome);
     disk(.085,.008,.46,1.04,.051,lamp);
     // Cruiser seat constructed below.
   }
   if(s.kind==='moped'||s.kind==='scooter'){
     // Step-through footwell, leg shield, integrated light and rear lamp.
     panel([[-.32,.39],[.17,.39],[.28,.53],[.09,.56],[-.30,.53]],.23,dark);
     panel([[.28,.48],[.54,.54],[.51,1.08],[.39,1.16],[.29,.90]],.25,paint);
     disk(.045,.02,.49,.96,.14,lamp);
     block(.10,.05,.06,-.78,.86,0,tail);
     if(s.kind==='scooter')block(.23,.18,.21,-.11,.69,0,dark);
   }
   // Rear lighting and indicators on roadgoing motorcycles.
   if(['sport','cruiser','moped','scooter','supermoto'].includes(s.kind)){
     block(.11,.035,.18,-.68,1.01,0,tail);
     for(const z of [-.20,.20])sphere(.023,-.64,1.00,z,amber);
   }
 }
 if(kick){
   // Stand-up e-scooter gets a properly narrow deck, cable, brake and display.
   block(.88,.014,.15,-.02,.209,0,tyreGroove);
   block(.22,.10,.17,-.29,.15,0,dark);
   // Superseded by routed brake assembly in V4.
   block(.10,.025,.07,frontX,1.21,0,dark);
   block(.045,.004,.025,frontX,1.226,0,glass);
   disk(.035,.025,frontX,1.08,.015,lamp);
   block(.065,.027,.08,-.45,.23,0,tail);
   line([-.31,.16,-.09],[-.42,.035,-.11],.009,steel);
 }
 // Model-specific trim and distinguishing hardware for all 30 variants.
 const mark=mat(s.old?0x6b6256:0xd5d8d8,.3,.55);
 if(!kick){
   for(const z of [-.115,.115]){
     if(s.kind==='roadster'||s.kind==='step')block(.07,.025,.009,-.22,.90,z,mark);
     if(s.kind==='mtb'||s.kind==='fat')block(.11,.025,.010,-.10,.83,z,mark);
   }
 }


 // V3 orientation and silhouette correction.
 // This model uses X as vehicle length, Y as vertical, Z as width.
 // The wheels spin about Z; batteries and bodywork must follow X/Y frame planes.
 const smoothSeat=(points:number[][],width:number,height:number,material:THREE.Material)=>{
   const sh=new THREE.Shape();sh.moveTo(points[0][0],points[0][1]);
   for(let i=1;i<points.length;i++)sh.lineTo(points[i][0],points[i][1]);
   sh.closePath();
   const geo=new THREE.ExtrudeGeometry(sh,{depth:width,steps:1,bevelEnabled:true,bevelThickness:height*.20,bevelSize:height*.20,bevelSegments:3});
   const ob=new THREE.Mesh(geo,material);ob.position.z=-width/2;g.add(ob);return ob;
 };
 const batteryBetween=(corners:number[][],width:number)=>{
   // Side-profile extruded across Z: no vertical floating battery boxes.
   const body=panel(corners,width,dark);
   const centreX=corners.reduce((v,p)=>v+p[0],0)/corners.length,centreY=corners.reduce((v,p)=>v+p[1],0)/corners.length;
   const inset=corners.map(([x,y])=>[centreX+(x-centreX)*.87,centreY+(y-centreY)*.87]);
   const cover=panel(inset,.009,paint);cover.position.z=width/2+.002;
   return body;
 };
 const wire=(points:number[][],radius=.0028)=>{
   // Cable is routed along steering head and frame, not across the wheel openings.
   curved(points,radius,dark);
 };
 if(!kick&&!moto){
   // Traditional nose and wider rear of bicycle saddle, oriented along X.
   smoothSeat([[-.37,1.143],[-.35,1.168],[-.23,1.178],[-.12,1.155],[-.14,1.132],[-.32,1.130]],.135,.032,seatMat);
   if(s.kind==='tandem')smoothSeat([[-.57,1.142],[-.54,1.165],[-.45,1.170],[-.36,1.15],[-.39,1.127]],.13,.03,seatMat);
   if(s.electric){
     if(s.kind==='rental'){
       // Battery follows the low down-tube with a rear hub motor.
       batteryBetween([[-.16,.55],[-.075,.55],[.19,.94],[.105,.96]],.13);
       disk(.087,.12,rearX,r,0,dark);
     }else if(s.kind==='fat'){
       batteryBetween([[-.10,.57],[.09,.58],[.24,.89],[.11,.99],[-.01,.87]],.17);
     }else{
       batteryBetween([[-.18,.53],[-.085,.52],[.29,.98],[.21,1.035]],.115);
     }
     // Charging port on side of battery, not disconnected in mid-air.
     disk(.013,.009,.04,.77,.10,steel);
   }
   // Keep brake lines near the steering head and fork.
   // Superseded by routed brake assembly in V4.
   // Saddle under-rails and seat clamp.
   for(const z of [-.045,.045])line([-.32,1.126,z],[-.19,1.127,z],.005,steel);
   block(.06,.018,.09,-.23,1.115,0,dark);
 }
 if(moto){
   // Motorbike seating follows the tank and tail, rather than boxy floating pads.
   if(s.kind==='sport'){
     smoothSeat([[-.53,1.018],[-.48,1.060],[-.30,1.07],[-.18,1.020],[-.20,.99],[-.48,.99]],.24,.045,seatMat);
     smoothSeat([[-.72,1.068],[-.68,1.103],[-.52,1.106],[-.48,1.066]],.20,.035,seatMat);
   }else if(s.kind==='cruiser'){
     smoothSeat([[-.59,.87],[-.54,.93],[-.34,.95],[-.17,.90],[-.23,.85],[-.54,.84]],.27,.055,seatMat);
   }else if(s.kind==='moped'||s.kind==='scooter'){
     smoothSeat([[-.58,.90],[-.55,.97],[-.29,.98],[-.12,.94],[-.14,.89]],.26,.048,seatMat);
   }else{
     smoothSeat([[-.53,1.00],[-.49,1.048],[-.08,1.05],[.13,1.015],[.13,.98],[-.46,.97]],.18,.037,seatMat);
   }
   if(s.electric){
     if(s.kind==='surron'){
       // Sur-Ron-like battery is slanted inside an open cradle frame.
       batteryBetween([[-.26,.60],[-.07,.57],[.22,.82],[.10,.95],[-.16,.86]],.18);
       for(const z of [-.12,.12]){
         line([-.30,.61,z],[.12,.95,z],.014,paint);
         line([-.30,.61,z],[.23,.80,z],.012,paint);
       }
     }else if(s.kind==='dirt'){
       batteryBetween([[-.19,.56],[.13,.58],[.24,.86],[.03,.96],[-.20,.80]],.19);
     }else if(s.kind==='scooter'){
       batteryBetween([[-.18,.45],[.17,.45],[.17,.66],[-.18,.66]],.19);
     }
   }
   if(s.kind==='sport'){
     // Fairing nose and belly share a continuous aerodynamic silhouette.
     panel([[-.37,.57],[.19,.47],[.58,.62],[.79,.84],[.64,1.03],[.34,1.04],[.09,.86],[-.30,.79]],.25,paint);
     panel([[.22,.70],[.44,.76],[.55,.87],[.28,.86]],.012,dark);
     panel([[.48,.95],[.73,.92],[.64,1.06],[.53,1.12]],.024,accent);
     curved([[-.20,.55,.17],[.03,.51,.17],[.25,.55,.17]],.020,dark);
   }else if(s.kind==='cruiser'){
     // Teardrop tank, sweeping rear mudguard and lower exposed engine.
     const tank=sphere(.20,.04,.84,0,paint);tank.scale.set(1.45,.67,1.02);
     panel([[-.81,.60],[-.80,.75],[-.58,.88],[-.37,.83],[-.40,.71]],.22,paint);
     for(const z of [-.15,.15])curved([[-.26,.52,z],[.00,.41,z],[.35,.43,z],[.55,.49,z]],.019,chrome);
   }else if(s.kind==='dirt'||s.kind==='surron'||s.kind==='supermoto'){
     // Long narrow mudguard, sharply rising tank shrouds and tail.
     panel([[-.57,.91],[-.47,1.05],[-.08,1.04],[.12,.96],[.04,.89]],.17,accent);
     panel([[-.10,.74],[.16,.78],[.33,.97],[.07,1.02],[-.20,.91]],.17,paint);
     curved([[.39,.85,0],[.61,.89,0],[.88,.83,0]],.018,paint);
   }else{
     // Scooter leg shield is a vertical side-profile, with a real footwell.
     panel([[.27,.41],[.50,.45],[.57,.86],[.47,1.10],[.36,1.12],[.26,.78]],.23,paint);
     panel([[-.36,.40],[.24,.40],[.29,.47],[-.32,.48]],.22,dark);
   }
   // Cable loops are constrained to the handlebar and fork, not free-floating.
   // Superseded by routed brake assembly in V4.
   // Superseded by routed brake assembly in V4.
 }
 if(kick){
   // Battery is fully inside deck, not attached to the steering pole.
   block(.72,.035,.14,-.02,.164,0,dark);
   // Superseded by routed brake assembly in V4.
 }


 // V4 mechanical review: one brake-hose system per vehicle, with actual endpoints.
 // All paths use the side of the frame (Z) and terminate at their respective calipers.
 const brakeCable=(pts:number[][],r=.0032)=>{
   const p=pts.map(v=>new THREE.Vector3(v[0],v[1],v[2]));
   const curve=new THREE.CatmullRomCurve3(p,false,'centripetal',.35);
   const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(20,p.length*12),r,7,false),rubber);
   g.add(mesh);
 };
 if(kick){
   // Rear drum/disc brake routed from the left lever down the stem then along the deck.
   brakeCable([[frontX-.12,1.20,-.09],[frontX-.02,1.14,-.08],[frontX+.025,.95,-.06],[frontX+.02,.36,-.06],[.43,.20,-.07],[-.31,.19,-.08],[rearX+.05,r+.035,-.07]],.0027);
   block(.06,.025,.05,rearX+.05,r+.04,-.07,dark);
 }else if(moto){
   // Hydraulic front brake: master cylinder -> slack loop -> fork guide -> caliper.
   brakeCable([[.46,1.085,-.22],[.55,1.12,-.18],[.59,1.01,-.13],[.54,.88,-.13],[.60,.70,-.12],[frontX-.065,r+.12,-.10]],.004);
   // Rear brake line follows the swingarm rather than crossing the engine or fairings.
   brakeCable([[-.17,.54,-.12],[-.30,.49,-.13],[-.48,.43,-.12],[rearX+.07,r+.07,-.10]],.0033);
   block(.065,.065,.046,frontX-.07,r+.11,-.10,dark);
   block(.065,.05,.042,rearX+.07,r+.07,-.10,dark);
   // Clutch/throttle wiring follows the headstock and top of the engine.
   brakeCable([[.41,1.08,.19],[.36,1.13,.14],[.28,1.01,.11],[.20,.85,.12],[.03,.78,.12]],.0025);
 }else{
   // Front brake Bowden cable with a steering slack loop and secured fork route.
   brakeCable([[.43,1.19,-.13],[.51,1.23,-.11],[.54,1.13,-.09],[.47,.98,-.075],[.50,.80,-.068],[frontX-.04,r+.18,-.063]],.0025);
   // Rear brake follows the top tube and seat stay. It never cuts across the wheel.
   const rearPath=s.kind==='step'||s.kind==='rental'?
     [[.23,1.17,.09],[.14,1.11,.08],[-.03,.85,.075],[-.24,.75,.068],[-.40,.56,.063],[rearX+.06,r+.16,.062]]:
     [[.23,1.17,.09],[.12,1.17,.075],[-.16,1.00,.07],[-.27,.86,.065],[-.41,.62,.063],[rearX+.06,r+.16,.062]];
   brakeCable(rearPath,.0023);
   block(.05,.04,.034,frontX-.04,r+.18,-.063,dark);
   block(.05,.04,.034,rearX+.06,r+.16,.062,dark);
   // Clip hardware keeps cables against the frame and fork.
   for(const p of [[.47,.98,-.075],[-.27,.86,.065]])sphere(.008,p[0],p[1],p[2],steel);
 }
 // Brake calipers now share the same wheel-side plane as the cables.
 // Frame-side battery connector has a short wire run into the controller.
 if(s.electric&&!kick){
   const z=moto?.14:.105;
   const batteryPort=moto?[-.02,.67,z]:[.04,.76,z];
   const controller=moto?[-.16,.56,z]:[-.12,.54,z];
   brakeCable([batteryPort,[batteryPort[0]-.05,batteryPort[1]-.09,z],controller],.003);
 }

 // Ground alignment and stable metadata for later asset placement.
 g.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(g);
 for(const child of g.children)child.position.y-=bounds.min.y;
 g.userData={id:s.id,label:s.label,kind:s.kind,collection:'SFUK_30_Bikes',status:'pending-review',units:'metres',prototype:true,polishVersion:4,gameplayIntegrated:false};
 return g;
}
