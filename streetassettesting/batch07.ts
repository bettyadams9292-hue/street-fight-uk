/** Batch 07 — 30 unique British architecture, shop interiors and domestic props. Review-only. */
import * as THREE from 'three';
export const ASSETS=[{"id":"brickWallSection","label":"Weathered red-brick garden wall","gameId":"brickWallSection"},{"id":"brickGatePier","label":"Brick gate pier with stone cap","gameId":"brickGatePier"},{"id":"terracedDoor","label":"Victorian terraced-house front door","gameId":"terracedDoor"},{"id":"bayWindow","label":"Terraced-house bay window","gameId":"bayWindow"},{"id":"sashWindow","label":"Painted timber sash window","gameId":"sashWindow"},{"id":"shopAwning","label":"Striped high-street shop awning","gameId":"shopAwning"},{"id":"rollerShutter","label":"Corrugated shop roller shutter","gameId":"rollerShutter"},{"id":"shopFascia","label":"Blank shopfront fascia and frame","gameId":"shopFascia"},{"id":"pubHangingSign","label":"Traditional pub hanging sign","gameId":"pubHangingSign"},{"id":"pubWindow","label":"Leaded pub frontage window","gameId":"pubWindow"},{"id":"chimneyPot","label":"Terracotta chimney pot","gameId":"chimneyPot"},{"id":"roofVent","label":"Industrial roof extractor vent","gameId":"roofVent"},{"id":"airConUnit","label":"External shop air-conditioning unit","gameId":"airConUnit"},{"id":"downpipe","label":"Cast-iron rainwater downpipe","gameId":"downpipe"},{"id":"gutterCorner","label":"Guttering corner and brackets","gameId":"gutterCorner"},{"id":"coalBunker","label":"Domestic outdoor coal bunker","gameId":"coalBunker"},{"id":"milkCrate","label":"Stackable dairy milk crate","gameId":"milkCrate"},{"id":"breadTray","label":"Commercial bakery bread tray","gameId":"breadTray"},{"id":"kegRack","label":"Pub cellar keg storage cradle","gameId":"kegRack"},{"id":"pubStool","label":"Upholstered British pub bar stool","gameId":"pubStool"},{"id":"pubBooth","label":"Traditional pub upholstered booth","gameId":"pubBooth"},{"id":"takeawayMenuBoard","label":"Illuminated takeaway menu board","gameId":"takeawayMenuBoard"},{"id":"fishChipFryer","label":"Stainless steel chip-shop fryer","gameId":"fishChipFryer"},{"id":"chippyWarmer","label":"Chip-shop heated display","gameId":"chippyWarmer"},{"id":"butcherCounter","label":"Butcher's chilled display counter","gameId":"butcherCounter"},{"id":"marketProduceCrate","label":"Greengrocer produce crate","gameId":"marketProduceCrate"},{"id":"laundretteFoldingTable","label":"Laundrette folding table","gameId":"laundretteFoldingTable"},{"id":"clothesAirer","label":"Foldable household clothes airer","gameId":"clothesAirer"},{"id":"estateGarageDoor","label":"Up-and-over domestic garage door","gameId":"estateGarageDoor"},{"id":"gardenWaterButt","label":"Domestic rainwater butt","gameId":"gardenWaterButt"}] as const;
export type AssetId=typeof ASSETS[number]['id'];
export function createAsset(id:AssetId):THREE.Group{
 const g=new THREE.Group();g.name='SFUK_B07_'+id;
 const M=(c:number,metal=0)=>new THREE.MeshStandardMaterial({color:c,metalness:metal,roughness:metal?.45:.82,side:THREE.DoubleSide});
 const brick=M(0x9c5545),mortar=M(0xc3b5a2),stone=M(0xa9a69d),wood=M(0x866044),dark=M(0x27313a),steel=M(0x8b999f,.65),white=M(0xe4dfd1),glass=M(0x8ab6c2,.2),red=M(0xb12e2a),green=M(0x36664b),gold=M(0xcaa35b,.5),blue=M(0x3c6b8d),black=M(0x181d20),cream=M(0xd8c6a5),food=M(0xc8943c),cloth=M(0x713d40);
 const B=(w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;g.add(o);return o};
 const C=(r:number,h:number,x:number,y:number,z:number,m:THREE.Material,n=24)=>{const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,n),m);o.position.set(x,y,z);g.add(o);return o};
 const R=(a:number[],b:number[],r:number,m:THREE.Material)=>{const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),v=q.clone().sub(p);const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,v.length(),12),m);o.position.copy(p).add(q).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());g.add(o);return o};
 const frame=(w:number,h:number,z:number,m:THREE.Material)=>{for(const x of [-w/2,w/2])B(.075,h,.07,x,h/2,z,m);for(const y of [.045,h-.045])B(w,.075,.07,0,y,z,m)};
 const brickwork=(w:number,h:number,d:number)=>{B(w,h,d,0,h/2,0,mortar);for(let row=0;row<Math.floor(h/.15);row++){const y=.08+row*.15;for(let i=0;i<Math.ceil(w/.30)+1;i++){const x=-w/2+.15+i*.30+(row%2?.15:0);if(x>w/2-.07)continue;B(.275,.132,d+.006,x,y,0,brick)}}};
 switch(id){
 case 'brickWallSection':brickwork(2.4,1.35,.20);B(2.52,.09,.32,0,1.39,0,stone);break;
 case 'brickGatePier':brickwork(.46,1.7,.46);B(.58,.10,.58,0,1.75,0,stone);B(.36,.05,.36,0,1.82,0,stone);break;
 case 'terracedDoor':B(1.05,2.22,.16,0,1.11,0,stone);B(.86,2.06,.05,0,1.07,.11,green);for(const y of [.40,.91,1.46])for(const x of [-.20,.20])B(.32,.34,.02,x,y,.15,wood);B(.12,.025,.025,.26,1.03,.17,gold);B(.28,.09,.04,0,.65,.17,gold);B(.9,.14,.26,0,.07,.20,stone);break;
 case 'bayWindow':B(1.65,1.15,.35,0,.68,0,cream);for(const x of [-.51,0,.51]){B(.46,.84,.035,x,.75,.21,glass);B(.045,.96,.06,x+.24,.75,.25,white);B(.47,.045,.05,x,.75,.25,white)}B(1.80,.09,.50,0,1.31,0,stone);B(1.78,.08,.52,0,.13,0,stone);break;
 case 'sashWindow':B(1.18,1.62,.12,0,.81,0,white);B(1.03,1.47,.025,0,.81,.08,glass);frame(1.04,1.48,.11,white);B(1.03,.075,.07,0,.80,.14,white);for(const x of [-.25,.25])B(.035,1.42,.03,x,.81,.14,white);B(1.3,.07,.30,0,.04,.09,stone);break;
 case 'shopAwning':B(2.7,.11,.16,0,2.30,-.62,dark);for(let i=0;i<10;i++)B(.265,.04,1.15,-1.215+i*.27,2.20,-.02,i%2?cream:red);for(let i=0;i<10;i++)B(.265,.17,.035,-1.215+i*.27,2.10,.55,i%2?cream:red);for(const x of [-1.2,1.2])R([x,2.20,-.6],[x,2.20,.56],.018,steel);break;
 case 'rollerShutter':B(2.3,2.2,.12,0,1.12,0,steel);for(let y=.18;y<2.16;y+=.105)B(2.22,.017,.03,0,y,.085,dark);B(2.55,.27,.36,0,2.34,0,dark);for(const x of [-1.22,1.22])B(.07,2.25,.22,x,1.12,0,steel);break;
 case 'shopFascia':B(2.8,.40,.17,0,2.14,0,green);for(const x of [-1.36,1.36])B(.10,2.2,.17,x,1.10,0,white);B(2.55,.12,.20,0,.10,0,stone);B(1.75,1.45,.04,-.35,1.00,.10,glass);B(.66,1.75,.05,1.0,.97,.10,wood);B(.55,.75,.03,1,1.40,.15,glass);break;
 case 'pubHangingSign':R([0,0,0],[0,2.2,0],.045,black);R([0,2.08,0],[.88,2.08,0],.035,black);R([.72,2.08,0],[.72,1.70,0],.016,black);B(.90,.62,.08,.72,1.39,0,green);B(.80,.52,.085,.72,1.39,.012,gold);B(.69,.41,.09,.72,1.39,.015,green);break;
 case 'pubWindow':B(1.65,1.48,.13,0,.75,0,wood);B(1.45,1.29,.03,0,.75,.09,glass);for(const x of [-.49,0,.49])B(.035,1.32,.035,x,.75,.13,dark);for(const y of [.43,.83,1.22])B(1.45,.032,.04,0,y,.13,dark);B(1.82,.10,.26,0,.08,.08,stone);break;
 case 'chimneyPot':C(.20,.58,0,.34,0,brick);C(.26,.12,0,.67,0,brick);C(.14,.02,0,.74,0,dark);C(.12,.025,0,.74,0,black);break;
 case 'roofVent':B(.76,.18,.76,0,.09,0,steel);C(.23,.67,0,.48,0,steel);C(.43,.08,0,.87,0,dark);C(.32,.09,0,.79,0,steel);break;
 case 'airConUnit':B(1.04,.65,.38,0,.52,0,cream);for(let i=0;i<12;i++)B(.035,.43,.025,-.44+i*.08,.52,.205,steel);for(const x of [-.37,.37])B(.08,.18,.55,x,.13,0,dark);C(.20,.02,.02,.52,.22,dark);break;
 case 'downpipe':R([0,.10,0],[0,2.2,0],.05,dark);R([0,2.2,0],[.27,2.42,0],.05,dark);for(const y of [.45,1.75])B(.18,.05,.18,0,y,0,steel);break;
 case 'gutterCorner':R([-1,1.5,0],[.15,1.5,0],.08,dark);R([.15,1.5,0],[.15,1.5,.9],.08,dark);for(const x of [-.80,-.20])B(.06,.16,.17,x,1.50,0,steel);B(.17,.16,.06,.15,1.50,.75,steel);break;
 case 'coalBunker':B(1.20,.72,.78,0,.39,0,dark);B(1.26,.08,.84,0,.78,0,steel);B(.90,.48,.03,0,.39,.41,black);for(const x of [-.50,.50])B(.055,.76,.055,x,.38,.40,steel);B(.25,.055,.06,0,.55,.45,steel);break;
 case 'milkCrate':B(.48,.05,.38,0,.05,0,blue);for(const x of [-.21,.21])for(const z of [-.16,.16])B(.045,.29,.045,x,.19,z,blue);for(const y of [.14,.27]){for(const z of [-.17,.17])B(.46,.035,.035,0,y,z,blue);for(const x of [-.22,.22])B(.035,.035,.36,x,y,0,blue)}for(let x=-.13;x<=.13;x+=.13)C(.055,.19,x,.18,0,white);break;
 case 'breadTray':B(.72,.045,.48,0,.045,0,wood);for(const z of [-.22,.22])B(.72,.13,.03,0,.12,z,wood);for(const x of [-.34,.34])B(.03,.13,.48,x,.12,0,wood);for(let x=-.24;x<=.24;x+=.24)for(const z of [-.11,.11]){const o=C(.09,.19,x,.19,z,food);o.rotation.z=Math.PI/2}break;
 case 'kegRack':for(const x of [-.48,.48])for(const z of [-.30,.30])B(.06,.80,.06,x,.43,z,steel);for(const y of [.17,.64])for(const z of [-.28,.28])R([-.51,y,z],[.51,y,z],.028,steel);for(const x of [-.23,.23]){const keg=C(.19,.42,x,.40,0,steel);keg.rotation.z=Math.PI/2;for(const dx of [-.14,.14]){const band=C(.202,.028,x+dx,.40,0,dark);band.rotation.z=Math.PI/2}}break;
 case 'pubStool':C(.29,.10,0,.77,0,cloth);C(.28,.06,0,.70,0,wood);for(const x of [-.19,.19])for(const z of [-.19,.19])R([x*.85,.08,z*.85],[x,.68,z],.025,wood);for(const z of [-.16,.16])R([-.17,.27,z],[.17,.27,z],.02,wood);break;
 case 'pubBooth':B(1.52,.25,.58,0,.50,.16,cloth);B(1.52,1.05,.20,0,.91,-.25,cloth);for(const x of [-.70,.70])B(.10,.62,.64,x,.51,.08,wood);B(1.54,.12,.66,0,.21,.12,wood);for(const x of [-.50,0,.50])B(.04,.84,.025,x,.94,-.13,wood);break;
 case 'takeawayMenuBoard':B(1.45,1.10,.10,0,.68,0,dark);B(1.32,.95,.025,0,.70,.065,cream);for(let i=0;i<5;i++){B(.65,.045,.028,-.24,1.01-i*.16,.085,red);B(.22,.045,.028,.42,1.01-i*.16,.085,green)}B(1.52,.09,.15,0,1.26,0,steel);break;
 case 'fishChipFryer':B(1.50,.90,.70,0,.47,0,steel);for(const x of [-.45,0,.45]){B(.36,.07,.43,x,.93,0,dark);B(.32,.025,.39,x,.98,0,steel);R([x-.14,1.03,.05],[x+.14,1.03,.05],.012,steel)}B(1.50,.16,.05,0,.72,.38,steel);for(const x of [-.45,0,.45])C(.038,.02,x,.78,.41,black);break;
 case 'chippyWarmer':B(1.15,.73,.52,0,.40,0,steel);B(1.09,.47,.025,0,.52,.28,glass);B(1.15,.07,.55,0,.78,0,steel);for(let i=0;i<3;i++)B(.29,.035,.35,-.34+i*.34,.26,.04,food);for(const x of [-.52,.52])B(.03,.52,.03,x,.52,.28,steel);break;
 case 'butcherCounter':B(1.65,.68,.74,0,.37,0,cream);B(1.68,.47,.04,0,.83,.38,glass);B(1.72,.09,.81,0,1.10,0,steel);for(const x of [-.48,0,.48])B(.38,.08,.29,x,.75,.13,red);B(1.45,.08,.56,0,.67,0,steel);break;
 case 'marketProduceCrate':B(.78,.05,.48,0,.04,0,wood);for(const z of [-.23,.23])for(const y of [.12,.24])B(.78,.055,.025,0,y,z,wood);for(const x of [-.37,.37])for(const y of [.12,.24])B(.025,.055,.48,x,y,0,wood);for(let x=-.27;x<=.27;x+=.18)for(const z of [-.12,.08])C(.075,.10,x,.15,z,green);break;
 case 'laundretteFoldingTable':B(1.50,.055,.76,0,.87,0,white);for(const x of [-.66,.66])for(const z of [-.30,.30])B(.055,.82,.055,x,.43,z,steel);B(.68,.07,.40,-.25,.95,0,blue);B(.54,.06,.32,-.25,1.02,0,cream);break;
 case 'clothesAirer':for(const x of [-.60,.60]){R([x,.04,-.37],[x,1.20,.37],.024,steel);R([x,.04,.37],[x,1.20,-.37],.024,steel)}for(let i=0;i<8;i++){const z=-.34+i*.095;R([-.61,1.22,z],[.61,1.22,z],.015,steel)}break;
 case 'estateGarageDoor':B(2.55,2.02,.13,0,1.04,0,cream);for(const y of [.28,.70,1.12,1.54])B(2.37,.035,.03,0,y,.085,steel);for(const x of [-1.26,1.26])B(.09,2.12,.20,x,1.07,0,white);B(.26,.04,.04,0,.92,.11,dark);break;
 case 'gardenWaterButt':C(.39,1.02,0,.56,0,green,40);C(.42,.08,0,1.10,0,dark,40);C(.07,.06,0,.20,.40,steel);R([0,.20,.40],[0,.12,.50],.035,black);for(const x of [-.25,.25])B(.12,.10,.52,x,.05,0,black);break;
 }


 // STRUCTURAL REBUILD: remove obstructing prototype geometry instead of stacking decorative patches.
 if(['terracedDoor','bayWindow','sashWindow','shopFascia','pubWindow','shopAwning','butcherCounter','chippyWarmer','fishChipFryer'].includes(id)){
  g.clear();
  const clearGlass=new THREE.MeshPhysicalMaterial({color:0xb2cbd0,transparent:true,opacity:.32,roughness:.09,metalness:0,side:THREE.DoubleSide,depthWrite:false});
  const trim=(w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material)=>B(w,h,d,x,y,z,m);
  switch(id){
   case 'terracedDoor':{
    // A solid four-panel Victorian door; the fanlight is a SEPARATE aperture above it.
    const leaf=M(0x244c40,.12),recess=M(0x173a32),mould=M(0x426b5b);
    B(.94,.10,.20,0,.08,.03,stone);
    B(.10,2.30,.19,-.50,1.23,0,white);B(.10,2.30,.19,.50,1.23,0,white);
    B(1.10,.12,.20,0,2.42,0,stone);
    B(.90,2.02,.075,0,1.10,.06,leaf);
    // Inset four-panel arrangement, moulding set just proud of the face.
    for(const y of [.58,1.44])for(const x of [-.218,.218]){
      const h=y>1?.52:.55;
      B(.34,h,.008,x,y,.105,recess);
      for(const xx of [x-.175,x+.175])B(.019,h+.025,.021,xx,y,.116,mould);
      for(const yy of [y-h/2,y+h/2])B(.37,.020,.021,x,yy,.116,mould);
      B(.28,h-.10,.006,x,y,.113,leaf);
    }
    // Door handle, knocker and letterbox all attached to the outer door plane.
    B(.075,.10,.028,.32,1.04,.123,brass);
    B(.15,.022,.05,.32,1.04,.147,brass);
    B(.30,.07,.028,0,.41,.124,brass);
    B(.21,.014,.030,0,.41,.144,black);
    // Real fanlight above, separated by a timber transom, not floating in the door.
    B(.90,.22,.015,0,2.24,.045,clearGlass);
    B(.95,.055,.10,0,2.10,.10,white);
    B(.035,.21,.035,0,2.24,.075,white);
    B(.38,.025,.025,0,2.35,.082,white);
    break;
   }
   case 'bayWindow':{
    // Projecting three-light window with angled side returns and transparent glazing.
    B(1.75,.10,.70,0,.12,.06,stone);B(1.77,.12,.74,0,1.38,.06,stone);
    B(1.60,.13,.55,0,.26,.05,cream);
    for(const x of [-.48,0,.48]){
      B(.43,.95,.015,x,.84,.36,clearGlass);
      for(const xx of [x-.225,x+.225])B(.035,1.02,.055,xx,.84,.385,white);
      for(const yy of [.35,.83,1.34])B(.47,.035,.052,x,yy,.385,white);
    }
    for(const x of [-.77,.77])B(.06,1.18,.61,x,.82,.05,white);
    B(1.65,.045,.055,0,.86,.39,white);break;
   }
   case 'sashWindow':{
    B(1.22,.11,.18,0,.08,0,stone);
    for(const x of [-.55,.55])B(.085,1.62,.14,x,.88,0,white);
    for(const y of [.12,1.63])B(1.18,.09,.14,0,y,0,white);
    B(1.02,1.40,.015,0,.87,.05,clearGlass);
    B(1.04,.065,.07,0,.84,.11,white);
    for(const x of [-.27,.27])B(.028,1.39,.03,x,.87,.11,white);
    for(const y of [.44,1.25])B(1.03,.026,.03,0,y,.11,white);
    B(.13,.022,.025,0,.80,.15,brass);break;
   }
   case 'shopFascia':{
    // A shopfront with a genuinely open window and a recessed entrance.
    B(2.9,.38,.19,0,2.20,0,green);
    B(2.95,.075,.25,0,2.42,0,white);B(2.95,.07,.25,0,1.98,0,white);
    for(const x of [-1.39,.56,1.39])B(.105,2.02,.18,x,1.00,0,wood);
    B(2.80,.19,.30,0,.11,0,stone);
    B(1.70,.30,.09,-.41,.34,.09,green);
    B(1.68,1.39,.014,-.42,1.19,.07,clearGlass);
    for(const x of [-1.25,.41])B(.045,1.39,.06,x,1.19,.11,white);
    B(1.73,.055,.07,-.42,1.34,.11,white);
    B(.73,1.81,.055,.99,1.00,-.10,green);
    B(.58,1.25,.014,.99,1.32,-.061,clearGlass);
    B(.55,.07,.04,.99,.72,-.04,wood);
    B(.06,.13,.035,1.25,1.00,-.025,brass);
    break;
   }
   case 'pubWindow':{
    for(const x of [-.81,.81])B(.085,1.52,.16,x,.78,0,wood);
    for(const y of [.09,1.48])B(1.67,.10,.16,0,y,0,wood);
    B(1.50,1.33,.012,0,.79,.05,clearGlass);
    for(const x of [-.50,0,.50])B(.028,1.35,.05,x,.79,.105,wood);
    for(const y of [.44,.87,1.23])B(1.50,.03,.05,0,y,.105,wood);
    B(1.75,.08,.28,0,.055,.08,stone);break;
   }
   case 'shopAwning':{
    // Sloped fabric canopy; no disconnected flat stripes.
    B(2.76,.13,.20,0,2.38,-.65,dark);
    for(let i=0;i<12;i++){
      const x=-1.265+i*.23;
      const a=B(.229,.025,1.23,x,2.11,-.02,i%2?cream:red);
      a.rotation.x=.21;
      B(.229,.15,.027,x,1.95,.60,i%2?cream:red);
    }
    for(const x of [-1.23,1.23]){
      R([x,2.34,-.60],[x,1.99,.60],.025,steel);
      R([x,2.34,-.60],[x,2.20,.02],.015,steel);
    }break;
   }
   case 'butcherCounter':{
    B(1.72,.75,.77,0,.39,0,cream);B(1.76,.09,.84,0,.79,0,steel);
    B(1.59,.035,.54,0,.80,.03,white);
    for(const x of [-.50,0,.50]){const meat=new THREE.Mesh(new THREE.SphereGeometry(.15,18,12),red);meat.scale.set(1.12,.38,.85);meat.position.set(x,.87,.04);g.add(meat)}
    B(1.67,.35,.015,0,.99,.39,clearGlass);
    for(const x of [-.81,.81])B(.035,.41,.045,x,.97,.40,steel);
    B(1.73,.06,.05,0,1.19,.41,steel);break;
   }
   case 'chippyWarmer':{
    B(1.22,.78,.60,0,.41,0,steel);
    B(1.12,.05,.51,0,.79,0,white);
    for(const x of [-.34,0,.34]){
      B(.31,.03,.38,x,.33,.07,slate);
      for(let j=0;j<5;j++)B(.035,.045,.25,x-.12+j*.06,.39,.07,food);
    }
    B(1.12,.40,.012,0,.56,.31,clearGlass);
    for(const x of [-.56,.56])B(.035,.45,.04,x,.57,.32,steel);
    B(1.14,.06,.045,0,.81,.31,steel);break;
   }
   case 'fishChipFryer':{
    B(1.60,.83,.75,0,.45,0,steel);
    B(1.64,.08,.79,0,.89,0,white);
    for(const x of [-.49,0,.49]){
      B(.41,.018,.49,x,.95,0,slate);
      for(const xx of [x-.16,x+.16])R([xx,.99,-.18],[xx,.99,.18],.015,steel);
      R([x-.16,.99,.18],[x+.16,.99,.18],.015,steel);
      B(.25,.07,.03,x,.80,.39,black);
      C(.03,.025,x,.80,.42,red);
    }
    B(1.62,.11,.05,0,.15,.38,steel);break;
   }
  }
 }

 // PASS ONE: construction, material layering, realistic fixtures and British character.
 const slate=M(0x4b5258,.18),aged=M(0x6b5448),brass=M(0xa98b54,.7),rubber=M(0x24282a),paper=M(0xe7ddc6),veg=M(0x5a823e),tomato=M(0xb83d32),ceramic=M(0xd8d6ce),enamel=M(0xced3d1,.1);
 const sphere=(r:number,x:number,y:number,z:number,m:THREE.Material,sx=1,sy=1,sz=1)=>{const o=new THREE.Mesh(new THREE.SphereGeometry(r,16,12),m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);g.add(o)};
 const tor=(r:number,t:number,x:number,y:number,z:number,m:THREE.Material,rx=0)=>{const o=new THREE.Mesh(new THREE.TorusGeometry(r,t,8,36),m);o.position.set(x,y,z);o.rotation.x=rx;g.add(o)};
 const plank=(w:number,d:number,x:number,y:number,z:number,m:THREE.Material)=>B(w,.024,d,x,y,z,m);
 switch(id){
 case 'brickWallSection':case 'brickGatePier':{
  const w=id==='brickWallSection'?2.4:.46,h=id==='brickWallSection'?1.35:1.7;
  for(let row=0;row<Math.floor(h/.15);row++)for(let j=0;j<Math.ceil(w/.30);j++){const x=-w/2+.15+j*.30+(row%2?.15:0);if(x>w/2-.10)continue;B(.26,.012,.015,x,.145+row*.15,id==='brickWallSection'?.116:.246,aged)}
  break}
 case 'terracedDoor':{
  B(.60,.33,.024,0,1.84,.152,glass);B(.66,.038,.03,0,1.66,.166,white);
  for(const x of [-.24,.24])B(.035,.34,.03,x,1.84,.17,white);
  B(.09,.11,.035,-.29,1.05,.173,brass);B(.33,.065,.04,0,.55,.18,brass);
  B(.94,.11,.18,0,2.22,.02,stone);B(.86,.11,.025,0,.10,.14,stone);break}
 case 'bayWindow':{
  for(const x of [-.54,0,.54]){B(.045,1.04,.045,x,0.74,.254,white);B(.46,.045,.045,x,.75,.255,white)}
  for(const y of [.27,1.17])B(1.65,.045,.42,0,y,0,stone);
  B(1.67,.08,.43,0,1.39,0,slate);break}
 case 'sashWindow':{
  B(1.08,.075,.045,0,.79,.155,white);B(1.07,.035,.05,0,1.45,.145,white);
  for(const x of [-.48,.48])B(.04,1.43,.055,x,.79,.15,white);
  for(const y of [.40,1.14])B(1.03,.025,.04,0,y,.15,white);break}
 case 'shopAwning':{
  for(const x of [-1.15,1.15]){R([x,2.20,-.60],[x,2.07,.55],.023,steel);R([x,2.2,-.60],[x,2.20,.55],.012,steel)}
  B(2.72,.12,.16,0,2.31,-.62,dark);break}
 case 'rollerShutter':{
  for(let y=.20;y<2.18;y+=.105)B(2.23,.015,.025,0,y,.105,slate);
  B(.25,.07,.024,0,.25,.115,black);B(.12,.035,.022,0,.25,.13,steel);break}
 case 'shopFascia':{
  B(2.55,.05,.22,0,2.38,0,white);
  B(2.58,.05,.22,0,1.91,0,white);
  for(const x of [-1.20,.58])B(.07,1.75,.09,x,.96,.16,wood);
  B(.48,.025,.05,1.0,.93,.17,brass);break}
 case 'pubHangingSign':{
  B(.84,.56,.03,.72,1.39,.07,dark);
  B(.62,.045,.035,.72,1.52,.094,brass);B(.44,.03,.036,.72,1.38,.096,brass);
  tor(.065,.009,.72,1.14,.09,brass);
  for(const y of [1.69,1.79])tor(.025,.009,.72,y,0,black);break}
 case 'pubWindow':{
  B(1.53,.07,.06,0,1.45,.13,wood);
  for(const x of [-.72,.72])B(.06,1.38,.08,x,.75,.12,wood);
  for(let j=0;j<4;j++)for(let i=0;i<3;i++)B(.015,.015,.012,-.56+j*.37,.30+i*.35,.155,brass);break}
 case 'chimneyPot':{
  tor(.195,.022,0,.63,0,brick,Math.PI/2);
  for(const y of [.18,.48])C(.215,.027,0,y,0,aged,32);break}
 case 'roofVent':{
  for(let i=0;i<9;i++){const a=i*Math.PI*2/9;R([Math.cos(a)*.30,.81,Math.sin(a)*.30],[Math.cos(a)*.32,.88,Math.sin(a)*.32],.012,steel)}
  C(.37,.027,0,.92,0,slate);break}
 case 'airConUnit':{
  for(const x of [-.43,.43])B(.035,.56,.045,x,.51,.20,steel);
  tor(.20,.013,0,.52,.225,steel);
  for(let i=0;i<6;i++){const a=i*Math.PI/3;R([0,.52,.229],[Math.cos(a)*.18,.52+Math.sin(a)*.18,.229],.009,dark)}
  B(.17,.06,.015,-.29,.28,.211,blue);break}
 case 'downpipe':{
  for(const y of [.45,1.75]){B(.16,.05,.12,0,y,.075,steel);B(.045,.08,.045,0,y,.15,slate)}
  C(.07,.065,0,.10,0,dark);break}
 case 'gutterCorner':{
  for(let i=0;i<5;i++)B(.025,.09,.13,-.85+i*.20,1.47,.03,steel);
  for(let i=0;i<4;i++)B(.13,.09,.025,.16,1.47,.12+i*.19,steel);break}
 case 'coalBunker':{
  for(const x of [-.47,.47])B(.045,.58,.025,x,.39,.43,steel);
  B(.86,.04,.04,0,.67,.43,steel);B(.17,.025,.03,0,.50,.44,brass);
  for(let i=0;i<7;i++)B(.03,.50,.022,-.40+i*.13,.38,.435,aged);break}
 case 'milkCrate':{
  for(const z of [-.18,.18])for(let i=0;i<5;i++)B(.025,.22,.012,-.16+i*.08,.19,z,blue);
  for(const x of [-.24,.24])for(let i=0;i<4;i++)B(.012,.20,.025,x,.19,-.12+i*.08,blue);
  for(const x of [-.12,0,.12])C(.045,.025,x,.30,0,white);break}
 case 'breadTray':{
  for(const z of [-.19,.19])for(let i=0;i<5;i++)B(.026,.09,.018,-.26+i*.13,.12,z,wood);
  for(let x=-.24;x<=.24;x+=.24)for(const z of [-.11,.11]){sphere(.09,x,.22,z,food,1.3,.65,.75);for(let j=-1;j<=1;j++)B(.006,.006,.09,x+j*.03,.28,z,cream)}
  break}
 case 'kegRack':{
  for(const x of [-.23,.23]){for(const dx of [-.14,0,.14]){const hoop=C(.205,.022,x+dx,.40,0,slate);hoop.rotation.z=Math.PI/2}
   B(.15,.045,.12,x,.17,.22,wood)}
  for(const y of [.15,.63])B(1.08,.03,.07,0,y,.32,steel);break}
 case 'pubStool':{
  tor(.29,.018,0,.79,0,brass,Math.PI/2);
  for(const x of [-.19,.19])for(const z of [-.19,.19])C(.028,.045,x,.07,z,black);
  B(.37,.035,.04,0,.32,.17,wood);break}
 case 'pubBooth':{
  for(const x of [-.46,0,.46])for(const y of [.73,1.03,1.32])sphere(.016,x,y,-.115,brass);
  for(const x of [-.70,.70])B(.10,.11,.60,x,.71,.08,wood);
  B(1.55,.04,.12,0,1.46,-.25,wood);break}
 case 'takeawayMenuBoard':{
  for(let i=0;i<5;i++){B(.38,.015,.012,-.38,1.01-i*.16,.09,black);B(.18,.015,.013,.44,1.01-i*.16,.09,red)}
  B(1.46,.04,.14,0,.08,0,steel);break}
 case 'fishChipFryer':{
  for(const x of [-.45,0,.45]){B(.35,.025,.43,x,.995,0,slate);B(.23,.08,.22,x,1.04,.02,steel);R([x-.10,1.05,.26],[x+.10,1.05,.26],.012,black)}
  for(const x of [-.45,0,.45]){B(.26,.24,.015,x,.42,.36,slate);C(.026,.025,x,.78,.43,red)}
  B(1.52,.06,.78,0,.90,0,steel);break}
 case 'chippyWarmer':{
  for(const x of [-.35,0,.35]){B(.32,.022,.34,x,.30,.07,steel);for(let i=0;i<5;i++)B(.03,.025,.24,x-.12+i*.06,.33,.07,food)}
  for(const y of [.42,.64])B(1.09,.025,.02,0,y,.302,steel);
  B(.85,.035,.035,0,.77,.28,gold);break}
 case 'butcherCounter':{
  for(const x of [-.48,0,.48]){B(.35,.025,.30,x,.75,.13,white);sphere(.13,x,.81,.14,red,1.15,.36,.75)}
  for(const x of [-.76,.76])B(.04,.45,.05,x,.87,.37,steel);
  B(1.55,.05,.05,0,1.07,.40,steel);break}
 case 'marketProduceCrate':{
  for(let i=0;i<4;i++)B(.045,.18,.045,-.34+i*.22,.16,-.22,wood);
  for(let x=-.27;x<=.27;x+=.18)for(const z of [-.12,.08]){sphere(.072,x,.23,z,veg);sphere(.018,x,.30,z,green)}
  break}
 case 'laundretteFoldingTable':{
  B(1.53,.025,.80,0,.90,0,steel);for(const z of [-.25,.25])B(1.25,.025,.025,0,.50,z,steel);
  for(let i=0;i<3;i++)B(.52,.022,.32,-.25,.99+i*.045,0,i%2?white:blue);break}
 case 'clothesAirer':{
  for(const z of [-.32,.32])R([-.60,.50,z],[.60,.50,z],.015,steel);
  for(const x of [-.55,.55])R([x,.06,-.37],[x,.06,.37],.025,steel);
  for(let i=0;i<7;i++){const z=-.28+i*.095;R([-.58,1.20,z],[.58,1.20,z],.012,steel)}
  break}
 case 'estateGarageDoor':{
  for(let i=0;i<4;i++){B(2.40,.028,.035,0,.27+i*.44,.095,stone);for(const x of [-1.1,1.1])B(.028,.33,.025,x,.27+i*.44,.10,white)}
  B(.28,.06,.025,0,.91,.12,steel);break}
 case 'gardenWaterButt':{
  for(const y of [.22,.82])tor(.39,.015,0,y,0,green,Math.PI/2);
  B(.12,.08,.08,0,.20,.41,black);C(.07,.05,0,.17,.45,brass);
  B(.07,.08,.09,0,.12,.50,black);break}
 }
 // PASS TWO: restrained wear, finish details, and geometry sanity metadata.
 if(['brickWallSection','brickGatePier','shopFascia','rollerShutter','estateGarageDoor'].includes(id)){
  g.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true}});
 }
 g.userData={collection:'streetassettesting',batch:7,approved:false,reviewOnly:true,units:'metres',detailPasses:2,referenceStudy:'UK architecture, retail, hospitality and domestic objects'};

 return g;
}
