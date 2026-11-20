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

/** V5 clean rebuild. No previous geometry layers are reused. */
export function createBikeAsset(id:string):THREE.Group {
 const s=BIKE_ASSETS.find(x=>x.id===id);if(!s)throw new Error('Unknown asset '+id);
 const g=new THREE.Group();g.name=id;
 const paint=mat(s.color,.22,.45),accent=mat(s.accent??s.color,.22,.45),black=mat(0x171a1d),grey=mat(0x434a50),silver=mat(0xaab0b4,.65,.35),rotor=mat(0x90999c,.7,.3),red=mat(0xa82a2a),white=mat(0xd4d4c5);
 const motor=['surron','dirt','supermoto','sport','cruiser','moped','scooter'].includes(s.kind),kick=s.kind==='kick';
 const isBmx=s.kind==='bmx',isTandem=s.kind==='tandem',isCargo=s.kind==='cargo';
 const R=s.wheel??(motor?.35:.34),rear=isTandem?-1.10:isCargo?-.80:isBmx?-.43:motor?-.65:-.58,front=isTandem?.94:isCargo?.80:isBmx?.43:motor?.68:.58;
 const tube=(a:number[],b:number[],radius:number,m:THREE.Material=paint)=>{
  const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),d=q.clone().sub(p);
  const obj=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,d.length(),10),m);
  obj.position.copy(p.clone().add(q).multiplyScalar(.5));obj.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());g.add(obj);return obj;
 };
 const box=(w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material)=>{
  const obj=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);obj.position.set(x,y,z);g.add(obj);return obj;
 };
 const disk=(r:number,depth:number,x:number,y:number,z:number,m:THREE.Material)=>{
  const obj=new THREE.Mesh(new THREE.CylinderGeometry(r,r,depth,24),m);obj.rotation.x=Math.PI/2;obj.position.set(x,y,z);g.add(obj);return obj;
 };
 const route=(pts:number[][],radius:number,m:THREE.Material=black)=>{
  const curve=new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p)),false,'centripetal');
  const obj=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(18,pts.length*10),radius,8,false),m);g.add(obj);return obj;
 };
 const shell=(points:number[][],width:number,m:THREE.Material)=>{
  const shape=new THREE.Shape();shape.moveTo(points[0][0],points[0][1]);
  for(let i=1;i<points.length;i++)shape.lineTo(points[i][0],points[i][1]);shape.closePath();
  const obj=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:width,bevelEnabled:true,bevelSize:.008,bevelThickness:.007,bevelSegments:2}),m);
  obj.position.z=-width/2;g.add(obj);return obj;
 };
 const saddle=(x:number,y:number,length:number,width:number)=>{
  shell([[x-length*.50,y-.012],[x-length*.45,y+.027],[x-length*.12,y+.044],[x+length*.43,y+.027],[x+length*.50,y],[x+length*.36,y-.022]],width,seatMat);
 };
 const wheel=(x:number,r:number)=>{
  const fat=s.kind==='fat',wide=motor||s.thick;
  const tor=new THREE.Mesh(new THREE.TorusGeometry(r,.016*(fat?2.6:wide?1.7:1),10,48),rubber);tor.position.set(x,r,0);g.add(tor);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(r-.035,.008,7,48),silver);rim.position.set(x,r,0);g.add(rim);
  for(let i=0;i<28;i++){const t=i*Math.PI/14;tube([x,r,.012],[x+Math.cos(t)*(r-.036),r+Math.sin(t)*(r-.036),.012],.0013,silver)}
  disk(.027,.055,x,r,0,grey);
  disk(r*(motor?.24:.17),.008,x,r,.047,rotor);
  if(s.thick)for(let i=0;i<34;i++){const t=i*Math.PI/17;const p=x+Math.cos(t)*(r+.017),y=r+Math.sin(t)*(r+.017);const k=box(.024,.009,fat?.11:.055,p,y,0,rubber);k.rotation.z=t}
 };
 wheel(rear,R);wheel(front,R);
 const forkTop=motor?[.36,1.05,0]:[isBmx?.27:.32,isBmx?.94:1.02,0];
 const fork=(thickness=.018)=>{
  for(const z of [-.075,.075])tube([forkTop[0],forkTop[1],z],[front,R+.04,z],thickness,motor?silver:grey);
  const stemHeight=isBmx?.22:motor?.14:.13;
  tube([forkTop[0],forkTop[1],0],[forkTop[0]+.035,forkTop[1]+stemHeight,0],.016,silver);
  const handleY=forkTop[1]+stemHeight;
  tube([forkTop[0]-.17,handleY,0],[forkTop[0]+.18,handleY,0],.013,black);
 };
 if(kick){
  box(.94,.055,.17,-.04,.20,0,grey);box(.78,.012,.14,-.04,.232,0,black);
  tube([front,R,0],[front,1.18,0],.022,grey);
  tube([front-.18,1.18,0],[front+.18,1.18,0],.016,black);
  box(.08,.035,.05,front,1.20,0,black);
  route([[front-.15,1.19,-.06],[front-.02,1.12,-.06],[front,.8,-.05],[front,.32,-.05],[.38,.21,-.06],[rear+.04,R+.04,-.06]],.0027);
  box(.055,.035,.045,rear+.04,R+.04,-.06,black);
 } else if(!motor){
  const seatX=isTandem?-.34:isBmx?-.14:-.22, seatY=isBmx?.90:1.08,bbX=isTandem?-.33:isBmx?-.12:-.12,bbY=isBmx?.37:.45;
  const topY=isBmx?.78:1.00,headX=isBmx?.27:.30;
  // Explicit frame geometry per family: no generic overlays.
  if(isTandem){
   const rearBB=-.82,frontBB=-.12;
   tube([rear,R,0],[rearBB,.46,0],.019);tube([rearBB,.46,0],[-.86,1.02,0],.019);
   tube([-.86,1.02,0],[frontBB,1.02,0],.018);tube([frontBB,1.02,0],[headX,1.02,0],.018);
   tube([frontBB,.46,0],[headX,1.02,0],.019);tube([rearBB,.46,0],[frontBB,.46,0],.019);
   tube([-.86,1.02,0],[frontBB,.46,0],.017);
   for(const x of [rearBB,frontBB]){disk(.075,.018,x,.46,.08,grey);saddle(x-.06,1.13,.22,.15);tube([x-.06,1.01,0],[x-.06,1.12,0],.013,silver);tube([x,.46,.11],[x+.11,.38,.11],.012,silver);box(.10,.016,.055,x+.12,.38,.11,black)}
   tube([rearBB,.46,.10],[frontBB,.46,.10],.008,black);
   tube([-.89,1.15,0],[-.65,1.15,0],.013,black);
  }else if(s.kind==='step'||s.kind==='rental'){
   tube([rear,R,0],[seatX,.97,0],.019);
   tube([rear,R,0],[bbX,bbY,0],.019);
   tube([bbX,bbY,0],[headX,.99,0],.019);
   route([[seatX,.94,0],[-.08,.64,0],[.10,.60,0],[headX,.99,0]],.019,paint);
   tube([seatX,.97,0],[seatX,1.08,0],.013,silver);
  }else if(s.kind==='fold'){
   tube([rear,R,0],[-.10,.72,0],.020);
   tube([-.10,.72,0],[headX,.99,0],.024);
   tube([rear,R,0],[bbX,bbY,0],.017);
   tube([bbX,bbY,0],[-.10,.72,0],.017);
   disk(.038,.03,-.10,.72,.02,silver);
  }else{
   tube([rear,R,0],[seatX,topY,0],.018);
   tube([rear,R,0],[bbX,bbY,0],.018);
   tube([seatX,topY,0],[headX,topY,0],.018);
   tube([seatX,topY,0],[bbX,bbY,0],.018);
   tube([bbX,bbY,0],[headX,topY,0],.020);
   if(s.full){
    tube([rear,R,.07],[-.22,.68,.07],.017,grey);
    tube([-.22,.68,.07],[.04,.87,.07],.013,silver);
    route([[-.20,.69,.08],[-.14,.75,.08],[-.05,.82,.08]],.014,black);
   }
  }
  fork();
  if(!isTandem){tube([seatX,topY,0],[seatX-.02,seatY+.03,0],.013,silver);saddle(seatX-.05,seatY+.035,isBmx?.18:.23,isBmx?.12:.16)}
  disk(.09,.018,bbX,bbY,.08,grey);
  tube([rear,R,.085],[bbX,bbY+.07,.085],.0035,black);
  tube([rear,R,.085],[bbX,bbY-.07,.085],.0035,black);
  tube([bbX,bbY,.10],[bbX+.11,bbY-.10,.10],.013,silver);
  box(.10,.014,.06,bbX+.13,bbY-.10,.10,black);
  if(isBmx){
   // BMX has one raised handlebar assembly; pegs belong on axles, not the frame.
   for(const x of [rear,front])tube([x,R,.08],[x,R,.19],.013,silver);
  }
  if(s.kind==='road'){
   for(const z of [-.12,.12])route([[headX+.12,1.21,z],[headX+.24,1.19,z],[headX+.23,1.07,z]],.011,black);
  }
  if(s.electric){
   // Battery is a single down-tube mounted pack, not duplicate rectangular layers.
   if(s.kind==='rental'){
    shell([[-.12,.53],[-.035,.53],[.22,.90],[.14,.95]],.085,grey);
    box(.13,.11,.11,headX,.99,0,black);
    disk(.08,.10,rear,R,0,grey);
   }else{
    shell([[-.12,.53],[-.045,.53],[.22,.91],[.15,.96]],.085,grey);
   }
  }
  if(s.basket){
   // Basket is supported by two struts; rear of basket is attached to the steering head.
   const bx=front+.03,by=.90;
   box(.27,.012,.25,bx,by-.08,0,grey);
   for(const z of [-.12,.12]){box(.27,.14,.010,bx,by,z,s.kind==='rental'?paint:grey);tube([headX,.93,z],[bx,by-.08,z],.010,silver);tube([front,R+.17,z],[bx,by-.08,z],.008,silver)}
   for(const x of [bx-.135,bx+.135])box(.012,.14,.25,x,by,0,s.kind==='rental'?paint:grey);
  }
  if(s.carrier){
   // Rack height is just above rear tyre, and rack legs meet rear axle.
   const rackY=R*2+.095;
   box(.37,.015,.26,rear,rackY,0,grey);
   for(const z of [-.12,.12]){tube([rear-.14,rackY,z],[rear,R,z],.009,silver);tube([rear+.14,rackY,z],[rear,R,z],.009,silver)}
  }
  if(s.kind==='cargo'&&s.id==='b14_delivery_cargo'){
   box(.42,.24,.32,rear-.07,R*2+.23,0,paint);
  }
  if(s.fender){
   for(const x of [rear,front])route(Array.from({length:16},(_,i)=>{const t=.14*Math.PI+i/15*.73*Math.PI;return [x+Math.cos(t)*(R+.045),R+Math.sin(t)*(R+.045),0]}),.010,grey);
  }
  // Routed brake cables: two endpoints at physical calipers, not dangling in space.
  const cableStartY=forkTop[1]+(isBmx?.22:.13);
  route([[headX+.12,cableStartY,-.12],[headX+.15,cableStartY-.06,-.10],[headX+.12,.89,-.085],[front-.035,R+.12,-.07]],.0025);
  route([[headX-.10,cableStartY,.11],[headX-.14,cableStartY-.07,.09],[seatX,topY+.03,.075],[rear+.05,R+.12,.06]],.0023);
  box(.045,.04,.03,front-.035,R+.12,-.07,black);
  box(.045,.04,.03,rear+.05,R+.12,.06,black);
 }else{
  // Motorcycle chassis: mechanical structure first, then non-overlapping body shells.
  for(const z of [-.095,.095]){
   tube([rear,R,z],[-.18,.53,z],.024,grey);
   tube([-.18,.53,z],[.18,.76,z],.027,paint);
   tube([.18,.76,z],[forkTop[0],forkTop[1],z],.024,paint);
  }
  fork(.023);
  disk(.15,.17,-.12,.55,0,grey);
  disk(.09,.18,-.12,.55,.012,silver);
  if(s.kind==='surron'||s.kind==='dirt'||s.kind==='supermoto'){
   // Dirt-bike silhouette: raised narrow tail, sloping saddle, slim angular shrouds.
   saddle(-.30,1.03,.48,.19);
   shell([[-.53,.89],[-.40,1.01],[-.06,1.01],[.12,.91],[-.02,.86]],.14,paint);
   shell([[-.13,.74],[.12,.76],[.31,.92],[.14,.97],[-.17,.89]],.14,accent);
   shell([[.40,.75],[.61,.77],[.77,.73],[.55,.82]],.12,paint);
   shell([[.38,.96],[.52,.96],[.52,1.09],[.38,1.09]],.095,accent);
   if(s.electric){
    shell([[-.23,.59],[.03,.57],[.20,.82],[.03,.94],[-.19,.82]],.18,grey);
    for(const z of [-.12,.12])tube([-.24,.60,z],[.14,.93,z],.012,paint);
   }else{
    box(.24,.25,.20,-.07,.68,0,grey);
    route([[-.15,.55,.13],[.05,.50,.13],[.32,.65,.13]],.018,silver);
   }
  }else if(s.kind==='sport'){
   saddle(-.33,1.00,.34,.25);saddle(-.59,1.055,.19,.20);
   shell([[-.48,.60],[-.28,.49],[.26,.50],[.67,.72],[.59,1.01],[.24,1.04],[-.12,.87]],.28,paint);
   shell([[.22,.71],[.47,.77],[.52,.89],[.26,.88]],.012,black);
   shell([[.46,.94],[.69,.89],[.62,1.07],[.52,1.13]],.22,accent);
   shell([[.49,1.07],[.60,1.20],[.67,1.12]],.018,glass);
  }else if(s.kind==='cruiser'){
   saddle(-.42,.84,.36,.27);
   const tank=new THREE.Mesh(new THREE.SphereGeometry(1,24,12),paint);tank.scale.set(.27,.105,.17);tank.position.set(.00,.84,0);g.add(tank);
   shell([[-.20,.66],[-.09,.78],[.14,.76],[.25,.64],[.09,.59]],.14,grey);
   shell([[-.82,.61],[-.76,.78],[-.56,.85],[-.41,.76]],.20,paint);
   for(const z of [-.15,.15])route([[-.25,.51,z],[.01,.42,z],[.31,.44,z],[.54,.47,z]],.022,silver);
   disk(.075,.05,.46,1.03,.02,silver);disk(.06,.006,.46,1.03,.05,white);
  }else{
   saddle(-.37,.92,.47,.27);
   // Step-through moped / seated e-scooter with attached shield and footboard.
   shell([[.26,.42],[.47,.48],[.53,.87],[.43,1.08],[.34,1.08],[.24,.75]],.23,paint);
   box(.62,.05,.24,-.02,.42,0,grey);
   shell([[-.47,.65],[-.35,.90],[-.12,.92],[.00,.77],[-.22,.59]],.22,paint);
   if(s.carrier){
    box(.33,.025,.30,-.65,.96,0,silver);
    for(const z of [-.12,.12])tube([-.65,.96,z],[rear,R+.10,z],.009,silver);
    box(.32,.24,.29,-.66,1.09,0,black);
   }
   if(s.electric)box(.32,.15,.16,-.03,.49,0,grey);
  }
  // Front and rear brakes follow fork and swingarm, terminating at calipers.
  route([[.47,1.17,-.15],[.57,1.12,-.14],[.56,.92,-.12],[front-.06,R+.11,-.10]],.0038);
  route([[.25,1.13,.12],[.16,.98,.12],[-.13,.60,.12],[rear+.07,R+.09,.11]],.003);
  box(.06,.06,.05,front-.06,R+.11,-.10,black);
  box(.06,.05,.05,rear+.07,R+.09,.11,black);
 }
 // Preserve placement conventions; never mutate the previously approved assets.
 g.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(g);
 for(const obj of g.children)obj.position.y-=bounds.min.y;
 g.userData={id:s.id,label:s.label,kind:s.kind,collection:'SFUK_30_Bikes',status:'pending-review',units:'metres',prototype:true,polishVersion:6,gameplayIntegrated:false};
 return g;
}
