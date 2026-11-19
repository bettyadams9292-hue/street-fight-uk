import * as THREE from 'three';
export const ASSETS=[{"id":"f01_01","name":"Tall bookcase","category":"Shelving & storage","kind":0,"variant":0},{"id":"f01_02","name":"Low bookcase","category":"Shelving & storage","kind":0,"variant":1},{"id":"f01_03","name":"Corner bookcase","category":"Shelving & storage","kind":0,"variant":2},{"id":"f01_04","name":"Ladder shelf","category":"Shelving & storage","kind":0,"variant":3},{"id":"f01_05","name":"Floating shelf trio","category":"Shelving & storage","kind":0,"variant":4},{"id":"f01_06","name":"Cube shelving","category":"Shelving & storage","kind":0,"variant":5},{"id":"f01_07","name":"Industrial shelving","category":"Shelving & storage","kind":0,"variant":6},{"id":"f01_08","name":"Warehouse rack","category":"Shelving & storage","kind":0,"variant":7},{"id":"f01_09","name":"Retail gondola","category":"Shelving & storage","kind":0,"variant":8},{"id":"f01_10","name":"Retail wall bay","category":"Shelving & storage","kind":0,"variant":9},{"id":"f01_11","name":"Glass display shelf","category":"Shelving & storage","kind":0,"variant":10},{"id":"f01_12","name":"Oak wall unit","category":"Shelving & storage","kind":0,"variant":11},{"id":"f01_13","name":"Walnut wall unit","category":"Shelving & storage","kind":0,"variant":12},{"id":"f01_14","name":"Media shelf","category":"Shelving & storage","kind":0,"variant":13},{"id":"f01_15","name":"Alcove shelf","category":"Shelving & storage","kind":0,"variant":14},{"id":"f01_16","name":"Pantry shelving","category":"Shelving & storage","kind":0,"variant":15},{"id":"f01_17","name":"Kitchen open shelving","category":"Shelving & storage","kind":0,"variant":16},{"id":"f01_18","name":"Metal utility rack","category":"Shelving & storage","kind":0,"variant":17},{"id":"f01_19","name":"Shoe rack","category":"Shelving & storage","kind":0,"variant":18},{"id":"f01_20","name":"Wine rack","category":"Shelving & storage","kind":0,"variant":19},{"id":"f01_21","name":"Magazine shelf","category":"Shelving & storage","kind":0,"variant":20},{"id":"f01_22","name":"Children's bookcase","category":"Shelving & storage","kind":0,"variant":21},{"id":"f01_23","name":"Library bookcase","category":"Shelving & storage","kind":0,"variant":22},{"id":"f01_24","name":"Modular storage grid","category":"Shelving & storage","kind":0,"variant":23},{"id":"f01_25","name":"Bathroom shelf","category":"Shelving & storage","kind":0,"variant":24},{"id":"f01_26","name":"Under-stair storage","category":"Shelving & storage","kind":0,"variant":25},{"id":"f01_27","name":"Display plinth shelf","category":"Shelving & storage","kind":0,"variant":26},{"id":"f01_28","name":"Pegboard storage","category":"Shelving & storage","kind":0,"variant":27},{"id":"f01_29","name":"Back-bar shelf","category":"Shelving & storage","kind":0,"variant":28},{"id":"f01_30","name":"Narrow hallway shelf","category":"Shelving & storage","kind":0,"variant":29},{"id":"f02_01","name":"Round dining table","category":"Tables & desks","kind":1,"variant":0},{"id":"f02_02","name":"Rectangular dining table","category":"Tables & desks","kind":1,"variant":1},{"id":"f02_03","name":"Extendable dining table","category":"Tables & desks","kind":1,"variant":2},{"id":"f02_04","name":"Drop-leaf table","category":"Tables & desks","kind":1,"variant":3},{"id":"f02_05","name":"Square bistro table","category":"Tables & desks","kind":1,"variant":4},{"id":"f02_06","name":"Farmhouse table","category":"Tables & desks","kind":1,"variant":5},{"id":"f02_07","name":"Pedestal table","category":"Tables & desks","kind":1,"variant":6},{"id":"f02_08","name":"Oval dining table","category":"Tables & desks","kind":1,"variant":7},{"id":"f02_09","name":"Coffee table","category":"Tables & desks","kind":1,"variant":8},{"id":"f02_10","name":"Lift-top coffee table","category":"Tables & desks","kind":1,"variant":9},{"id":"f02_11","name":"Nesting tables","category":"Tables & desks","kind":1,"variant":10},{"id":"f02_12","name":"Glass coffee table","category":"Tables & desks","kind":1,"variant":11},{"id":"f02_13","name":"Side table","category":"Tables & desks","kind":1,"variant":12},{"id":"f02_14","name":"Bedside table","category":"Tables & desks","kind":1,"variant":13},{"id":"f02_15","name":"Console table","category":"Tables & desks","kind":1,"variant":14},{"id":"f02_16","name":"Hallway table","category":"Tables & desks","kind":1,"variant":15},{"id":"f02_17","name":"Writing desk","category":"Tables & desks","kind":1,"variant":16},{"id":"f02_18","name":"Office desk","category":"Tables & desks","kind":1,"variant":17},{"id":"f02_19","name":"L-shaped desk","category":"Tables & desks","kind":1,"variant":18},{"id":"f02_20","name":"Standing desk","category":"Tables & desks","kind":1,"variant":19},{"id":"f02_21","name":"Computer desk","category":"Tables & desks","kind":1,"variant":20},{"id":"f02_22","name":"Dressing table","category":"Tables & desks","kind":1,"variant":21},{"id":"f02_23","name":"Breakfast bar","category":"Tables & desks","kind":1,"variant":22},{"id":"f02_24","name":"Folding table","category":"Tables & desks","kind":1,"variant":23},{"id":"f02_25","name":"Workshop table","category":"Tables & desks","kind":1,"variant":24},{"id":"f03_01","name":"Two-door wardrobe","category":"Cabinets & cupboards","kind":2,"variant":0},{"id":"f03_02","name":"Three-door wardrobe","category":"Cabinets & cupboards","kind":2,"variant":1},{"id":"f03_03","name":"Sliding wardrobe","category":"Cabinets & cupboards","kind":2,"variant":2},{"id":"f03_04","name":"Mirrored wardrobe","category":"Cabinets & cupboards","kind":2,"variant":3},{"id":"f03_05","name":"Tall linen cupboard","category":"Cabinets & cupboards","kind":2,"variant":4},{"id":"f03_06","name":"Low sideboard","category":"Cabinets & cupboards","kind":2,"variant":5},{"id":"f03_07","name":"Long sideboard","category":"Cabinets & cupboards","kind":2,"variant":6},{"id":"f03_08","name":"Welsh dresser","category":"Cabinets & cupboards","kind":2,"variant":7},{"id":"f03_09","name":"Display cabinet","category":"Cabinets & cupboards","kind":2,"variant":8},{"id":"f03_10","name":"Glass-front cabinet","category":"Cabinets & cupboards","kind":2,"variant":9},{"id":"f03_11","name":"TV cabinet","category":"Cabinets & cupboards","kind":2,"variant":10},{"id":"f03_12","name":"Media console","category":"Cabinets & cupboards","kind":2,"variant":11},{"id":"f03_13","name":"Chest of drawers","category":"Cabinets & cupboards","kind":2,"variant":12},{"id":"f03_14","name":"Tallboy drawers","category":"Cabinets & cupboards","kind":2,"variant":13},{"id":"f03_15","name":"Bedside cabinet","category":"Cabinets & cupboards","kind":2,"variant":14},{"id":"f03_16","name":"Kitchen base cabinet","category":"Cabinets & cupboards","kind":2,"variant":15},{"id":"f03_17","name":"Kitchen wall cabinet","category":"Cabinets & cupboards","kind":2,"variant":16},{"id":"f03_18","name":"Kitchen corner cabinet","category":"Cabinets & cupboards","kind":2,"variant":17},{"id":"f03_19","name":"Kitchen pantry cabinet","category":"Cabinets & cupboards","kind":2,"variant":18},{"id":"f03_20","name":"Bathroom vanity","category":"Cabinets & cupboards","kind":2,"variant":19},{"id":"f03_21","name":"Medicine cabinet","category":"Cabinets & cupboards","kind":2,"variant":20},{"id":"f03_22","name":"Filing cabinet","category":"Cabinets & cupboards","kind":2,"variant":21},{"id":"f03_23","name":"Metal locker cabinet","category":"Cabinets & cupboards","kind":2,"variant":22},{"id":"f03_24","name":"Utility cupboard","category":"Cabinets & cupboards","kind":2,"variant":23},{"id":"f03_25","name":"Shoe cabinet","category":"Cabinets & cupboards","kind":2,"variant":24},{"id":"f03_26","name":"Hall cupboard","category":"Cabinets & cupboards","kind":2,"variant":25},{"id":"f03_27","name":"Drinks cabinet","category":"Cabinets & cupboards","kind":2,"variant":26},{"id":"f03_28","name":"Corner display cabinet","category":"Cabinets & cupboards","kind":2,"variant":27},{"id":"f03_29","name":"Apothecary drawers","category":"Cabinets & cupboards","kind":2,"variant":28},{"id":"f03_30","name":"Record cabinet","category":"Cabinets & cupboards","kind":2,"variant":29},{"id":"f04_01","name":"Dining chair oak","category":"Chairs & armchairs","kind":3,"variant":0},{"id":"f04_02","name":"Dining chair upholstered","category":"Chairs & armchairs","kind":3,"variant":1},{"id":"f04_03","name":"Dining chair metal","category":"Chairs & armchairs","kind":3,"variant":2},{"id":"f04_04","name":"Dining chair Windsor","category":"Chairs & armchairs","kind":3,"variant":3},{"id":"f04_05","name":"Dining chair ladderback","category":"Chairs & armchairs","kind":3,"variant":4},{"id":"f04_06","name":"Dining chair spindle","category":"Chairs & armchairs","kind":3,"variant":5},{"id":"f04_07","name":"Dining chair modern","category":"Chairs & armchairs","kind":3,"variant":6},{"id":"f04_08","name":"Dining chair bentwood","category":"Chairs & armchairs","kind":3,"variant":7},{"id":"f04_09","name":"Office task chair","category":"Chairs & armchairs","kind":3,"variant":8},{"id":"f04_10","name":"Office executive chair","category":"Chairs & armchairs","kind":3,"variant":9},{"id":"f04_11","name":"Office mesh chair","category":"Chairs & armchairs","kind":3,"variant":10},{"id":"f04_12","name":"Swivel chair","category":"Chairs & armchairs","kind":3,"variant":11},{"id":"f04_13","name":"Gaming chair","category":"Chairs & armchairs","kind":3,"variant":12},{"id":"f04_14","name":"Tub chair","category":"Chairs & armchairs","kind":3,"variant":13},{"id":"f04_15","name":"Wingback armchair","category":"Chairs & armchairs","kind":3,"variant":14},{"id":"f04_16","name":"Club armchair","category":"Chairs & armchairs","kind":3,"variant":15},{"id":"f04_17","name":"Recliner","category":"Chairs & armchairs","kind":3,"variant":16},{"id":"f04_18","name":"Accent armchair","category":"Chairs & armchairs","kind":3,"variant":17},{"id":"f04_19","name":"Chesterfield armchair","category":"Chairs & armchairs","kind":3,"variant":18},{"id":"f04_20","name":"Rocking chair","category":"Chairs & armchairs","kind":3,"variant":19},{"id":"f04_21","name":"Kitchen stool","category":"Chairs & armchairs","kind":3,"variant":20},{"id":"f04_22","name":"Breakfast bar stool","category":"Chairs & armchairs","kind":3,"variant":21},{"id":"f04_23","name":"Padded bar stool","category":"Chairs & armchairs","kind":3,"variant":22},{"id":"f04_24","name":"Folding chair","category":"Chairs & armchairs","kind":3,"variant":23},{"id":"f04_25","name":"Occasional chair","category":"Chairs & armchairs","kind":3,"variant":24},{"id":"f05_01","name":"Two-seater sofa","category":"Sofas & seating","kind":4,"variant":0},{"id":"f05_02","name":"Three-seater sofa","category":"Sofas & seating","kind":4,"variant":1},{"id":"f05_03","name":"Four-seater sofa","category":"Sofas & seating","kind":4,"variant":2},{"id":"f05_04","name":"L sofa left chaise","category":"Sofas & seating","kind":4,"variant":3},{"id":"f05_05","name":"L sofa right chaise","category":"Sofas & seating","kind":4,"variant":4},{"id":"f05_06","name":"L sofa left corner","category":"Sofas & seating","kind":4,"variant":5},{"id":"f05_07","name":"L sofa right corner","category":"Sofas & seating","kind":4,"variant":6},{"id":"f05_08","name":"U-shaped sectional","category":"Sofas & seating","kind":4,"variant":7},{"id":"f05_09","name":"Modular sofa 3-piece","category":"Sofas & seating","kind":4,"variant":8},{"id":"f05_10","name":"Modular sofa 5-piece","category":"Sofas & seating","kind":4,"variant":9},{"id":"f05_11","name":"Chesterfield sofa","category":"Sofas & seating","kind":4,"variant":10},{"id":"f05_12","name":"Leather sofa","category":"Sofas & seating","kind":4,"variant":11},{"id":"f05_13","name":"Velvet sofa","category":"Sofas & seating","kind":4,"variant":12},{"id":"f05_14","name":"Fabric sofa","category":"Sofas & seating","kind":4,"variant":13},{"id":"f05_15","name":"Low-profile sofa","category":"Sofas & seating","kind":4,"variant":14},{"id":"f05_16","name":"High-back sofa","category":"Sofas & seating","kind":4,"variant":15},{"id":"f05_17","name":"Sofa bed","category":"Sofas & seating","kind":4,"variant":16},{"id":"f05_18","name":"Futon sofa","category":"Sofas & seating","kind":4,"variant":17},{"id":"f05_19","name":"Loveseat","category":"Sofas & seating","kind":4,"variant":18},{"id":"f05_20","name":"Chaise longue","category":"Sofas & seating","kind":4,"variant":19},{"id":"f05_21","name":"Corner loveseat","category":"Sofas & seating","kind":4,"variant":20},{"id":"f05_22","name":"Ottoman bench","category":"Sofas & seating","kind":4,"variant":21},{"id":"f05_23","name":"Storage ottoman","category":"Sofas & seating","kind":4,"variant":22},{"id":"f05_24","name":"Window bench","category":"Sofas & seating","kind":4,"variant":23},{"id":"f05_25","name":"Hallway bench","category":"Sofas & seating","kind":4,"variant":24},{"id":"f06_01","name":"Single bed","category":"Bedroom & miscellaneous","kind":5,"variant":0},{"id":"f06_02","name":"Small double bed","category":"Bedroom & miscellaneous","kind":5,"variant":1},{"id":"f06_03","name":"Double bed","category":"Bedroom & miscellaneous","kind":5,"variant":2},{"id":"f06_04","name":"King bed","category":"Bedroom & miscellaneous","kind":5,"variant":3},{"id":"f06_05","name":"Super king bed","category":"Bedroom & miscellaneous","kind":5,"variant":4},{"id":"f06_06","name":"Bunk bed","category":"Bedroom & miscellaneous","kind":5,"variant":5},{"id":"f06_07","name":"Loft bed","category":"Bedroom & miscellaneous","kind":5,"variant":6},{"id":"f06_08","name":"Daybed","category":"Bedroom & miscellaneous","kind":5,"variant":7},{"id":"f06_09","name":"Upholstered headboard","category":"Bedroom & miscellaneous","kind":5,"variant":8},{"id":"f06_10","name":"Wooden headboard","category":"Bedroom & miscellaneous","kind":5,"variant":9},{"id":"f06_11","name":"Bedside drawer unit","category":"Bedroom & miscellaneous","kind":5,"variant":10},{"id":"f06_12","name":"Dressing stool","category":"Bedroom & miscellaneous","kind":5,"variant":11},{"id":"f06_13","name":"Bedroom storage bench","category":"Bedroom & miscellaneous","kind":5,"variant":12},{"id":"f06_14","name":"Hall coat stand","category":"Bedroom & miscellaneous","kind":5,"variant":13},{"id":"f06_15","name":"Entryway shoe bench","category":"Bedroom & miscellaneous","kind":5,"variant":14}];
const palette=[0xa77a50,0x77533d,0xc3aa88,0x454b52,0xe5ded0,0x51645b,0x8b5151,0x2c3540,0xb6a088,0x8a7d6b];
export function createAsset(id:string):THREE.Group {
 const spec=ASSETS.find(a=>a.id===id);if(!spec)throw Error('Unknown furniture '+id);
 const g=new THREE.Group(),v=spec.variant,k=spec.kind;
 const wood=new THREE.MeshStandardMaterial({color:palette[v%palette.length],roughness:.78});
 const trim=new THREE.MeshStandardMaterial({color:0x322e2b,roughness:.63,metalness:.2});
 const steel=new THREE.MeshStandardMaterial({color:0x6c777c,roughness:.4,metalness:.65});
 const cloth=new THREE.MeshStandardMaterial({color:palette[(v+4)%palette.length],roughness:.94});
 const glass=new THREE.MeshPhysicalMaterial({color:0xc5e0e3,transparent:true,opacity:.28,roughness:.08,metalness:0,depthWrite:false});
 const cushion=new THREE.MeshStandardMaterial({color:palette[(v+6)%palette.length],roughness:.95});
 function b(w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material=wood){const q=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);q.position.set(x,y,z);q.castShadow=true;q.receiveShadow=true;g.add(q);return q}
 function cyl(r:number,h:number,x:number,y:number,z:number,m:THREE.Material=wood){const q=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,20),m);q.position.set(x,y,z);q.castShadow=true;g.add(q);return q}
 function rod(a:number[],c:number[],r:number,m:THREE.Material=steel){const p=new THREE.Vector3(a[0],a[1],a[2]),q=new THREE.Vector3(c[0],c[1],c[2]);const d=q.clone().sub(p);const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,d.length(),10),m);mesh.position.copy(p.add(q).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());g.add(mesh)}
 function legs(w:number,d:number,h:number,m:THREE.Material=wood){for(const x of [-w/2+.09,w/2-.09])for(const z of [-d/2+.09,d/2-.09])b(.07,h,.07,x,h/2,z,m)}
 function handle(x:number,y:number,z:number){b(.14,.025,.035,x,y,z,steel);cyl(.022,.045,x-.06,y,z+.02,steel);cyl(.022,.045,x+.06,y,z+.02,steel)}
 function shelves(w:number,h:number,d:number,count:number,mat:THREE.Material=wood){for(const x of [-w/2,w/2])b(.065,h,d,x,h/2,0,mat);for(let i=0;i<=count;i++)b(w+.07,.045,d,0,.045+i*(h-.09)/count,0,mat);b(w,.035,.03,0,h/2,-d/2,trim)}
 if(k===0){const w= v%5===2?.85:1.3,h=v%6===4?1.05:1.95,d=.32+(v%3)*.07; shelves(w,h,d,v%4+3,v%5===2?steel:wood);
  if([2,9,16,25,27].includes(v)){for(let i=0;i<4;i++)b(.035,h*.8,.035,-w/2+i*w/3,h*.52,d/2+.02,steel)}
  if([6,7,17].includes(v)){for(let y=.18;y<h;y+=.4)rod([-w/2,y,-d/2],[w/2,y,d/2],.012,steel)}
  if([10,27].includes(v)){for(let i=0;i<3;i++)b(w*.25,.38,.012,-w*.29+i*w*.29,.45,d/2+.01,glass)}
  if([19,28].includes(v)){for(let i=0;i<7;i++)cyl(.038,.22,-w*.37+i*w*.12,.32,d*.13,cushion)}
  if([5,23].includes(v))for(const x of [-w*.24,w*.24])for(const y of [.45,1.05,1.60])b(.025,.40,d*.8,x,y,0,trim);
 }
 if(k===1){const round=[0,4,6,12,13].includes(v),desk=v>=16&&v<=22,wide=[1,2,5,7,18,24].includes(v);const w=wide?1.75:desk?1.35:1.1,d=desk?.68:.75,h=v===8||v===9||v===10||v===11?.45:v===19?1.05:.76;
  if(round){cyl(w*.47,.07,0,h,0,wood);cyl(.095,h-.08,0,(h-.08)/2,0,trim);cyl(.34,.055,0,.045,0,trim)}
  else{b(w,.07,d,0,h,0);legs(w,d,h-.04,v%3===0?steel:wood)}
  if([2,3,9].includes(v))b(w*.75,.028,d*.72,0,h-.065,0,trim);
  if([8,9,10,11].includes(v))b(w*.7,.11,d*.6,0,h-.18,0,cloth);
  if(desk){b(w*.55,.10,.35,-w*.12,h-.16,-d*.13,trim);if(v===18)b(.70,.07,.70,w*.55,h,0,wood);if(v===21)b(.35,.25,.4,w*.28,h+.16,0,glass)}
  if(v===22)b(w*.58,.65,.035,0,h+.34,-d*.45,wood);
 }
 if(k===2){const w=[2,3,5,6,11,12].includes(v)?1.55:v%4===0?.70:1.15,h=v<5?2.05:v%5===0?1.80:1.05,d=v<5?.62:.47; b(w,h,d,0,h/2,0);
  b(w+.07,.055,d+.05,0,h+.025,0,trim);b(w+.07,.07,d+.06,0,.04,0,trim);
  if([12,13,14,28].includes(v)){const n=v===28?8:4;for(let i=0;i<n;i++){const y=.19+i*(h-.30)/n;b(w-.10,.028,.045,0,y,d/2+.02,trim);handle(0,y+.09,d/2+.06)}}
  else if([8,9,17,26].includes(v)){for(const x of [-w*.24,w*.24]){b(w*.46,h*.75,.012,x,h*.53,d/2+.012,glass);handle(x,h*.5,d/2+.04)}}
  else{b(.026,h*.85,.035,0,h*.52,d/2+.02,trim);for(const x of [-w*.25,w*.25])handle(x,h*.51,d/2+.05)}
  if([7,18,19,20].includes(v))b(w*.76,.08,.055,0,h*.18,d/2+.05,steel);
 }
 if(k===3){const office=v>=8&&v<=12,arm=v>=13&&v<=19,stool=v>=20&&v<=22;const w=arm?.85:office?.62:.50,seat=stool?.75:.46,d=arm?.73:.52;
  if(office){cyl(.075,.48,0,.26,0,steel);for(let i=0;i<5;i++){const a=i*Math.PI*2/5;rod([0,.09,0],[Math.sin(a)*.34,.08,Math.cos(a)*.34],.025,steel);cyl(.045,.05,Math.sin(a)*.34,.05,Math.cos(a)*.34,trim)}}
  else legs(w,d,seat-.08,v%4===2?steel:wood);
  b(w,.11,d,0,seat,0,arm||office?cloth:wood);
  if(!stool){b(w,.65,.105,0,seat+.35,-d/2+.03,arm||office?cloth:wood);b(w*.87,.32,.065,0,seat+.40,-d/2+.12,arm?cushion:cloth)}
  if(arm||office)for(const x of [-w/2+.035,w/2-.035]){b(.11,.22,d*.7,x,seat+.15,0,cloth);b(.10,.05,.31,x,seat+.27,0,trim)}
  if(v===19)for(const x of [-w*.4,w*.4])rod([x,.1,-d*.42],[x,.62,d*.3],.018,wood);
 }
 if(k===4){const isL=v>=3&&v<=6,isU=v===7,mod=v===8||v===9;const w=isL||isU||mod?2.65:v===0||v===18?1.55:2.1,d=.90,seat=.43;
  b(w,.14,d,0,seat,0,cloth);b(w,.64,.18,0,.86,-d/2+.05,cloth);
  for(const x of [-w/2+.10,w/2-.10])b(.19,.62,d,x,.62,0,cloth);
  const n=Math.max(2,Math.round(w/.56));
  for(let i=0;i<n;i++){const x=-w/2+(i+.5)*w/n;b(w/n-.035,.14,.67,x,.55,.08,cushion);b(w/n-.04,.40,.15,x,.94,-d/2+.17,cushion)}
  if(isL||isU||mod){const side=v===3||v===5?-1:1;const x=side*(w/2-.45);b(.88,.14,1.60,x,seat,.47,cloth);b(.79,.14,1.48,x,.55,.48,cushion);b(.18,.60,1.60,side*(w/2-.07),.70,.45,cloth);if(isU){b(.88,.14,1.60,-x,seat,.47,cloth);b(.79,.14,1.48,-x,.55,.48,cushion)}}
  if([10,11,12].includes(v)){for(let i=0;i<6;i++)for(const x of [-w/2+.18+i*(w-.36)/5])b(.024,.024,.025,x,.96,-d/2+.258,trim)}
  for(const x of [-w/2+.17,w/2-.17])for(const z of [-.30,.30])b(.09,.09,.09,x,.06,z,trim);
 }
 if(k===5){if(v<=9){const w=v===0?.98:v===1?1.20:v>=4?1.95:1.55,d=v===5?1.95:2.15;legs(w,d,.38);b(w,.19,d,0,.45,0,wood);b(w*.95,.17,d*.89,0,.61,0,cloth);b(w,.78,.10,0,.79,-d/2,wood);b(w*.88,.16,.36,0,.72,-d*.36,cushion);if(v===5){b(w,.14,d*.52,0,1.35,0,wood);for(const x of [-w/2+.07,w/2-.07])b(.08,1.45,.08,x,.75,0,wood)}}
  else if(v===13){cyl(.05,1.75,0,.90,0,wood);for(let i=0;i<6;i++){const a=i*Math.PI/3;rod([0,1.62,0],[Math.sin(a)*.31,1.76,Math.cos(a)*.31],.025,wood)}}
  else{b(1.1,.50,.45,0,.36,0,wood);b(1.05,.10,.42,0,.65,0,cloth);for(const x of [-.42,.42])b(.065,.65,.07,x,.35,.15,trim)}
 }

 // POLISH PASS: category-specific joinery, surface detail, structural fasteners,
 // material differentiation, and true variants. All decoration is attached to
 // the furniture's local coordinate frame; no world-space floating ornaments.
 const accent=new THREE.MeshStandardMaterial({color:0xc1a16d,roughness:.48,metalness:.4});
 const darkGlass=new THREE.MeshPhysicalMaterial({color:0x82969a,transparent:true,opacity:.4,roughness:.12,depthWrite:false});
 const edge=new THREE.MeshStandardMaterial({color:0x594b3d,roughness:.8});
 function bevelBox(w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material=wood,r=.012){
  const sh=new THREE.Shape();const hw=w/2,hh=h/2,rr=Math.min(r,w/5,h/5);
  sh.moveTo(-hw+rr,-hh);sh.lineTo(hw-rr,-hh);sh.quadraticCurveTo(hw,-hh,hw,-hh+rr);
  sh.lineTo(hw,hh-rr);sh.quadraticCurveTo(hw,hh,hw-rr,hh);
  sh.lineTo(-hw+rr,hh);sh.quadraticCurveTo(-hw,hh,-hw,hh-rr);
  sh.lineTo(-hw,-hh+rr);sh.quadraticCurveTo(-hw,-hh,-hw+rr,-hh);
  const geo=new THREE.ExtrudeGeometry(sh,{depth:d-rr*2,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:rr,bevelThickness:rr,curveSegments:3});
  geo.translate(0,0,-d/2+rr);
  const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;
 }
 function nail(x:number,y:number,z:number){const m=new THREE.Mesh(new THREE.SphereGeometry(.012,8,6),accent);m.position.set(x,y,z);g.add(m)}
 if(k===0){
  const w=v%5===2?.85:1.3,h=v%6===4?1.05:1.95,d=.32+(v%3)*.07;
  // Continuous front edge banding and screw heads: each belongs to a shelf.
  for(let i=0;i<=v%4+3;i++){const y=.045+i*(h-.09)/(v%4+3);bevelBox(w+.055,.018,.014,0,y,d/2+.007,edge,.004);for(const x of [-w/2+.08,w/2-.08])nail(x,y,d/2+.018)}
  for(const x of [-w/2+.04,w/2+.04]){bevelBox(.024,h-.11,.018,x,h/2,d/2+.013,edge,.005)}
  // Bookcase stock: angled spines, irregular heights and varied colours.
  if([0,1,3,11,12,19,21,22].includes(v)){
   const rows=v%4+3;for(let row=0;row<rows;row++){const y=.09+row*(h-.09)/rows;for(let j=0;j<8;j++){const x=-w*.40+j*w*.105;const bh=.15+(j*7+row*3)%5*.025;bevelBox(w*.075,bh,.19,x,y+bh/2,.005,j%3===0?cloth:j%3===1?wood:edge,.004)}}
  }
  if([6,7,16,17].includes(v)){for(let i=0;i<4;i++)b(w*.80,.018,.018,0,.18+i*.40,-d/2-.01,steel)}
 }
 if(k===1){
  const round=[0,4,6,12,13].includes(v),desk=v>=16&&v<=22,wide=[1,2,5,7,18,24].includes(v);
  const w=wide?1.75:desk?1.35:1.1,d=desk?.68:.75,h=v===8||v===9||v===10||v===11?.45:v===19?1.05:.76;
  if(!round){
   // Apron connects the legs instead of leaving an unsupported top.
   for(const z of [-d/2+.09,d/2-.09])b(w-.16,.095,.035,0,h-.11,z,wood);
   for(const x of [-w/2+.09,w/2-.09])b(.035,.095,d-.16,x,h-.11,0,wood);
   for(const x of [-w/2+.11,w/2-.11])nail(x,h-.11,d/2-.07);
   bevelBox(w-.035,.015,d-.035,0,h+.042,0,wood,.01);
  }else{cyl(.025,.025,0,h+.045,0,accent)}
  if(desk){for(let j=0;j<3;j++){const yy=h-.23+j*.055;b(.28,.012,.024,w*.22,yy,d/2-.035,edge);nail(w*.22,yy,d/2-.012)}}
  if([5,7].includes(v))for(const x of [-w*.33,w*.33])b(.016,.012,d*.8,x,h+.047,0,edge);
 }
 if(k===2){
  const w=[2,3,5,6,11,12].includes(v)?1.55:v%4===0?.70:1.15,h=v<5?2.05:v%5===0?1.80:1.05,d=v<5?.62:.47;
  // Door perimeter frame is inset to read as joinery, not a blank cuboid.
  for(const x of [-w/2+.07,w/2-.07])b(.026,h-.20,.023,x,h/2,d/2+.021,edge);
  for(const y of [.14,h-.11])b(w-.14,.025,.025,0,y,d/2+.021,edge);
  if(![12,13,14,28].includes(v)){
   const count=[8,9,17,26].includes(v)?2:2;
   for(let i=0;i<count;i++){const x=(i-.5)*w*.49;
    bevelBox(w*.39,h*.69,.015,x,h*.53,d/2+.027,[8,9,17,26].includes(v)?darkGlass:wood,.009);
    for(const yy of [h*.23,h*.83])b(w*.33,.013,.012,x,yy,d/2+.043,edge);
   }
  }
  if([15,16,17,18].includes(v)){for(let x=-w*.4;x<w*.45;x+=.19)b(.008,h*.5,.012,x,h*.55,d/2+.044,trim)}
  for(const x of [-w/2+.10,w/2-.10])for(const z of [-d/2+.10,d/2-.10])b(.06,.06,.06,x,.03,z,trim);
 }
 if(k===3){
  const office=v>=8&&v<=12,arm=v>=13&&v<=19,stool=v>=20&&v<=22,w=arm?.85:office?.62:.50,seat=stool?.75:.46,d=arm?.73:.52;
  bevelBox(w*.88,.07,d*.81,0,seat+.083,0,arm||office?cushion:wood,.025);
  if(!stool){bevelBox(w*.78,.48,.055,0,seat+.36,-d/2+.11,arm||office?cushion:wood,.015)}
  if(office){b(.075,.23,.05,0,.48,-d*.28,steel);for(const x of [-.23,.23])cyl(.035,.035,x,.08,.19,trim)}
  if(arm){for(const x of [-w/2+.03,w/2-.03])bevelBox(.11,.06,d*.65,x,seat+.30,0,cloth,.018)}
  if(stool){for(const z of [-d*.36,d*.36])rod([-w*.39,.27,z],[w*.39,.27,z],.016,steel)}
  if([3,4,5,6,7].includes(v))for(let i=0;i<5;i++){const x=-w*.35+i*w*.175;rod([x,seat+.48,-d/2+.09],[x,seat+.70,-d/2+.09],.014,wood)}
 }
 if(k===4){
  const isL=v>=3&&v<=6,isU=v===7,mod=v===8||v===9,w=isL||isU||mod?2.65:v===0||v===18?1.55:2.1;
  const n=Math.max(2,Math.round(w/.56));
  for(let i=0;i<n;i++){const x=-w/2+(i+.5)*w/n;
   // Separate piped cushion edges, inset seams and tufting.
   bevelBox(w/n-.07,.018,.58,x,.633,.075,cloth,.007);
   b(.009,.012,.53,x+(w/n-.09)/2,.648,.075,edge);
   for(const y of [.85,1.02])nail(x,y,-.39);
  }
  for(const x of [-w/2+.13,w/2-.13]){bevelBox(.17,.035,.74,x,.98,0,cloth,.014)}
  if(isL||isU||mod){const side=v===3||v===5?-1:1,x=side*(w/2-.45);
   for(let z=.04;z<1.18;z+=.37)bevelBox(.73,.018,.015,x,.635,z,cloth,.004);
  }
  if([10,11,12].includes(v)){for(let i=0;i<8;i++)nail(-w/2+.16+i*(w-.32)/7,.86,-.39)}
 }
 if(k===5){
  if(v<=9){const w=v===0?.98:v===1?1.20:v>=4?1.95:1.55,d=v===5?1.95:2.15;
   // Mattress piping, fitted duvet, and a pair of independent pillows.
   bevelBox(w*.91,.045,d*.82,0,.72,.02,cloth,.018);
   bevelBox(w*.86,.08,d*.52,0,.76,.25,cushion,.022);
   for(const x of [-w*.23,w*.23])bevelBox(w*.40,.10,.33,x,.77,-d*.31,cloth,.035);
   if(v===5){for(const x of [-w/2+.08,w/2-.08])rod([x,.84,-d*.48],[x,1.34,-d*.48],.022,steel)}
  }else if(v===13){for(let i=0;i<4;i++){const a=i*Math.PI/2;rod([0,.13,0],[Math.sin(a)*.38,.04,Math.cos(a)*.38],.026,wood)}}
  else{for(const x of [-.38,.38])b(.06,.33,.05,x,.22,.21,wood);bevelBox(.95,.04,.38,0,.72,0,cloth,.02)}
 }
 g.userData={id:spec.id,name:spec.name,category:spec.category,batch:'Interior Furniture Mega Pack',approved:false,reviewOnly:true,units:'metres'};
 return g;
}
