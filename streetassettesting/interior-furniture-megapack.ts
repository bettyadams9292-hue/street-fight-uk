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

 if(k===0){
  // Every shelf archetype is assembled independently: no shared box-case body.
  const h=[1.9,1.05,1.72,1.78,.9,1.48,1.82,2.15,1.48,2.05,1.6,1.88,1.88,.72,1.85,1.9,.9,1.8,.65,1.6,1.3,1.7,2.1,1.4,1.0,1.15,.75,1.75,1.6,1.7][v];
  const w=[1.12,1.32,1.05,1.0,1.1,1.4,1.48,1.82,1.22,1.55,1.1,1.72,1.72,1.65,.93,1.25,1.4,1.2,.88,.76,1.0,1.2,1.7,1.5,.75,1.2,.8,1.2,.95,1.4][v];
  const d=[.34,.36,.78,.39,.25,.35,.53,.68,.86,.46,.43,.39,.39,.38,.33,.49,.31,.46,.34,.34,.24,.34,.43,.38,.25,.58,.36,.30,.29,.40][v];
  const metal=[6,7,8,9,17,27].includes(v),mat=metal?steel:wood;
  const side=(x:number,y:number,z:number,hh:number,dd:number,m:THREE.Material=mat)=>b(.045,hh,dd,x,y,z,m);
  const plank=(y:number,ww=w,dd=d,zz=0,m:THREE.Material=mat)=>b(ww,.043,dd,0,y,zz,m);
  const post=(x:number,z:number,hh=h)=>b(.055,hh,.055,x,hh/2,z,metal?steel:wood);
  const books=(y:number,span=w)=>{for(let j=0;j<7;j++){const bh=.14+(j*3%5)*.023;const x=-span*.38+j*span*.125;b(span*.075,bh,.17,x,y+bh/2,.015,j%3===0?cloth:j%3===1?edge:wood)}};
  const closed=[0,1,11,12,13,14,21,22,23].includes(v);
  if(v===2){
   // Corner bookcase: two PERPENDICULAR wings, both open towards the room.
   const wing=.90,depth=.30;
   for(let i=0;i<5;i++){const y=.075+i*.40;
    b(wing,.044,depth,wing/2-wing*.5,y,-depth/2,wood);
    b(depth,.044,wing,-wing/2+depth/2,y,wing/2-wing*.5,wood);
   }
   for(const x of [-wing/2,wing/2])b(.045,h,.045,x,h/2,-depth+.02,wood);
   for(const z of [-wing/2,wing/2])b(.045,h,.045,-depth+.02,h/2,z,wood);
   b(.035,h,.035,-depth/2,h/2,-depth/2,trim);
  }else if(v===5||v===23){
   // True cube grid: uninterrupted full-height dividers and full-width shelves.
   const cols=v===5?3:4,rows=v===5?3:3,hh=h/rows;
   for(let i=0;i<=cols;i++)side(-w/2+i*w/cols,h/2,0,h,d);
   for(let j=0;j<=rows;j++)plank(.022+j*(h-.044)/rows);
   if(v===23)for(let i=0;i<cols;i++)for(let j=0;j<rows;j++)if((i+j)%3===0)b(w/cols-.055,hh-.05,.018,-w/2+(i+.5)*w/cols,(j+.5)*hh,d/2+.013,cloth);
  }else if(v===7||v===6||v===17){
   // Industrial shelving is OPEN: steel uprights, horizontal beams and braces.
   for(const x of [-w/2+.035,w/2-.035])for(const z of [-d/2+.035,d/2-.035])post(x,z);
   const n=v===7?5:4;
   for(let i=0;i<=n;i++){const y=.12+i*(h-.22)/n;plank(y,w-.10,d-.09,v===7?0:0,v===7?wood:steel);
    for(const z of [-d/2+.03,d/2-.03])b(w-.06,.065,.04,0,y-.045,z,steel)}
   for(const x of [-w/2+.03,w/2-.03])rod([x,.13,-d/2+.04],[x,h-.08,d/2-.04],.014,steel);
  }else if(v===9){
   // Retail wall bay: rear perforated standards, shelves project forward unobstructed.
   b(w,.055,d,0,.035,0,trim);
   b(w,h-.10,.035,0,h/2,-d/2+.02,cloth);
   for(const x of [-w*.38,0,w*.38]){b(.035,h-.15,.04,x,h/2,-d/2+.055,steel);
    for(let i=0;i<16;i++)b(.014,.024,.008,x,.17+i*(h-.35)/16,-d/2+.084,trim)}
   for(let i=0;i<5;i++){const y=.19+i*.39;plank(y,w-.09,d-.055,.035,wood);
    for(const x of [-w*.36,w*.36])rod([x,y-.02,-d/2+.05],[x,y-.15,d/2-.06],.012,steel)}
  }else if(v===8){
   // Double-sided freestanding shop gondola.
   b(w,1.15,.12,0,.73,0,cloth);
   for(const sideSign of [-1,1])for(let i=0;i<3;i++){const z=sideSign*(.20+i*.22);b(w-.07,.045,.22,0,.24+i*.37,z,wood)}
   for(const x of [-w/2+.04,w/2-.04])post(x,0,1.48);
   b(w,.07,d,0,.08,0,trim);
  }else if(v===3){
   // Leaning ladder shelf with slanted rear uprights.
   for(const x of [-w*.43,w*.43])rod([x,.06,d*.35],[x,h,-d*.32],.028,wood);
   for(let i=0;i<5;i++){const y=.20+i*.34,z=d*.29-(y/h)*d*.58;b(w-.13,.045,d*.65,0,y,z,wood)}
  }else if(v===4){
   // Three floating shelves, no side walls or back carcass.
   for(let i=0;i<3;i++){const y=.16+i*.33;b(w,.055,d,0,y,0,wood);
    for(const x of [-w*.36,w*.36]){b(.025,.14,.025,x,y-.07,-d*.34,steel)}}
  }else if(v===10||v===27){
   for(const x of [-w/2+.035,w/2-.035])for(const z of [-d/2+.035,d/2-.035])post(x,z);
   for(let i=0;i<5;i++)plank(.08+i*(h-.15)/4,w-.08,d-.08,0,glass);
   for(const x of [-w/2+.03,w/2-.03])b(.035,h,.035,x,h/2,d/2-.03,steel);
  }else if(v===18||v===19||v===20||v===28){
   for(const x of [-w/2+.035,w/2-.035])post(x,0);
   for(let i=0;i<5;i++)plank(.10+i*(h-.15)/4,w-.06,d-.04);
   if(v===18)for(let i=0;i<4;i++)for(const x of [-w*.30,0,w*.30])b(.20,.085,.25,x,.14+i*.14,0,trim);
   if(v===19)for(let i=0;i<5;i++)for(let j=0;j<4;j++)cyl(.036,.18,-w*.34+j*w*.22,.15+i*.29,0,cloth);
   if(v===20)for(let i=0;i<4;i++)b(w*.8,.04,.07,0,.20+i*.30,d/2,steel);
  }else if(v===25){
   // Stepped under-stair storage, each bay a different height.
   for(let i=0;i<4;i++){const hh=.36+i*.25,x=-w/2+(i+.5)*w/4;
    b(w/4-.015,.04,d,x,.06,0,wood);b(w/4-.015,.04,d,x,hh,0,wood);
    b(.04,hh,d,x+w/8,hh/2,0,wood);b(w/4-.06,hh-.10,.02,x,hh/2,d/2,cloth)}
  }else if(v===26){
   // Display plinth: low, broad and intentionally solid.
   b(w,.58,d,0,.29,0,wood);b(w+.09,.07,d+.09,0,.62,0,trim);b(w+.04,.045,d+.04,0,.035,0,wood);
  }else if(v===29){
   for(const x of [-w/2+.04,w/2-.04])post(x,0);
   for(let i=0;i<4;i++)plank(.12+i*.46,w-.06,d-.04);
   for(let i=0;i<3;i++)for(let j=0;j<5;j++)b(.15,.19,.18,-w*.36+j*w*.18,.21+i*.45,0,cloth);
  }else{
   // Domestic bookcases: side panels and shelves, not decorative front posts.
   for(const x of [-w/2+.025,w/2-.025])side(x,h/2,0,h,d,wood);
   b(w-.09,h-.06,.018,0,h/2,-d/2+.018,cloth);
   const n=[0,1,11,12,21,22].includes(v)?5:3;
   for(let i=0;i<=n;i++)plank(.045+i*(h-.09)/n,w-.06,d-.045,.015,wood);
   if(closed)for(let i=0;i<n;i++)books(.065+i*(h-.09)/n,w-.09);
   if(v===13){b(w*.72,.42,.035,0,.42,-d/2+.06,trim);b(w*.68,.36,.025,0,.42,-d/2+.032,glass)}
   if(v===14)for(const x of [-w/2+.07,w/2-.07])b(.045,h,.035,x,h/2,d/2-.03,wood);
   if(v===24)for(let i=0;i<4;i++)b(w-.13,.028,.035,0,.12+i*.23,d/2-.04,steel);
  }
 }
 if(k===1){const round=[0,4,6,12,13].includes(v),desk=v>=16&&v<=22,wide=[1,2,5,7,18,24].includes(v);const w=wide?1.75:desk?1.35:1.1,d=desk?.68:.75,h=v===8||v===9||v===10||v===11?.45:v===19?1.05:.76;
  if(round){cyl(w*.47,.07,0,h,0,wood);cyl(.095,h-.08,0,(h-.08)/2,0,trim);cyl(.34,.055,0,.045,0,trim)}
  else{b(w,.07,d,0,h,0);legs(w,d,h-.04,v%3===0?steel:wood)}
  if([2,3,9].includes(v))b(w*.75,.028,d*.72,0,h-.065,0,trim);
  if([8,9,10,11].includes(v))b(w*.7,.11,d*.6,0,h-.18,0,cloth);
  if(desk){b(w*.55,.10,.35,-w*.12,h-.16,-d*.13,trim);if(v===18)b(.70,.07,.70,w*.55,h,0,wood);if(v===21)b(.35,.25,.4,w*.28,h+.16,0,glass)}
  if(v===22)b(w*.58,.65,.035,0,h+.34,-d*.45,wood);
 }

 const accent=new THREE.MeshStandardMaterial({color:0xc1a16d,roughness:.48,metalness:.4});
 const darkGlass=new THREE.MeshPhysicalMaterial({color:0x82969a,transparent:true,opacity:.4,roughness:.12,depthWrite:false});
 const edge=new THREE.MeshStandardMaterial({color:0x594b3d,roughness:.8});
 // Dedicated second-generation construction for cabinetry, chairs and sofas.
 // Replaces their earlier primitive bodies instead of stacking extra lines on top.
 if(k===2){
  const tall=v<5||[4,24].includes(v),wide=[2,3,5,6,11,12,28].includes(v);
  const w=wide?1.52:[4,13,14,20,24].includes(v)?.72:1.10;
  const h=tall?2.02:[13,14,28].includes(v)?1.25:1.04;
  const d=tall?.60:[15,16,17,18].includes(v)?.59:.46;
  const face=d/2+.008,frame=.058,foot=.09;
  // Actual hollow cabinet shell, with interior void and inset back.
  for(const x of [-w/2+.025,w/2-.025])b(.05,h-foot,d,x,(h+foot)/2,0,wood);
  b(w,.05,d,0,h-.025,0,wood);b(w,.05,d,0,foot+.025,0,wood);
  b(w-.10,h-foot-.10,.025,0,(h+foot)/2,-d/2+.025,edge);
  for(const x of [-w/2+.09,w/2-.09])for(const z of [-d/2+.09,d/2-.09])b(.075,foot,.075,x,foot/2,z,trim);
  b(w+.035,.035,d+.035,0,h+.016,0,wood);
  const drawer=[12,13,14,28].includes(v),glassDoor=[8,9,17,26].includes(v),open=[7,18].includes(v);
  if(drawer){
   const n=v===28?8:v===12?4:5;
   for(let i=0;i<n;i++){const dh=(h-foot-.12)/n,y=foot+.09+(i+.5)*dh;
    b(w-.14,dh-.018,.035,0,y,face,wood);
    for(const x of [-w*.21,w*.21]){b(.12,.018,.022,x,y,face+.03,steel);for(const xx of [-.045,.045])cyl(.013,.026,x+xx,y,face+.043,accent)}
    b(w-.17,.012,.012,0,y+dh*.43,face+.027,edge);
   }
  }else if(open){
   for(let i=1;i<4;i++)b(w-.10,.04,d-.08,0,foot+i*(h-foot)/4,0,wood);
   for(let i=0;i<3;i++)for(const x of [-w*.28,0,w*.28])b(.14,.20,.24,x,foot+.15+i*(h-foot)/4,0,i%2?cloth:wood);
  }else{
   const n=wide?3:2,pw=(w-.13)/n;
   for(let i=0;i<n;i++){
    const x=-w/2+.065+(i+.5)*pw;
    // Four-piece door frame, genuinely recessed centre infill.
    b(pw-.015,.055,.040,x,h-.09,face,wood);
    b(pw-.015,.055,.040,x,foot+.08,face,wood);
    for(const xx of [-pw/2+.025,pw/2-.025])b(.050,h-foot-.21,.04,x+xx,(h+foot)/2,face,wood);
    b(pw-.12,h-foot-.27,.019,x,(h+foot)/2,face-.014,glassDoor?glass:cloth);
    b(.025,.105,.026,x+(i<n/2?pw*.27:-pw*.27),(h+foot)/2,face+.043,accent);
    for(const yy of [foot+.13,h-.12]){b(.026,.044,.018,x-pw/2+.03,yy,face+.047,steel)}
   }
   if([0,1,2,3].includes(v))b(w-.10,.022,.022,0,h*.53,face+.045,edge);
  }
  if([15,16,17,18].includes(v)){b(w-.09,.035,d-.08,0,h*.42,0,wood);b(w-.09,.035,d-.08,0,h*.72,0,wood)}
  if(v===3||v===9)for(const x of [-w*.24,w*.24])b(.025,h*.76,.025,x,h*.52,face+.056,steel);
 }
 if(k===3){
  const office=v>=8&&v<=12,arm=v>=13&&v<=19,stool=v>=20&&v<=22;
  const w=arm?.85:office?.66:stool?.44:.52,d=arm?.79:office?.64:.54,seat=stool?.76:.46;
  const upholstered=office||arm||[1,6,7,23,24].includes(v);
  // Properly supported frame with tapered feet or five-spoke chair base.
  if(office){
   cyl(.062,.42,0,.25,0,steel);cyl(.10,.06,0,.11,0,trim);
   for(let i=0;i<5;i++){const a=i*Math.PI*2/5,x=Math.sin(a)*.33,z=Math.cos(a)*.33;rod([0,.105,0],[x,.075,z],.027,steel);cyl(.039,.045,x,.043,z,trim)}
  }else{
   for(const x of [-w/2+.085,w/2-.085])for(const z of [-d/2+.085,d/2-.085]){
    const leg=b(.066,seat-.09,.066,x,(seat-.09)/2,z,arm?trim:wood);
    if(v===2||v===6||v===22)leg.material=steel;
   }
   for(const z of [-d/2+.095,d/2-.095])b(w-.16,.06,.04,0,seat-.15,z,wood);
   for(const x of [-w/2+.095,w/2-.095])b(.04,.06,d-.16,x,seat-.15,0,wood);
  }
  b(w-.045,.075,d-.05,0,seat,0,wood);
  b(w-.075,.075,d-.09,0,seat+.07,.005,upholstered?cloth:wood);
  // Angled back with upholstered pad, not a free-floating upright box.
  if(!stool){
   const backH=arm?.65:office?.70:.52;
   const frame=b(w-.065,backH,.075,0,seat+.12+backH/2,-d/2+.08,arm||office?cloth:wood);
   frame.rotation.x=-.105;
   if(upholstered){const pad=b(w-.17,backH-.13,.055,0,seat+.12+backH/2,-d/2+.125,cushion);pad.rotation.x=-.105}
   else if([3,4,5,7].includes(v))for(let i=0;i<5;i++)rod([-w*.35+i*w*.175,seat+.19,-d/2+.025],[-w*.35+i*w*.175,seat+.52,-d/2+.05],.012,wood);
  }
  if(arm||office){
   for(const side of [-1,1]){const x=side*(w/2-.055);
    b(.058,.27,.055,x,seat+.17,-.09,office?steel:wood);
    b(.11,.055,d*.67,x,seat+.33,-.01,upholstered?cloth:wood);
   }
  }
  if(stool){for(const z of [-d*.34,d*.34])rod([-w*.35,.29,z],[w*.35,.29,z],.018,steel)}
  if(v===16){b(w*.78,.09,.23,0,seat+.34,-d*.34,cushion)}
  if(v===19){for(const x of [-w*.40,w*.40])rod([x,.09,-d*.35],[x,.68,d*.25],.02,wood)}
 }
 if(k===4){
  const chaiseLeft=v===3||v===5,chaiseRight=v===4||v===6;
  const isL=chaiseLeft||chaiseRight,isU=v===7,mod=v===8||v===9;
  const w=isL||isU||mod?2.68:v===0||v===18?1.62:2.12;
  const d=.88,seat=.42,backY=.89,sections=Math.max(2,Math.round(w/.58));
  // Structural base and full-width back. Cushions are separate padded solids.
  b(w,.19,d,0,.32,0,trim);
  b(w,.52,.18,0,.79,-d/2+.08,cloth);
  for(const side of [-1,1]){
   const x=side*(w/2-.095);
   b(.19,.52,d,x,.60,0,cloth);
   b(.14,.045,.60,x,.88,.02,cushion);
  }
  for(let i=0;i<sections;i++){
   const x=-w/2+(i+.5)*w/sections,sw=w/sections-.035;
   b(sw,.16,d-.27,x,seat+.09,.095,cushion);
   b(sw,.40,.15,x,backY,-d/2+.19,cushion);
   // Fabric piping is recessed against cushion edges, not detached in space.
   b(sw-.04,.012,d-.32,x,seat+.176,.095,cloth);
   for(const yy of [.78,.96]){const button=new THREE.Mesh(new THREE.SphereGeometry(.012,8,6),edge);button.position.set(x,yy,-d/2+.277);g.add(button)}
  }
  // Chaise extension forms a continuous L with actual matching cushions.
  function chaise(side:number){
   const x=side*(w/2-.46),length=1.53;
   b(.91,.19,length,x,.32,.40,trim);
   b(.83,.16,length-.12,x,seat+.09,.42,cushion);
   b(.83,.012,length-.16,x,seat+.176,.42,cloth);
   b(.18,.52,length,side*(w/2-.09),.60,.40,cloth);
   b(.14,.045,length-.16,side*(w/2-.09),.88,.41,cushion);
   // No separate sofa front cushion under the chaise: visually continuous.
  }
  if(isL)chaise(-1);
  if(chaiseRight)chaise(1);
  if(isU){chaise(-1);chaise(1)}
  if(mod)for(let i=1;i<sections;i++){const x=-w/2+i*w/sections;b(.014,.015,.69,x,.595,.095,edge)}
  if([10,11,12].includes(v))for(let i=0;i<sections;i++){const x=-w/2+(i+.5)*w/sections;for(const yy of [.76,.93]){const button=new THREE.Mesh(new THREE.SphereGeometry(.019,10,8),trim);button.position.set(x,yy,-d/2+.28);g.add(button)}}
  for(const x of [-w/2+.20,w/2-.20])for(const z of [-.28,.28])b(.075,.10,.075,x,.05,z,wood);
 }
 if(k===5){if(v<=9){const w=v===0?.98:v===1?1.20:v>=4?1.95:1.55,d=v===5?1.95:2.15;legs(w,d,.38);b(w,.19,d,0,.45,0,wood);b(w*.95,.17,d*.89,0,.61,0,cloth);b(w,.78,.10,0,.79,-d/2,wood);b(w*.88,.16,.36,0,.72,-d*.36,cushion);if(v===5){b(w,.14,d*.52,0,1.35,0,wood);for(const x of [-w/2+.07,w/2-.07])b(.08,1.45,.08,x,.75,0,wood)}}
  else if(v===13){cyl(.05,1.75,0,.90,0,wood);for(let i=0;i<6;i++){const a=i*Math.PI/3;rod([0,1.62,0],[Math.sin(a)*.31,1.76,Math.cos(a)*.31],.025,wood)}}
  else{b(1.1,.50,.45,0,.36,0,wood);b(1.05,.10,.42,0,.65,0,cloth);for(const x of [-.42,.42])b(.065,.65,.07,x,.35,.15,trim)}
 }

 // POLISH PASS: category-specific joinery, surface detail, structural fasteners,
 // material differentiation, and true variants. All decoration is attached to
 // the furniture's local coordinate frame; no world-space floating ornaments.
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
