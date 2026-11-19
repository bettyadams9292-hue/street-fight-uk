/**
 * Street Fight UK — isolated procedural street furniture asset library.
 * NOT imported, registered or placed anywhere in the game.
 * Three.js compatible. Units approximate metres. Y is up.
 * Usage (later, deliberately): import { createStreetAsset } from './newassetsfromchatgpt';
 * const prop = createStreetAsset('pillarPostBox'); scene.add(prop);
 */
import * as THREE from 'three';

export type StreetAssetName =
  | 'pillarPostBox' | 'wallPostBox' | 'busStopPole' | 'busShelter'
  | 'busBench' | 'timetableBoard' | 'streetLamp' | 'bollard'
  | 'railings' | 'litterBin' | 'recyclingBin' | 'telephoneBox'
  | 'electricalCabinet' | 'streetNameSign' | 'pedestrianCrossing'
  | 'roadSign' | 'wheelieBinBlack' | 'wheelieBinBrown' | 'wheelieBinGreen' | 'wheelieBinBlue' | 'parkBench'
  | 'retailCounter' | 'highTable' | 'stockedShelves' | 'manholeCover' | 'queueBarrier' | 'queueBarrierOpen' | 'queueBarrierLine' | 'queueBarrierCorner' | 'drinksFridge' | 'streetPlanter' | 'shopCounterTill' | 'cardboardBox' | 'cardTerminal' | 'backBarShelves' | 'receptionCounter' | 'pottedTree' | 'wineBottle' | 'oilDrum' | 'wallClock' | 'chalkboardMenu' | 'pastryCabinet' | 'waitingSofa';

const C = {
  red: 0xb61d29, darkRed: 0x801521, charcoal: 0x262b31,
  steel: 0x727b83, silver: 0xc6cbd0, glass: 0x9ec7d3,
  cream: 0xece8d9, white: 0xf7f5ee, yellow: 0xf5c934,
  blue: 0x245d91, green: 0x237453, asphalt: 0x3e4145,
};
function mat(color: number, metalness = 0, roughness = 0.72) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness });
}
function box(g: THREE.Group, w: number, h: number, d: number, x: number, y: number, z: number, color: number, metalness = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, metalness));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
}
function cylinder(g: THREE.Group, r: number, h: number, x: number, y: number, z: number, color: number, rTop = r) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, r, h, 12), mat(color, 0.3));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
}
function group(name: string) { const g = new THREE.Group(); g.name = 'SFUK_' + name; return g; }
function panel(g: THREE.Group, w: number, h: number, x: number, y: number, z: number, color: number) {
  return box(g, w, h, 0.025, x, y, z, color);
}
function pole(g: THREE.Group, x: number, y: number, z: number, height: number, color = C.charcoal) {
  return cylinder(g, 0.045, height, x, y + height / 2, z, color);
}
function sign(g: THREE.Group, text: string, w: number, h: number, x: number, y: number, z: number, bg: number, fg: number) {
  // Canvas-free, bundler-safe placeholder geometry: text label in userData for later typography.
  const m = panel(g, w, h, x, y, z, bg);
  m.userData = { signText: text, textColor: fg, note: 'Apply font/texture during integration' };
  return m;
}
export function createStreetAsset(name: StreetAssetName): THREE.Group {
  if (APPROVED_ASSET_IDS.has(name)) return createApprovedStreetAsset(name as ApprovedStreetAssetId);
  const g = group(name);
  if (['parkBench','busBench','telephoneBox'].includes(name)) {
    buildReplacementV9(g,name);
    return finishProductionAsset(g,name);
  }
  if (['pillarPostBox','wallPostBox','busStopPole','busShelter','telephoneBox','litterBin'].includes(name)) {
    buildReworkedStreetAsset(g, name);
    g.userData = {collection:'newassetsfromchatgpt', standalone:true, units:'metres', assetName:name, detailVersion:4};
    return finishProductionAsset(g, name);
  }
  switch (name) {
    case 'pillarPostBox':
      cylinder(g, .24, 1.22, 0, .65, 0, C.red);
      cylinder(g, .275, .12, 0, 1.30, 0, C.darkRed);
      cylinder(g, .27, .08, 0, .06, 0, C.darkRed);
      box(g, .35, .065, .055, 0, 1.01, .235, C.charcoal);
      panel(g, .25, .22, 0, .77, .251, C.cream);
      break;
    case 'wallPostBox':
      box(g, .46, .68, .24, 0, .58, 0, C.red);
      box(g, .49, .09, .27, 0, .96, 0, C.darkRed);
      box(g, .32, .05, .04, 0, .72, .141, C.charcoal);
      panel(g, .30, .19, 0, .47, .141, C.cream);
      break;
    case 'busStopPole':
      pole(g, 0, 0, 0, 2.65);
      cylinder(g, .21, .055, 0, 2.60, 0, C.red);
      sign(g, 'BUS STOP', .35, .40, 0, 2.25, .06, C.white, C.red);
      sign(g, 'ROUTES', .35, .45, 0, 1.74, .06, C.cream, C.charcoal);
      break;
    case 'busShelter':
      for (const x of [-1.45, 1.45]) for (const z of [-.43, .43]) pole(g, x, 0, z, 2.25, C.steel);
      box(g, 3.15, .11, 1.20, 0, 2.32, 0, C.charcoal, .3);
      box(g, 3.00, .055, .92, 0, 2.26, 0, C.blue);
      for (const x of [-.73, .73]) panel(g, 1.35, 1.72, x, 1.18, -.46, C.glass);
      box(g, 2.4, .09, .43, 0, .61, -.25, C.steel, .4);
      for (const x of [-.96, .96]) box(g, .07, .58, .07, x, .29, -.25, C.charcoal);
      break;
    case 'busBench':
      box(g, 1.65, .09, .46, 0, .51, 0, C.steel, .5);
      box(g, 1.65, .42, .07, 0, .82, -.22, C.steel, .5);
      for (const x of [-.69, .69]) box(g, .08, .50, .08, x, .25, 0, C.charcoal);
      break;
    case 'timetableBoard':
      pole(g, 0, 0, 0, 1.9);
      box(g, .65, .93, .12, 0, 1.50, .02, C.charcoal);
      sign(g, 'TIMETABLE', .56, .81, 0, 1.51, .09, C.cream, C.charcoal);
      break;
    case 'streetLamp':
      pole(g, 0, 0, 0, 4.4);
      box(g, 1.15, .075, .09, .53, 4.34, 0, C.charcoal);
      box(g, .39, .10, .26, 1.02, 4.25, 0, C.silver, .3);
      box(g, .34, .025, .22, 1.02, 4.19, 0, C.cream);
      break;
    case 'bollard':
      cylinder(g, .105, .88, 0, .44, 0, C.charcoal);
      cylinder(g, .111, .11, 0, .68, 0, C.silver);
      cylinder(g, .125, .07, 0, .91, 0, C.charcoal);
      break;
    case 'railings':
      for (let i = 0; i < 6; i++) pole(g, -1.25 + i * .5, 0, 0, 1.08);
      for (const y of [.28, .89]) box(g, 2.65, .055, .055, 0, y, 0, C.charcoal);
      break;
    case 'litterBin':
    case 'recyclingBin': {
      const color = name === 'recyclingBin' ? C.green : C.charcoal;
      box(g, .52, .94, .46, 0, .49, 0, color);
      box(g, .57, .10, .51, 0, .98, 0, C.charcoal);
      box(g, .31, .09, .03, 0, .79, .247, C.charcoal);
      panel(g, .28, .23, 0, .48, .246, name === 'recyclingBin' ? C.white : C.silver);
      break;
    }
    case 'telephoneBox':
      for (const x of [-.42, .42]) for (const z of [-.42, .42])
        box(g, .10, 2.28, .10, x, 1.14, z, C.red);
      box(g, 1.03, .23, 1.03, 0, 2.37, 0, C.red);
      for (const z of [-.43, .43]) {
        for (const x of [-.22, .22]) panel(g, .34, 1.73, x, 1.16, z, C.glass);
      }
      box(g, 1.02, .09, 1.02, 0, .05, 0, C.darkRed);
      sign(g, 'TELEPHONE', .79, .14, 0, 2.32, .53, C.cream, C.red);
      break;
    case 'electricalCabinet':
      box(g, .90, 1.45, .46, 0, .75, 0, C.green);
      panel(g, .79, 1.29, 0, .76, .242, C.steel);
      box(g, .04, .13, .035, .31, .75, .266, C.charcoal);
      break;
    case 'streetNameSign':
      for (const x of [-.69, .69]) pole(g, x, 0, 0, 1.85, C.steel);
      sign(g, 'HIGH STREET', 1.65, .34, 0, 1.72, .05, C.white, C.charcoal);
      break;
    case 'pedestrianCrossing':
      box(g, 3.0, .025, 3.2, 0, .012, 0, C.asphalt);
      for (let i = 0; i < 5; i++) box(g, 2.7, .008, .31, 0, .03, -1.2 + i * .6, C.white);
      break;
    case 'roadSign':
      pole(g, 0, 0, 0, 2.30, C.steel);
      sign(g, 'TOWN CENTRE', 1.18, .52, 0, 2.10, .055, C.blue, C.white);
      break;
    case 'wheelieBinBlack':
    case 'wheelieBinBrown':
    case 'wheelieBinGreen':
    case 'wheelieBinBlue':
    case 'parkBench':
      break;
    default: {
      const exhaustive: never = name;
      throw new Error('Unknown street asset: ' + exhaustive);
    }
  }
  enhanceReferenceProps(g, name);
  // Retired legacy enhancement: it layered geometry and rewrote material colours.
  // V8 uses stable base colours and explicit dimensional details instead.
  polishEveryRemainingAsset(g, name);
  g.userData = { collection: 'newassetsfromchatgpt', standalone: true, units: 'metres', assetName: name };
  return finishProductionAsset(g, name);
}
export const STREET_ASSET_NAMES: readonly StreetAssetName[] = [
  'pillarPostBox', 'wallPostBox', 'busStopPole', 'busShelter', 'busBench',
  'timetableBoard', 'streetLamp', 'bollard', 'railings', 'litterBin',
  'recyclingBin', 'telephoneBox', 'electricalCabinet', 'streetNameSign',
  'pedestrianCrossing', 'roadSign', 'wheelieBinBlack', 'wheelieBinBrown',
  'wheelieBinGreen', 'wheelieBinBlue', 'parkBench',
  'retailCounter', 'highTable', 'stockedShelves', 'manholeCover', 'queueBarrier', 'queueBarrierOpen', 'queueBarrierLine', 'queueBarrierCorner', 'drinksFridge', 'streetPlanter', 'shopCounterTill', 'cardboardBox', 'cardTerminal', 'backBarShelves', 'receptionCounter', 'pottedTree', 'wineBottle', 'oilDrum', 'wallClock', 'chalkboardMenu', 'pastryCabinet', 'waitingSofa',
] as const;

/** Photo-reference enhancements: black-framed London bus shelter, cast-iron
 *  litter bin, red post box, slatted bench and UK four-colour wheelie bins.
 *  No textures are fetched remotely; all detailing is procedural and offline.
 *  Roughness/colour variation suggests use without large texture downloads.
 */
function enhanceReferenceProps(g: THREE.Group, name: StreetAssetName) {
  const add = (w:number,h:number,d:number,x:number,y:number,z:number,c:number) => box(g,w,h,d,x,y,z,c);
  const metal = C.charcoal, faded = 0x525a60, timber = 0x4b4a46;
  if (name === 'busShelter') {
    // Framed transparent glazed sides and dark fascia.
    for (const x of [-1.45,1.45]) {
      for (const y of [.45,1.30,2.10]) add(.075,.06,.94,x,y,0,metal);
      add(.055,1.75,.045,x,1.2,.44,metal);
    }
    add(3.28,.20,1.28,0,2.42,0,0x22262b);
    add(1.00,.30,.07,.75,2.17,.61,0x151a1e);
    // LED display represented by red illuminated bars (not live timetable text).
    for (let i=0;i<3;i++) add(.76,.025,.012,.75,2.26-i*.09,.654,0xe73535);
    for (const x of [-1.34,1.34]) add(.07,1.8,.07,x,1.15,.44,metal);
    // Bench front red timber slat and supports.
    add(2.28,.11,.09,0,.63,.03,0xa5332a);
    for (const x of [-.95,.95]) add(.08,.60,.08,x,.32,.04,metal);
    // Information panels with frames.
    add(.74,1.18,.055,-.87,1.35,-.40,0x24292d);
    add(.64,1.07,.06,-.87,1.35,-.36,0xe3e2d9);
  }
  if (name === 'pillarPostBox') {
    cylinder(g,.295,.09,0,1.36,0,0x9f1925);
    cylinder(g,.28,.06,0,.12,0,0x8c1720);
    add(.34,.09,.05,0,1.04,.247,0x1e1d1d);
    add(.22,.14,.03,0,.78,.267,0xd6c8a4);
    for (const y of [.18,1.22]) cylinder(g,.255,.025,0,y,0,0xc12632);
  }
  if (name === 'litterBin') {
    // Victorian-inspired cast-iron black bin with gold banding and inset panels.
    for (const y of [.12,.88]) add(.57,.035,.51,0,y,0,0xc49d42);
    for (const x of [-.22,.22]) add(.035,.65,.04,x,.51,.246,0x35393c);
    add(.34,.18,.035,0,.49,.259,0x1d1d1e);
    add(.28,.025,.039,0,.50,.281,0xd6b34c);
    add(.40,.12,.08,0,1.02,0,0x202326);
  }
  if (name === 'busBench' || name === 'parkBench') {
    if(name === 'parkBench') {
      // Angled backrest and separated weathered slats.
      for (let i=0;i<4;i++) {
        const slat=add(1.78,.12,.085,0,.67+i*.17,-.20-i*.06,timber);
        slat.rotation.x=-.24;
      }
      for(let i=0;i<3;i++) add(1.78,.065,.125,0,.47,.18-i*.18,0x55565a);
      for(const x of [-.68,.68]) {
        add(.12,.51,.34,x,.255,-.02,0x30363b);
        add(.10,.73,.11,x,.67,-.28,0x30363b);
      }
    } else {
      for(let i=0;i<3;i++) add(1.60,.025,.10,0,.565,-.17+i*.16,0x9d352b);
    }
  }
  if(name.startsWith('wheelieBin')) {
    const colours: Record<string,number> = {
      wheelieBinBlack:0x34383b,wheelieBinBrown:0x99724f,
      wheelieBinGreen:0x729b67,wheelieBinBlue:0x2167b7
    };
    const c=colours[name];
    add(.67,1.04,.67,0,.56,0,c);
    add(.74,.12,.77,0,1.12,0,c);
    add(.62,.035,.09,0,1.19,-.33,c);
    for(const x of [-.25,.25]) {
      const wheel=cylinder(g,.105,.07,x,.12,-.36,0x171b1e);
      wheel.rotation.z=Math.PI/2;
      add(.025,.76,.03,x,.59,.35,0x454b4e);
    }
    add(.41,.43,.015,0,.69,.345,c===0x34383b?0x414649:c);
    add(.45,.025,.015,0,.92,.36,0x4c5254);
    add(.45,.045,.07,0,1.11,.37,0x252b30);
  }
  // Mark all enhanced props for later texture/LOD pipeline.
  g.userData.referenceEnhanced = true;
  g.userData.materialStyle = 'stylised UK street furniture; procedural PBR';
}

/**
 * Detail pass v3. Standalone models only. Geometry is real, not flat decal art.
 * Canvas texture generation is deterministic and browser-only; falls back to PBR
 * materials if canvas is unavailable. Shared geometries remain small.
 */
function surfaceTexture(base: number, seed = 17): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d'); if (!ctx) return null;
  const col = new THREE.Color(base);
  ctx.fillStyle = '#' + col.getHexString(); ctx.fillRect(0,0,256,256);
  let n = seed;
  const rand=()=>{n=(n*1664525+1013904223)>>>0;return n/4294967296;};
  // Fine paint/plastic grain, scratches and grime around edges.
  for(let i=0;i<2600;i++){
    const x=rand()*256,y=rand()*256,edge=Math.min(x,y,256-x,256-y);
    ctx.fillStyle=rand()>.5?'rgba(255,255,255,.055)':'rgba(0,0,0,.075)';
    if(edge<18)ctx.fillStyle='rgba(22,19,17,.12)';
    ctx.fillRect(x,y,rand()*2+0.3,rand()*3+.3);
  }
  for(let i=0;i<24;i++){
    ctx.strokeStyle='rgba(230,225,207,.09)';ctx.lineWidth=.4+rand();
    const x=rand()*256,y=rand()*256;
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+rand()*18-9,y+rand()*24-12);ctx.stroke();
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=4;
  return texture;
}
function upgradeDepthAndSurfaces(g: THREE.Group, name: StreetAssetName) {
  const B=(w:number,h:number,d:number,x:number,y:number,z:number,c:number)=>box(g,w,h,d,x,y,z,c);
  const metallic=0x292e32, gold=0xc7a04b, black=0x151719;
  // Give painted metal and moulded plastic nonuniform surfaces, not flat colour.
  const textured = new Map<number, THREE.Texture | null>();
  g.traverse(obj=>{
    if(!(obj instanceof THREE.Mesh))return;
    const m=obj.material;
    if(!(m instanceof THREE.MeshStandardMaterial))return;
    const hex=m.color.getHex();
    if(hex===C.glass){
      m.transparent=true;m.opacity=.23;m.metalness=.05;m.roughness=.14;
      m.depthWrite=false;m.side=THREE.DoubleSide;
    } else {
      if(!textured.has(hex))textured.set(hex,surfaceTexture(hex,hex%10000));
      const tex=textured.get(hex);
      if(tex){m.map=tex;m.color.setHex(0xffffff);m.needsUpdate=true;}
      m.roughness=hex===C.steel?.42:.72;
    }
  });
  if(name==='telephoneBox'){
    // Four distinct inset-glass wall frames; full front door with a visible
    // separate hinged leaf, raised glazing bars, handle, lock and threshold.
    // Front faces positive Z; door pivot on front-left jamb.
    const hinge=new THREE.Group();hinge.name='Hinged telephone box door';
    hinge.position.set(-.42,0,.475);g.add(hinge);
    const d=(w:number,h:number,depth:number,x:number,y:number,z:number,c:number)=>{
      const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,depth),mat(c,.38,.38));
      m.position.set(x,y,z);m.castShadow=true;hinge.add(m);return m;
    };
    d(.085,1.98,.09,.04,1.08,0,C.red);
    d(.085,1.98,.09,.80,1.08,0,C.red);
    d(.86,.09,.10,.42,2.02,0,C.red);
    d(.86,.12,.10,.42,.13,0,C.red);
    d(.86,.085,.10,.42,1.20,0,C.red);
    for(const y of [.43,.76,1.52,1.79])d(.76,.045,.075,.42,y,.02,C.red);
    const glass=new THREE.Mesh(new THREE.BoxGeometry(.70,.66,.015),
      new THREE.MeshPhysicalMaterial({color:0xb2d1dc,transparent:true,opacity:.24,
        roughness:.13,metalness:0,depthWrite:false,side:THREE.DoubleSide}));
    glass.position.set(.42,1.65,.005);hinge.add(glass);
    d(.065,.20,.07,.74,1.04,.085,0xc4c8c8);
    d(.065,.09,.075,.74,.91,.09,black);
    for(const y of [.48,1.52])B(.08,.10,.12,-.425,y,.48,0x8b171d);
    B(.93,.07,.24,0,.09,.50,0x5c6062);
    // Raised cream nameplate and red header moulding.
    B(.80,.19,.055,0,2.31,.54,0xe7dcbf);
    B(.98,.06,.11,0,2.49,.03,0x8f1722);
    // Keep the leaf closed by default; set rotation.y to open it in the viewer.
    hinge.userData={interactivePart:'door',opensOnY:true};
  }
  if(name==='busShelter'){
    // Transparent glazing with real mullions and layered roof fascia.
    for(const x of [-1.46,0,1.46]){
      B(.055,1.82,.065,x,1.22,-.48,metallic);
    }
    B(3.18,.09,.08,0,2.11,-.47,metallic);
    B(3.2,.06,.09,0,.34,-.47,metallic);
    for(const x of [-1.46,1.46])B(.07,1.75,.90,x,1.22,0,metallic);
    B(3.36,.09,1.31,0,2.55,0,black);
    // LED pixels and a framed route information board.
    for(let row=0;row<3;row++)for(let i=0;i<16;i++)
      B(.025,.018,.01,.41+i*.039,2.27-row*.078,.672,0xee3034);
    B(.08,1.45,.65,-1.43,1.14,-.05,metallic);
    B(.045,1.28,.52,-1.38,1.16,-.05,0xe1e0d8);
    for(let i=0;i<8;i++)B(.018,.025,.42,-1.35,1.64-i*.13,-.04,0x6e777d);
  }
  if(name==='pillarPostBox'){
    // Cast cap, crown-like ribs, door seam and raised collection plate.
    for(let i=0;i<10;i++){
      const a=i*Math.PI/5;
      const rib=cylinder(g,.015,.21,Math.sin(a)*.252,1.23,Math.cos(a)*.252,0x921923);
      rib.rotation.z=.04;
    }
    B(.29,.30,.038,0,.54,.255,0xa51c26);
    B(.20,.15,.045,0,.54,.283,0xd4c8ac);
    B(.30,.028,.055,0,.35,.262,0x87131c);
    B(.37,.07,.075,0,1.04,.263,black);
  }
  if(name==='litterBin'){
    B(.44,.69,.065,0,.50,.265,0x1c2024);
    for(const x of [-.20,.20])B(.025,.71,.07,x,.50,.30,gold);
    B(.45,.035,.08,0,.87,.28,gold);
    B(.45,.035,.08,0,.14,.28,gold);
    B(.29,.17,.065,0,.53,.318,black);
    B(.26,.025,.073,0,.60,.35,gold);
    for(const x of [-.18,.18])B(.07,.16,.07,x,1.02,0,black);
  }
  if(name==='parkBench'){
    // Slat seams, bolts, thicker cast feet and worn timber edging.
    for(const x of [-.69,.69]){
      for(const y of [.48,.80,1.10])cylinder(g,.019,.018,x,y,-.25,0xaeb1b3);
      B(.24,.07,.42,x,.055,-.02,0x272b2f);
    }
    for(let i=0;i<4;i++)B(1.72,.016,.012,0,.67+i*.17,-.252-i*.06,0x8a8276);
  }
  if(name.startsWith('wheelieBin')){
    // Recessed body panels, lip, lid hinge, axles and treaded rubber wheels.
    B(.54,.70,.025,0,.57,.352,0x323c42);
    const colour=name==='wheelieBinBlue'?0x2d74c3:name==='wheelieBinGreen'?0x82a77b:
      name==='wheelieBinBrown'?0xa57b54:0x44494e;
    B(.49,.65,.027,0,.57,.371,colour);
    for(const x of [-.27,.27])B(.025,.70,.05,x,.57,.39,colour);
    for(const x of [-.24,.24]){
      const wheel=cylinder(g,.125,.065,x,.13,-.37,black);wheel.rotation.z=Math.PI/2;
      cylinder(g,.032,.072,x,.13,-.37,0x7b8388).rotation.z=Math.PI/2;
    }
    B(.70,.06,.09,0,1.19,-.32,colour);
    B(.49,.06,.04,0,1.17,.39,black);
  }
  if(name==='wallPostBox'){
    B(.36,.42,.06,0,.54,.155,0x9f1923);
    B(.26,.18,.07,0,.48,.19,0xd3c8a9);
    B(.38,.065,.085,0,.73,.18,black);
  }
  if(name==='electricalCabinet'){
    for(const x of [-.33,.33])B(.03,1.27,.05,x,.76,.27,0x455f51);
    for(let i=0;i<4;i++)B(.38,.024,.05,0,.39+i*.09,.27,0x385449);
    B(.07,.12,.07,.32,.77,.30,0x181d1d);
  }
  g.userData.detailVersion=3;
  g.userData.textureType='procedural painted metal/plastic grain, PBR';
}

/**
 * V4 complete replacements for the six weakest models.
 * All six are rebuilt from scratch, avoiding overlapping legacy geometry.
 * Orientation: +Z is front. Units: metres. Doors are physically modelled.
 */
function buildReworkedStreetAsset(g: THREE.Group, name: StreetAssetName) {
  const red=0xb91f2b, redShadow=0x8d1822, ink=0x1b2025, brass=0xc6a35a;
  const steel=0x343b42, paper=0xe6e2d5;
  const add=(w:number,h:number,d:number,x:number,y:number,z:number,c:number)=>box(g,w,h,d,x,y,z,c);
  const cyl=(r:number,h:number,x:number,y:number,z:number,c:number,top=r)=>cylinder(g,r,h,x,y,z,c,top);
  const glassMat=new THREE.MeshPhysicalMaterial({color:0xbad7df,metalness:0,roughness:.13,transparent:true,opacity:.28,depthWrite:false,side:THREE.DoubleSide});
  const glazing=(w:number,h:number,x:number,y:number,z:number,rotation=0)=>{
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,.012),glassMat.clone());
    m.position.set(x,y,z);m.rotation.y=rotation;g.add(m);return m;
  };
  const plaque=(w:number,h:number,x:number,y:number,z:number,c=paper)=>{
    add(w+.055,h+.055,.045,x,y,z-.01,ink);
    add(w,h,.05,x,y,z+.02,c);
  };
  const makeDoor=(x:number,z:number,width:number,height:number,colour:number)=>{
    const hinge=new THREE.Group();hinge.name='Door with hinge, handle and glass panes';
    hinge.position.set(x,0,z);g.add(hinge);
    const part=(w:number,h:number,d:number,px:number,py:number,pz:number,c:number)=>{
      const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(c,.22,.48));
      m.position.set(px,py,pz);m.castShadow=true;hinge.add(m);return m;
    };
    for(const px of [.045,width-.045])part(.085,height,.105,px,height/2,0,colour);
    for(const py of [.11,.87,1.62,height-.06])part(width,.095,.105,width/2,py,0,colour);
    for(const py of [.47,1.24,1.93])part(width-.1,.045,.075,width/2,py,.014,colour);
    for(const py of [1.05,1.42,1.78]) {
      const gm=new THREE.Mesh(new THREE.BoxGeometry(width-.15,.28,.012),glassMat.clone());
      gm.position.set(width/2,py,0);hinge.add(gm);
    }
    part(.055,.16,.10,width-.15,.98,.09,brass);
    part(.07,.06,.11,width-.15,.86,.09,ink);
    hinge.userData={part:'operableDoor',axis:'y',closedRotation:0};
    return hinge;
  };
  if(name==='telephoneBox') {
    // Distinct iconic red British K6-style kiosk: solid corner posts, glazed
    // three sides, four-panel door, raised fascia and domed stepped crown.
    const r=.49;
    add(1.08,.12,1.08,0,.06,0,redShadow);
    for(const x of [-r,r])for(const z of [-r,r]) {
      add(.115,2.23,.115,x,1.17,z,red);
      add(.14,.14,.14,x,.20,z,redShadow);
    }
    for(const y of [2.25,2.40])add(1.10,.11,1.10,0,y,0,red);
    add(1.12,.08,1.12,0,2.52,0,redShadow);
    const dome=new THREE.Mesh(new THREE.SphereGeometry(.61,24,12,0,Math.PI*2,0,Math.PI/2),mat(red,.12,.4));
    dome.scale.set(1,.27,1);dome.position.y=2.52;g.add(dome);
    // Side and back windows, divided by glazing bars.
    for(const z of [-.49]){
      glazing(.83,1.75,0,1.22,z);
      for(const x of [-.17,.17])add(.045,1.79,.06,x,1.22,z,red);
      for(const y of [.60,1.02,1.45,1.87])add(.88,.047,.06,0,y,z,red);
    }
    for(const x of [-.49,.49]){
      glazing(.83,1.75,x,1.22,0,Math.PI/2);
      for(const z of [-.17,.17])add(.06,1.79,.045,x,1.22,z,red);
      for(const y of [.60,1.02,1.45,1.87])add(.06,.047,.87,x,y,0,red);
    }
    const door=makeDoor(-.44,.505,.88,2.18,red);
    door.name='K6 telephone kiosk front door';
    plaque(.76,.19,0,2.34,.558,0xf4e9d1);
    add(.90,.045,.09,0,2.21,.55,redShadow);
    add(.90,.055,.15,0,.12,.56,steel);
    // Inner telephone fixture visible through glazing.
    add(.30,.54,.15,0,1.18,-.38,0x34383c);
    add(.18,.18,.08,0,1.30,-.27,0xbbbcb6);
  } else if(name==='litterBin'){
    // Cast iron heritage UK litter bin: tapering faceted body, separate lid,
    // pronounced gold trim, deep openings and recessed front plaque.
    const body=new THREE.Mesh(new THREE.CylinderGeometry(.31,.39,1.04,8),mat(0x202428,.65,.64));
    body.rotation.y=Math.PI/8;body.position.y=.59;body.castShadow=true;g.add(body);
    const foot=new THREE.Mesh(new THREE.CylinderGeometry(.39,.41,.11,8),mat(ink,.5,.7));
    foot.position.y=.06;g.add(foot);
    for(const y of [.15,.96]){
      const ring=new THREE.Mesh(new THREE.CylinderGeometry(y>.5?.365:.40,y>.5?.365:.40,.045,8),mat(brass,.65,.4));
      ring.rotation.y=Math.PI/8;ring.position.y=y;g.add(ring);
    }
    const lid=new THREE.Mesh(new THREE.CylinderGeometry(.41,.39,.16,8),mat(ink,.55,.52));
    lid.rotation.y=Math.PI/8;lid.position.y=1.14;g.add(lid);
    const cap=new THREE.Mesh(new THREE.CylinderGeometry(.23,.34,.15,8),mat(ink,.5,.5));
    cap.position.y=1.28;g.add(cap);
    // Real openings: dark inset pockets beneath raised lid, not just stripes.
    for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
      const opening=add(.28,.17,.04,Math.sin(a)*.33,1.06,Math.cos(a)*.33,0x070809);
      opening.rotation.y=a;
      const rim=add(.32,.025,.055,Math.sin(a)*.35,1.17,Math.cos(a)*.35,brass);
      rim.rotation.y=a;
    }
    plaque(.34,.23,0,.64,.352,ink);
    add(.28,.045,.06,0,.69,.408,brass);
    add(.28,.025,.06,0,.58,.408,brass);
    for(const x of [-.14,.14])add(.025,.22,.06,x,.64,.409,brass);
  } else if(name==='pillarPostBox'){
    cyl(.255,1.14,0,.65,0,red);
    cyl(.29,.14,0,1.26,0,redShadow);
    cyl(.32,.075,0,1.35,0,red);
    cyl(.29,.075,0,.065,0,redShadow);
    // Octagonal cast finial, inset collection plate and pronounced letter aperture.
    const finial=new THREE.Mesh(new THREE.CylinderGeometry(.17,.24,.13,8),mat(redShadow));
    finial.position.y=1.45;g.add(finial);
    add(.39,.12,.085,0,1.07,.265,ink);
    add(.32,.035,.095,0,1.09,.29,0x08090a);
    plaque(.29,.25,0,.72,.273);
    add(.37,.44,.035,0,.47,.25,redShadow);
    add(.32,.37,.045,0,.47,.272,red);
    for(const y of [.14,1.22])cyl(.266,.025,0,y,0,redShadow);
  } else if(name==='wallPostBox'){
    add(.51,.78,.32,0,.61,0,redShadow);
    add(.46,.72,.345,0,.61,.015,red);
    add(.56,.12,.38,0,1.05,0,redShadow);
    add(.40,.075,.065,0,.81,.215,ink);
    add(.34,.025,.085,0,.83,.245,0x050505);
    plaque(.30,.24,0,.53,.21);
    add(.34,.20,.04,0,.28,.19,redShadow);
  } else if(name==='busStopPole'){
    cyl(.065,2.67,0,1.335,0,steel);
    cyl(.17,.10,0,.055,0,ink);
    // Classic red roundel with visible white central plate.
    const disk=new THREE.Mesh(new THREE.CylinderGeometry(.29,.29,.065,32),mat(red,.15,.5));
    disk.rotation.x=Math.PI/2;disk.position.set(0,2.57,.06);g.add(disk);
    add(.52,.16,.08,0,2.57,.115,paper);
    plaque(.38,.49,0,2.06,.08,paper);
    add(.35,.06,.05,0,2.28,.12,red);
    for(let i=0;i<5;i++)add(.27,.022,.055,0,2.15-i*.07,.13,steel);
    plaque(.37,.34,0,1.51,.08,paper);
  } else if(name==='busShelter'){
    // Black powder-coated steel, layered curved canopy, real transparent
    // panes, red slatted seating and dimensional electronic arrivals board.
    const width=3.25;
    for(const x of [-1.53,0,1.53]) {
      add(.075,2.22,.085,x,1.11,-.46,steel);
      add(.07,2.22,.08,x,1.11,.45,steel);
    }
    for(const y of [.20,1.12,2.15]){
      add(width,.065,.07,0,y,-.46,steel);
    }
    for(const x of [-.76,.76])glazing(1.42,1.82,x,1.17,-.46);
    for(const x of [-1.53,1.53]) {
      const pane=new THREE.Mesh(new THREE.BoxGeometry(.015,1.84,.82),glassMat.clone());
      pane.position.set(x,1.17,0);g.add(pane);
    }
    // Roof ribs and curved arch profile: segments with changing elevation.
    for(let i=0;i<12;i++){
      const z=-.62+i*.115;
      const y=2.33+.13*(1-Math.pow(z/.75,2));
      add(3.45,.055,.13,0,y,z,ink);
    }
    add(3.51,.15,.08,0,2.37,.67,ink);
    add(3.51,.16,.08,0,2.37,-.67,ink);
    for(const x of [-1.55,1.55])add(.09,.09,1.35,x,2.37,0,ink);
    // Bench with independent slats, bright red powder-coated steel.
    for(let i=0;i<3;i++)add(2.35,.035,.12,0,.56,-.22+i*.15,0xb3362f);
    add(2.35,.17,.055,0,.85,-.40,0xb3362f);
    for(const x of [-1.0,1.0])add(.07,.57,.43,x,.29,-.19,steel);
    // Enclosed paper timetable and black-framed LED display.
    add(.82,1.27,.08,-1.03,1.30,-.37,ink);
    add(.71,1.14,.085,-1.03,1.30,-.31,paper);
    for(let i=0;i<9;i++)add(.52,.023,.018,-1.03,1.72-i*.10,-.256,0x72787b);
    add(1.24,.34,.10,.83,2.05,.48,ink);
    for(let row=0;row<3;row++)for(let i=0;i<18;i++)
      add(.029,.017,.012,.49+i*.038,2.15-row*.085,.54,0xf03836);
  }
  // Avoid remote dependencies for textures; all model geometry works offline.
  // Weathered paint/plastic maps can be replaced by authored PBR texture sets.
  g.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});
}

/* V5 — production preparation: procedural PBR maps, legible labels, model
   validation, ground alignment, sensible pivot and performance metadata.
   All maps are authored in code; no network resources or image licensing.
   No game integration. */
export type AssetAudit = {name: StreetAssetName; meshes:number; triangles:number;
  materials:number; drawCallsEstimate:number; width:number;height:number;depth:number;
  groundOffset:number; issues:string[]; passes:boolean};
const textureCache=new Map<string, {color:THREE.CanvasTexture;normal:THREE.CanvasTexture;roughness:THREE.CanvasTexture}>();
function authoredMaps(hex:number,kind:string) {
  if(typeof document==='undefined')return null;
  const key=hex+'-'+kind;if(textureCache.has(key))return textureCache.get(key)!;
  const c=document.createElement('canvas'),n=document.createElement('canvas'),r=document.createElement('canvas');
  for(const x of [c,n,r]){x.width=256;x.height=256;}
  const cc=c.getContext('2d'),nc=n.getContext('2d'),rc=r.getContext('2d');
  if(!cc||!nc||!rc)return null;
  const base=new THREE.Color(hex);
  let seed=hex>>>0;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
  cc.fillStyle='#'+base.getHexString();cc.fillRect(0,0,256,256);
  nc.fillStyle='#8080ff';nc.fillRect(0,0,256,256);
  rc.fillStyle=kind==='metal'?'#858585':'#b6b6b6';rc.fillRect(0,0,256,256);
  for(let i=0;i<4500;i++){
    const x=rand()*256,y=rand()*256,w=.5+rand()*2;
    const wear=rand();
    cc.fillStyle=wear>.48?'rgba(255,255,255,.045)':'rgba(0,0,0,.055)';
    cc.fillRect(x,y,w,w);
    nc.fillStyle=wear>.5?'rgba(146,132,255,.20)':'rgba(111,126,255,.19)';
    nc.fillRect(x,y,w,w);
    rc.fillStyle=wear>.5?'rgba(255,255,255,.12)':'rgba(0,0,0,.10)';
    rc.fillRect(x,y,w,w);
  }
  if(kind==='wood'){
    for(let i=0;i<70;i++){
      const y=rand()*256;
      cc.strokeStyle='rgba(12,9,6,.10)';cc.lineWidth=.5+rand()*2;
      cc.beginPath();cc.moveTo(0,y);cc.bezierCurveTo(80,y+rand()*8,160,y-rand()*8,256,y+rand()*5);cc.stroke();
    }
  }
  const make=(canvas:HTMLCanvasElement,color:boolean)=>{
    const t=new THREE.CanvasTexture(canvas);t.wrapS=t.wrapT=THREE.RepeatWrapping;
    t.anisotropy=4;if(color)t.colorSpace=THREE.SRGBColorSpace;return t;
  };
  const out={color:make(c,true),normal:make(n,false),roughness:make(r,false)};
  textureCache.set(key,out);return out;
}
function addLabel(g:THREE.Group,text:string,w:number,h:number,x:number,y:number,z:number,
  bg='#f5f1e6',fg='#1d252c',fontSize=60) {
  if(typeof document==='undefined')return;
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
  const ctx=canvas.getContext('2d');if(!ctx)return;
  ctx.fillStyle=bg;ctx.fillRect(0,0,512,256);
  ctx.fillStyle=fg;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font='bold '+fontSize+'px Arial, sans-serif';
  const lines=text.split('\n');
  lines.forEach((line,i)=>ctx.fillText(line,256,128+(i-(lines.length-1)/2)*fontSize*1.15,470));
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),
    new THREE.MeshBasicMaterial({map:tex,transparent:false,side:THREE.DoubleSide}));
  mesh.position.set(x,y,z);mesh.name='Printed sign: '+text.replace(/\n/g,' / ');
  g.add(mesh);
}
function finishProductionAsset(g:THREE.Group,name:StreetAssetName) {
  if(!['parkBench','busBench','telephoneBox'].includes(name))finishEdgesV8(g,name);
  // Existing models use separate geometry per mesh; keep the art untouched,
  // replace bland surface materials and apply text on their visible front.
  // Stable physically-based solid materials. Do not allocate hundreds of
  // canvas maps on mobile: original colours must survive every load.
  const stable=new Map<string,THREE.MeshStandardMaterial>();
  g.traverse(obj=>{
    if(!(obj instanceof THREE.Mesh))return;
    obj.castShadow=true;obj.receiveShadow=true;
    const old=obj.material;
    if(!(old instanceof THREE.MeshStandardMaterial))return;
    if(old.transparent||old.opacity<.99)return;
    // Legacy detail passes set colour to white and put colour in CanvasTexture.
    // Recover that colour from the first pixel of the source canvas when needed.
    let hex=old.color.getHex();
    if(hex===0xffffff&&old.map instanceof THREE.CanvasTexture){
      const canvas=old.map.image as HTMLCanvasElement;
      try{const ctx=canvas.getContext('2d');if(ctx){
        const px=ctx.getImageData(1,1,1,1).data;
        hex=(px[0]<<16)|(px[1]<<8)|px[2];
      }}catch(_e){/* retain colour if canvas unavailable */}
    }
    const metal=old.metalness>.24;
    const key=hex+':'+(metal?'metal':'paint');
    let m=stable.get(key);
    if(!m){
      m=new THREE.MeshStandardMaterial({color:hex,metalness:metal?.42:.05,
        roughness:metal?.48:.76});
      stable.set(key,m);
    }
    obj.material=m;
  });
  const text=(t:string,w:number,h:number,x:number,y:number,z:number,bg?:string,fg?:string,fs?:number)=>
    addLabel(g,t,w,h,x,y,z,bg,fg,fs);
  switch(name){
    case 'telephoneBox':
      text('TELEPHONE',.76,.16,0,2.35,.585,'#f8f1de','#8e1a22',68);break;
    case 'pillarPostBox':
      text('POST\nCOLLECTION',.23,.18,0,.72,.325,'#e4d7b8','#202329',36);break;
    case 'wallPostBox':
      text('POST\nCOLLECTION',.25,.17,0,.53,.255,'#e9dfc6','#272b2e',34);break;
    case 'busStopPole':
      text('BUS STOP',.45,.105,0,2.57,.161,'#f5f1e6','#a21d26',50);
      text('ROUTES\n1  12  36',.30,.36,0,2.05,.139,'#f4f1e9','#20252c',38);break;
    case 'busShelter':
      text('NEXT BUSES',1.05,.12,.83,2.08,.548,'#131719','#ef4c44',43);
      text('BUS TIMES',.58,.13,-1.03,1.73,-.248,'#f5f1e6','#242b30',49);break;
    case 'litterBin':
      text('LITTER',.25,.11,0,.64,.446,'#1a1c1e','#d7b765',50);break;
    case 'streetNameSign':
      text('HIGH STREET',1.45,.23,0,1.72,.084,'#fafaf7','#242a30',54);break;
    case 'roadSign':
      text('TOWN CENTRE',1.06,.33,0,2.10,.090,'#20598b','#ffffff',42);break;
    case 'timetableBoard':
      text('TIMETABLE',.49,.14,0,1.81,.113,'#f4f0e6','#22292e',43);break;
  }
  // Position origin at ground centre; preserve dimensions, do not rescale.
  g.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(g);
  if(Number.isFinite(bounds.min.y)&&Math.abs(bounds.min.y)>.001){
    for(const child of g.children)child.position.y-=bounds.min.y;
  }
  g.updateMatrixWorld(true);
  const audit=auditStreetAsset(g,name);
  g.userData={...g.userData,productionPass:8,audit};
  return g;
}
export function auditStreetAsset(g:THREE.Group,name:StreetAssetName):AssetAudit {
  let meshes=0,triangles=0;
  const mats=new Set<THREE.Material>();
  const issues:string[]=[];
  g.updateMatrixWorld(true);
  g.traverse(o=>{
    if(!(o instanceof THREE.Mesh))return;
    meshes++;
    const geom=o.geometry;
    if(!geom||!geom.attributes.position){issues.push('Missing mesh geometry');return;}
    triangles+=geom.index?geom.index.count/3:geom.attributes.position.count/3;
    const list=Array.isArray(o.material)?o.material:[o.material];
    for(const m of list)if(m)mats.add(m);
    if(![o.position.x,o.position.y,o.position.z].every(Number.isFinite))
      issues.push('Non-finite mesh position');
  });
  const bb=new THREE.Box3().setFromObject(g),size=bb.getSize(new THREE.Vector3());
  if(bb.isEmpty())issues.push('Empty geometry');
  if(size.y<.05||size.y>8)issues.push('Suspicious height');
  if(Math.abs(bb.min.y)>.025)issues.push('Not grounded');
  if(triangles>25000)issues.push('Exceeds 25k triangle budget');
  if(meshes>450)issues.push('Exceeds 450 draw-call budget');
  if(size.x>12||size.z>12)issues.push('Unusually large asset footprint');
  return {name,meshes,triangles:Math.round(triangles),materials:mats.size,
    drawCallsEstimate:meshes,width:+size.x.toFixed(3),height:+size.y.toFixed(3),
    depth:+size.z.toFixed(3),groundOffset:+bb.min.y.toFixed(3),
    issues,passes:issues.length===0};
}

/** V7 dimensional art pass for all fifteen assets not rebuilt in v4.
 * Adds distinct silhouette details without touching the game. */
function polishEveryRemainingAsset(g:THREE.Group,name:StreetAssetName){
 const dark=0x22282e,steel=0x6f7a80,white=0xeae8dd,red=0xb32a32,
   yellow=0xe9c64c,wood=0x665043,shadow=0x14191d;
 const B=(w:number,h:number,d:number,x:number,y:number,z:number,c:number)=>{
   const m=box(g,w,h,d,x,y,z,c);m.name='V7 dimensional detail';return m;};
 const C=(r:number,h:number,x:number,y:number,z:number,c:number)=>cylinder(g,r,h,x,y,z,c);
 const bolt=(x:number,y:number,z:number)=>C(.014,.018,x,y,z,0xc3c8c9);
 switch(name){
 case 'busBench':
   for(let i=0;i<4;i++)B(1.62,.035,.082,0,.59,-.21+i*.14,0xb82f2e);
   for(const x of [-.68,.68]){
     B(.08,.30,.06,x,.72,-.23,dark);
     B(.18,.045,.36,x,.05,0,dark);
     for(const y of [.54,.84])bolt(x,y,.29);
   }break;
 case 'timetableBoard':
   B(.72,1.01,.06,0,1.51,.105,dark);
   B(.61,.88,.02,0,1.51,.146,white);
   B(.61,.12,.026,0,1.90,.164,red);
   for(let i=0;i<10;i++){
     B(.44,.013,.027,-.045,1.78-i*.068,.171,i%3===0?0x4a6175:0xabb0ad);
     B(.07,.013,.028,.24,1.78-i*.068,.172,0x9a9e9b);
   }
   for(const x of [-.29,.29])for(const y of [1.07,1.95])bolt(x,y,.18);
   break;
 case 'streetLamp':
   C(.115,.14,0,.075,0,dark);
   C(.07,.23,0,3.10,0,steel);
   B(.48,.08,.29,1.03,4.29,0,dark);
   B(.40,.025,.24,1.03,4.235,0,0xfff2c0);
   for(const x of [.84,1.22])B(.025,.11,.25,x,4.29,0,steel);
   break;
 case 'bollard':
   C(.14,.07,0,.045,0,shadow);
   C(.13,.055,0,.85,0,steel);
   C(.15,.07,0,.93,0,dark);
   for(const y of [.66,.72])C(.115,.017,0,y,0,0xd6d8d3);
   break;
 case 'railings':
   for(let i=0;i<6;i++){
     const x=-1.25+i*.5;
     C(.085,.09,x,.045,0,shadow);
     C(.063,.085,x,1.10,0,dark);
     C(.045,.055,x,1.16,0,steel);
     B(.12,.018,.09,x,.30,.002,steel);
   }
   for(const y of [.28,.89])B(2.65,.016,.075,0,y,.042,steel);
   break;
 case 'recyclingBin':
   B(.58,.06,.51,0,.99,0,0x2a3438);
   B(.34,.16,.035,0,.77,.255,0x0c1719);
   B(.30,.13,.04,0,.47,.26,white);
   B(.44,.03,.055,0,.22,.258,0x1d6551);
   for(const x of [-.23,.23])B(.03,.68,.045,x,.50,.256,0x235e4a);
   break;
 case 'electricalCabinet':
   B(.84,1.35,.035,0,.75,.255,0x315c48);
   B(.76,1.25,.025,0,.76,.28,0x567563);
   for(const x of [-.33,.33])B(.025,1.28,.045,x,.76,.30,0x244738);
   for(let i=0;i<8;i++)B(.35,.013,.035,0,.36+i*.035,.306,0x263d34);
   B(.06,.14,.055,.29,.76,.31,shadow);
   B(.18,.12,.025,-.17,1.18,.306,0xd4cdb6);
   break;
 case 'streetNameSign':
   B(1.77,.40,.045,0,1.72,.055,0x272f36);
   B(1.65,.32,.025,0,1.72,.086,white);
   for(const x of [-.73,.73])for(const y of [1.58,1.85])bolt(x,y,.105);
   break;
 case 'pedestrianCrossing':
   for(let i=0;i<5;i++){
     B(2.7,.003,.018,0,.036,-1.35+i*.6,0xd0d0c9);
     B(2.7,.003,.018,0,.036,-1.05+i*.6,0xd0d0c9);
   }
   for(const x of [-1.45,1.45])for(const z of [-1.5,1.5])
     B(.035,.035,.12,x,.04,z,0x555c5e);
   break;
 case 'roadSign':
   B(1.28,.62,.045,0,2.1,.09,white);
   B(1.18,.52,.03,0,2.1,.125,0x216397);
   for(const x of [-.52,.52])bolt(x,2.1,.15);
   break;
 case 'parkBench':
   for(let i=0;i<4;i++){
     const slat=B(1.82,.025,.035,0,.67+i*.17,-.20-i*.06,0x95765b);
     slat.rotation.x=-.24;
   }
   for(let i=0;i<3;i++)B(1.80,.025,.03,0,.49,.18-i*.18,0x94765b);
   for(const x of [-.72,.72]){
     B(.14,.09,.36,x,.045,0,shadow);
     for(const y of [.48,.77,1.04])bolt(x,y,-.28);
   }break;
 case 'wheelieBinBlack':case 'wheelieBinBrown':
 case 'wheelieBinGreen':case 'wheelieBinBlue':{
   const colour=name==='wheelieBinBlue'?0x286db4:name==='wheelieBinGreen'?0x68935c:
     name==='wheelieBinBrown'?0x8c674b:0x353a3f;
   B(.68,.07,.77,0,1.18,0,colour);
   B(.60,.025,.045,0,1.22,.34,0x262d31);
   for(const x of [-.29,.29]){
     B(.022,.78,.04,x,.59,.354,colour);
     B(.12,.05,.09,x,.07,-.36,shadow);
   }
   for(const y of [.38,.95])B(.50,.02,.03,0,y,.365,0x59636a);
   B(.38,.20,.026,0,.65,.383,colour);
   break;
 }
 }
 g.userData.visualRevision=7;
}

/** V8 finishing details: bevel-like edge highlights, ground feet, and
 * unmistakable material contrast without fragile generated colour textures.
 * These are decorative geometry only, not gameplay collision meshes. */
function finishEdgesV8(g:THREE.Group,name:StreetAssetName){
 const B=(w:number,h:number,d:number,x:number,y:number,z:number,c:number)=>
   box(g,w,h,d,x,y,z,c);
 const dark=0x252a30,chrome=0xb8bec0,amber=0xd5ae55;
 switch(name){
 case 'busShelter':
   for(const x of [-1.55,1.55]){
     B(.12,.055,1.32,x,.035,0,dark);
     B(.026,1.7,.03,x,1.2,.48,chrome);
   }
   B(3.35,.025,.045,0,2.48,.65,chrome);
   break;
 case 'telephoneBox':
   for(const x of [-.47,.47])B(.028,1.9,.035,x,1.18,.535,0xd34846);
   B(.90,.03,.06,0,.07,.54,chrome);
   break;
 case 'litterBin':
   B(.25,.035,.055,0,.42,.36,amber);
   B(.26,.035,.055,0,.83,.36,amber);
   break;
 case 'pillarPostBox':
   B(.32,.025,.055,0,.29,.27,0xd34846);
   break;
 case 'wallPostBox':
   B(.38,.022,.04,0,.29,.24,0xd34846);
   break;
 case 'busStopPole':
   B(.32,.035,.035,0,1.28,.12,chrome);
   break;
 case 'busBench':
   for(const x of [-.72,.72])B(.14,.035,.30,x,.045,0,dark);
   break;
 case 'timetableBoard':
   B(.68,.025,.13,0,1.99,.03,chrome);
   break;
 case 'streetLamp':
   B(.36,.012,.22,1.02,4.175,0,0xfff1bb);
   break;
 case 'bollard':
   B(.24,.028,.24,0,.018,0,dark);
   break;
 case 'railings':
   for(const x of [-1.25,1.25])B(.18,.03,.18,x,.02,0,dark);
   break;
 case 'recyclingBin':
   B(.31,.022,.04,0,.61,.277,chrome);
   break;
 case 'electricalCabinet':
   B(.80,.025,.08,0,1.49,.06,dark);
   break;
 case 'streetNameSign':
   B(1.68,.022,.045,0,1.53,.09,chrome);
   break;
 case 'pedestrianCrossing':
   B(3.0,.009,.03,0,.032,-1.59,0x777d80);
   break;
 case 'roadSign':
   B(1.18,.022,.04,0,1.83,.14,chrome);
   break;
 case 'parkBench':
   for(const x of [-.70,.70])B(.17,.03,.28,x,.018,0,dark);
   break;
 case 'wheelieBinBlack':case 'wheelieBinBrown':
 case 'wheelieBinGreen':case 'wheelieBinBlue':
   B(.55,.02,.035,0,.35,.388,0x687278);
   break;
 }
 g.userData.finishingRevision=8;
}

/** V9 replacements from clean geometry: no layered legacy models. */
function buildReplacementV9(g:THREE.Group,name:StreetAssetName){
 const make=(w:number,h:number,d:number,x:number,y:number,z:number,c:number,metal=.05,rough=.66)=>{
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color:c,metalness:metal,roughness:rough}));
  m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;
 };
 const tube=(a:THREE.Vector3,b:THREE.Vector3,r:number,c:number)=>{
  const delta=b.clone().sub(a),m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,delta.length(),12),new THREE.MeshStandardMaterial({color:c,metalness:.6,roughness:.43}));
  m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());g.add(m);return m;
 };
 const wood=0x856343,woodLight=0xa4835d,steel=0x333c44,black=0x20262c;
 if(name==='parkBench'){
  // 1.8m timber-and-cast-iron park bench, coherent slat count and no floating clips.
  for(const x of [-.72,.72]){
   tube(new THREE.Vector3(x,.075,.30),new THREE.Vector3(x,.52,.22),.043,steel);
   tube(new THREE.Vector3(x,.52,-.27),new THREE.Vector3(x,1.16,-.42),.045,steel);
   tube(new THREE.Vector3(x,.52,.22),new THREE.Vector3(x,.52,-.27),.037,steel);
   make(.20,.05,.50,x,.035,.02,black);
  }
  for(let i=0;i<5;i++){
   const z=-.19+i*.108;
   make(1.82,.055,.091,0,.53,z,i%2?woodLight:wood);
  }
  for(let i=0;i<5;i++){
   const y=.67+i*.127,z=-.285-i*.03;
   const slat=make(1.82,.106,.052,0,y,z,i%2?woodLight:wood);
   slat.rotation.x=-.23;
  }
  for(const x of [-.72,.72]){
   tube(new THREE.Vector3(x,.52,-.27),new THREE.Vector3(x,.52,.22),.027,steel);
   // Subtle dark bolt heads, aligned to the support rather than floating.
   for(const y of [.68,.94,1.18])make(.026,.026,.012,x,y,-.43,black);
  }
 }else if(name==='busBench'){
  // Contemporary UK shelter bench: powder-coated steel supports,
  // five separated red seat planks, five matching backrest planks.
  const redSeat=0xa83a37,frame=0x343d45;
  for(const x of [-.68,.68]){
    make(.085,.46,.085,x,.23,.03,frame,.6);
    make(.18,.045,.42,x,.025,.02,black,.6);
    make(.065,.60,.065,x,.79,-.26,frame,.6);
    // Brackets run BELOW the seat, not across its visible top.
    make(.075,.045,.51,x,.445,-.01,frame,.6);
  }
  for(let i=0;i<5;i++){
    const z=-.24+i*.115;
    make(1.72,.048,.095,0,.515,z,redSeat,.17,.56);
  }
  for(let i=0;i<5;i++){
    const y=.67+i*.105;
    make(1.72,.084,.042,0,y,-.265,0x7b8992,.55,.52);
  }
  for(const x of [-.68,.68]){
    make(.065,.10,.04,x,.66,-.27,frame,.6);
    make(.065,.10,.04,x,1.08,-.27,frame,.6);
  }
 }else if(name==='telephoneBox'){
  const red=0xba2631,trim=0x8c1724,glass=0xb9d5dd;
  make(1.04,.12,1.04,0,.06,0,trim,.3);
  for(const x of [-.46,.46])for(const z of [-.46,.46]){
   make(.11,2.22,.11,x,1.18,z,red,.2,.48);
  }
  // Each elevation is individually glazed in every opening, including the
  // very top and bottom rows of the front door. Separate panes avoid a
  // single sheet intersecting the red muntins or appearing absent at edges.
  const glassMaterial=new THREE.MeshPhysicalMaterial({
    color:0xd9eaf0,metalness:0,roughness:.085,
    transparent:true,opacity:.32,depthWrite:false,side:THREE.DoubleSide
  });
  const columns=[[-.39,-.15],[-.12,.12],[.15,.39]] as const;
  const rows=[[.245,.555],[.605,1.015],[1.065,1.475],[1.525,1.935],[1.985,2.075]] as const;
  for(const side of ['front','back','left','right']){
    const horizontal=side==='front'||side==='back';
    const fixed=(side==='front'||side==='right')?.478:-.478;
    for(const [lo,hi] of columns)for(const [bottom,top] of rows){
      const pane=new THREE.Mesh(
        new THREE.PlaneGeometry(hi-lo-.008,top-bottom-.008),glassMaterial
      );
      if(horizontal)pane.position.set((lo+hi)/2,(bottom+top)/2,fixed);
      else{
        pane.rotation.y=Math.PI/2;
        pane.position.set(fixed,(bottom+top)/2,(lo+hi)/2);
      }
      pane.name=side+' glazed opening '+bottom.toFixed(2)+'-'+top.toFixed(2);
      pane.renderOrder=3;g.add(pane);
    }
    for(const v of [-.135,.135]){
      if(horizontal)make(.033,1.85,.047,v,1.16,fixed-.018,red,.2,.52);
      else make(.047,1.85,.033,fixed-.018,1.16,v,red,.2,.52);
    }
    for(const y of [.58,1.04,1.50,1.96]){
      if(horizontal)make(.81,.048,.055,0,y,fixed-.018,red,.2,.52);
      else make(.055,.048,.81,fixed-.018,y,0,red,.2,.52);
    }
    if(side==='front'){
      make(.065,1.98,.09,-.395,1.16,.49,trim,.2);
      make(.065,1.98,.09,.395,1.16,.49,trim,.2);
      make(.038,.15,.06,.35,1.10,.53,0xbba15e,.75,.3);
      make(.05,.045,.06,.35,.98,.53,black,.65);
    }
  }
  // Nameplate is placed proud of the front fascia so it is not occluded.
  make(1.08,.27,1.08,0,2.34,0,red,.2,.5);
  make(.83,.185,.026,0,2.35,.557,0xf8f1de,.05,.7);
  make(1.12,.075,1.12,0,2.515,0,trim,.2,.45);
  const roof=new THREE.Mesh(new THREE.SphereGeometry(.56,32,12,0,Math.PI*2,0,Math.PI/2),new THREE.MeshStandardMaterial({color:red,metalness:.15,roughness:.48}));
  roof.scale.y=.30;roof.position.y=2.52;g.add(roof);
  make(.85,.04,.10,0,.14,.52,black,.4);
  // Interior telephone visible through front glazing.
  make(.30,.50,.13,0,1.23,-.39,steel,.3);
  make(.16,.16,.045,0,1.34,-.31,0xc6c6c1,.2);
 }
 g.userData.replacementRevision=11;
}


// SFUK_APPROVED_BATCHES_01_02
/** User-approved 2026-11-19. Retains original assets, excludes duplicate globeStreetLight. */
/** Isolated Street Fight UK batch 01. No game imports or registrations. */
const BATCH1_ASSETS=[
{id:'retailCounter',label:'Retail counter',category:'interior'},
{id:'highTable',label:'High café table',category:'interior'},
{id:'stockedShelves',label:'Stocked shop shelves',category:'interior'},
{id:'manholeCover',label:'Rectangular UK utility access cover',category:'street'},
{id:'queueBarrier',label:'UK queue barrier — closed/retracted',category:'interior'},
{id:'queueBarrierOpen',label:'UK queue barrier — two posts connected',category:'interior'},
{id:'queueBarrierLine',label:'UK queue barrier — three-post straight run',category:'interior'},
{id:'queueBarrierCorner',label:'UK queue barrier — L-shaped connected run',category:'interior'},
{id:'drinksFridge',label:'Glass-door drinks fridge',category:'interior'},
{id:'streetPlanter',label:'Street planter',category:'street'},
{id:'globeStreetLight',label:'UK swan-neck street lamp',category:'street'},
{id:'shopCounterTill',label:'Shop counter with till',category:'interior'},
{id:'cardboardBox',label:'Cardboard shipping box',category:'interior'}
] as const;
type Batch1AssetId=typeof BATCH1_ASSETS[number]['id'];
function createBatch1Asset(id:Batch1AssetId):THREE.Group{
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
 if(false && id==='manholeCover'){
  cyl(.49,.075,0,.045,0,dark,64);cyl(.445,.016,0,.09,0,steel,64);
  for(let i=0;i<12;i++){const a=i*Math.PI/6;const o=box(.055,.016,.27,Math.cos(a)*.29,.104,Math.sin(a)*.29,dark);o.rotation.y=-a;}
  for(const x of [-.12,.12])box(.12,.018,.035,x,.105,0,black);
 }
 if(false && id==='queueBarrier'){
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
 if(false && id==='streetPlanter'){
  const pot=cyl(.43,.60,0,.32,0,woodDark,8);cyl(.47,.055,0,.62,0,steel,8);cyl(.38,.025,0,.65,0,woodDark,8);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;rod([Math.sin(a)*.14,.65,Math.cos(a)*.14],[Math.sin(a)*.34,1.12,Math.cos(a)*.34],.024,green);const foliage=sphere(.21,Math.sin(a)*.34,1.12,Math.cos(a)*.34,green);foliage.scale.y=1.6;}
  sphere(.28,0,1.18,0,green);
 }
 if(false && id==='globeStreetLight'){
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
 if(false && id==='manholeCover'){
  // Flush UK ductile iron utility cover, double-lifting keyholes and anti-slip ribs.
  for(let i=0;i<7;i++){const z=-.30+i*.10;box(.56,.012,.024,0,.118,z,ink);}
  for(const x of [-.31,.31]){box(.075,.009,.035,x,.126,0,grey);box(.02,.009,.07,x,.13,0,ink);}
  cyl(.51,.025,0,.026,0,grey,64);
 }
 if(false && id==='queueBarrier'){
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
 if(false && id==='streetPlanter'){
  // UK town-centre municipal planter: powder-coated steel bands and shrub foliage.
  for(const y of [.14,.36,.57])cyl(.46,.022,0,y,0,ink,8);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;const o=box(.075,.43,.014,Math.sin(a)*.425,.32,Math.cos(a)*.425,grey);o.rotation.y=a;}
  for(let i=0;i<12;i++){const a=i*2.399;const p=sphere(.10,Math.sin(a)*.24,1.04+(i%3)*.14,Math.cos(a)*.24,green);p.scale.set(1.2,.65,1.4);}
 }
 if(false && id==='globeStreetLight'){
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

 // Rebuilt UK assets: independent geometry, no stacked remnants of earlier prototypes.
 const cast=m(0x414a4d,.45,.86),castEdge=m(0x252d30,.45,.86),paving=m(0x8c8d86,0,.95),galv=m(0x8c999e,.6,.58),tarmac=m(0x353a3e,0,.94),paint=m(0x353e40,.1,.72),leaf=m(0x3f6a42,0,.9),leafLight=m(0x568353,0,.88),bark=m(0x66503b,0,.95);
 if(id==='manholeCover'){
  // Rectangular UK pavement/road access cover, flush frame, raised chequer tread, twin key slots.
  box(.92,.065,.69,0,.033,0,castEdge);
  box(.85,.013,.62,0,.071,0,cast);
  for(const x of [-.43,.43])box(.015,.014,.67,x,.083,0,galv);
  for(const z of [-.315,.315])box(.87,.014,.014,0,.083,z,galv);
  for(let row=0;row<8;row++)for(let col=0;col<11;col++){
   const x=-.365+col*.073,z=-.255+row*.072;
   const rib=box(.034,.006,.009,x,.082,z,castEdge);rib.rotation.y=(row+col)%2?Math.PI/4:-Math.PI/4;
  }
  for(const x of [-.32,.32]){box(.095,.008,.055,x,.086,0,castEdge);box(.024,.008,.045,x,.09,0,galv);}
  for(const x of [-.405,.405])for(const z of [-.29,.29])cyl(.009,.007,x,.09,z,galv,12);
 }
 const barrierPost=(x:number,z:number)=>{
  cyl(.185,.035,x,.018,z,castEdge,40);cyl(.15,.024,x,.047,z,galv,40);
  cyl(.031,.88,x,.50,z,galv,20);cyl(.068,.085,x,.96,z,castEdge,24);
  cyl(.082,.022,x,1.012,z,galv,24);
  for(const a of [0,Math.PI/2,Math.PI,3*Math.PI/2])box(.045,.025,.013,x+Math.sin(a)*.068,.965,z+Math.cos(a)*.068,castEdge);
 };
 const barrierBelt=(a:[number,number],b:[number,number])=>{
  const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
  const midX=(a[0]+b[0])/2,midZ=(a[1]+b[1])/2;
  const belt=box(length-.13,.072,.009,midX,.965,midZ,red);
  belt.rotation.y=-Math.atan2(dz,dx);
  const stripe=box(length-.18,.008,.012,midX,.965,midZ,black);stripe.rotation.y=belt.rotation.y;
 };
 if(id==='queueBarrier')barrierPost(0,0);
 if(id==='queueBarrierOpen'){barrierPost(-.9,0);barrierPost(.9,0);barrierBelt([-.9,0],[.9,0]);}
 if(id==='queueBarrierLine'){for(const x of [-1.5,0,1.5])barrierPost(x,0);barrierBelt([-1.5,0],[0,0]);barrierBelt([0,0],[1.5,0]);}
 if(id==='queueBarrierCorner'){barrierPost(-1.4,0);barrierPost(0,0);barrierPost(0,1.4);barrierBelt([-1.4,0],[0,0]);barrierBelt([0,0],[0,1.4]);}
 if(id==='streetPlanter'){
  // British high-street rectangular timber planter, substantial soil bed and natural shrub shapes.
  box(1.35,.075,.65,0,.045,0,castEdge);
  for(const z of [-.31,.31])for(let i=0;i<7;i++)box(.19,.53,.045,-.57+i*.19,.34,z,bark);
  for(const x of [-.65,.65])for(let i=0;i<4;i++)box(.05,.53,.14,x,.34,-.24+i*.16,bark);
  for(const y of [.11,.57]){box(1.4,.045,.055,0,y,-.32,castEdge);box(1.4,.045,.055,0,y,.32,castEdge);}
  box(1.27,.055,.54,0,.58,0,m(0x4a3a2e,0,.99));
  for(let i=0;i<5;i++){
   const x=-.48+i*.24;rod([x,.58,0],[x,.94+(i%2)*.11,0],.018,bark);
   for(let j=0;j<5;j++){const a=j*2.4+i;const o=sphere(.13,x+Math.sin(a)*.13,.93+(j%3)*.095,Math.cos(a)*.17,(i+j)%3?leaf:leafLight);o.scale.set(1.1,.7,1.25);}
  }
 }
 if(id==='globeStreetLight'){
  // Modern UK residential swan-neck lantern, not American globe lighting.
  cyl(.15,.055,0,.028,0,castEdge);cyl(.075,.20,0,.15,0,galv,24);
  cyl(.054,5.1,0,2.7,0,galv,20);
  cyl(.062,.12,0,5.21,0,castEdge);
  rod([0,5.12,0],[.55,5.35,0],.045,galv);
  rod([.55,5.35,0],[1.0,5.31,0],.039,galv);
  const lantern=box(.68,.12,.32,1.08,5.25,0,paint);
  const hood=box(.77,.045,.36,1.08,5.34,0,castEdge);
  const lens=box(.60,.012,.25,1.08,5.181,0,cream);
  for(const z of [-.145,.145])box(.55,.045,.012,1.08,5.22,z,galv);
  box(.17,.24,.10,0,1.65,.055,castEdge);
  for(const y of [1.57,1.71])box(.15,.009,.11,0,y,.06,galv);
 }
 g.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(g);
 if(Number.isFinite(bounds.min.y)&&Math.abs(bounds.min.y)>.001)for(const child of g.children)child.position.y-=bounds.min.y;
 g.userData={collection:'streetassettesting',batch:1,standalone:true,id,units:'metres',status:'UK-aesthetic-review-required',revision:'UK-v3'};
 return g;
}

/** Street Fight UK: isolated British environment testing, batch 02. */
const BATCH2_ASSETS=[
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
type Batch2AssetId=typeof BATCH2_ASSETS[number]['id'];
function createBatch2Asset(id:Batch2AssetId):THREE.Group{
 return buildBatch02V3(id);
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

/** Clean rebuild. Previous prototype is unreachable, retained for comparison. */
function buildBatch02V3(id:Batch2AssetId):THREE.Group{
 const T=THREE,g=new T.Group();g.name='SFUK_B02_V3_'+id;
 const mat=(c:number,metal=0,rough=.7)=>new T.MeshStandardMaterial({color:c,metalness:metal,roughness:rough});
 const black=mat(0x25282a,.2),steel=mat(0x919a9d,.75,.4),oak=mat(0x76543b),walnut=mat(0x3f2e25),cream=mat(0xe6e1d4),paper=mat(0xf1ede1),green=mat(0x36583e),amber=mat(0x93602e,.15,.28),blue=mat(0x345879),red=mat(0xa2473d),glass=new T.MeshPhysicalMaterial({color:0xb8d5d6,metalness:0,roughness:.12,transparent:true,opacity:.22,depthWrite:false,side:T.DoubleSide}),brass=mat(0xa88c52,.7,.38),fabric=mat(0x55666a,0,.96),soil=mat(0x42382d),rust=mat(0x755143);
 const B=(w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;g.add(o);return o};
 const C=(r:number,h:number,x:number,y:number,z:number,m:T.Material,n=32)=>{const o=new T.Mesh(new T.CylinderGeometry(r,r,h,n),m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;g.add(o);return o};
 const S=(r:number,x:number,y:number,z:number,m:T.Material)=>{const o=new T.Mesh(new T.SphereGeometry(r,20,14),m);o.position.set(x,y,z);o.castShadow=true;g.add(o);return o};
 const R=(a:number[],b:number[],r:number,m:T.Material)=>{const p=new T.Vector3(...a),q=new T.Vector3(...b),v=q.clone().sub(p);const o=new T.Mesh(new T.CylinderGeometry(r,r,v.length(),12),m);o.position.copy(p.add(q).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());g.add(o);return o};
 const bottle=(x:number,y:number,z:number,i:number)=>{
  const liquid=[green,amber,red,blue][i%4];
  C(.037,.22,x,y+.11,z,liquid,20);
  const shoulder=new T.Mesh(new T.CylinderGeometry(.016,.037,.06,20),liquid);shoulder.position.set(x,y+.25,z);g.add(shoulder);
  C(.016,.085,x,y+.325,z,liquid,16);C(.019,.023,x,y+.37,z,brass,16);
  B(.063,.065,.004,x,y+.14,z+.038,paper);
  B(.046,.009,.005,x,y+.155,z+.042,black);
 };
 if(id==='backBarShelves'){
  // British pub back bar: actual shelf depths, recessed mirror and diverse spacing.
  B(2.30,2.15,.10,0,1.075,-.25,walnut);
  B(2.13,1.95,.012,0,1.14,-.189,mat(0x879a94,.3,.19));
  for(const x of [-1.13,1.13])B(.075,2.16,.47,x,1.08,-.02,walnut);
  for(const y of [.12,.62,1.12,1.62,2.11]){
   B(2.28,.07,.47,0,y,0,oak);B(2.22,.014,.018,0,y+.043,.235,brass);
  }
  for(let row=0;row<4;row++)for(let i=0;i<9;i++){
   const x=-.94+i*.235+(row%2)*.025,y=.16+row*.5;
   bottle(x,y,.045,i+row*3);
  }
  // Glass racks hang from top rather than floating across bottles.
  for(let i=0;i<6;i++){const x=-.75+i*.30;R([x,2.07,.13],[x,1.88,.13],.006,steel);C(.047,.012,x,1.875,.13,glass);}
 }
 if(id==='cardTerminal'){
  // Single connected payment terminal shell. Keypad and screen are recessed into one sloped face.
  const shell=new T.Group();g.add(shell);
  const shellBox=(w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material)=>{
   const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;shell.add(o);return o;
  };
  // Face is built horizontally then the entire unit rotates together, preventing floating keys.
  shellBox(.152,.065,.255,0,0,0,black);
  shellBox(.139,.005,.100,0,.035,-.065,mat(0x171c20));
  shellBox(.119,.003,.079,0,.039,-.067,blue);
  shellBox(.085,.003,.009,0,.042,-.097,cream);
  for(let i=0;i<12;i++){
   const x=-.044+(i%3)*.044,z=.015+Math.floor(i/3)*.040;
   shellBox(.031,.009,.026,x,.038,z,i===9?red:i===11?green:steel);
  }
  shellBox(.13,.006,.010,0,.035,.122,steel);
  shell.rotation.x=-.19;shell.position.y=.155;
  B(.12,.12,.13,0,.067,.018,black);
 }
 if(id==='receptionCounter'){
  // Flush, inset joinery: no panels sticking through the counter or levitating accessories.
  B(2.25,.91,.74,0,.455,0,oak);B(2.29,.055,.78,0,.94,0,walnut);
  B(2.12,.68,.016,0,.48,.383,cream);
  for(const x of [-.72,0,.72]){
   B(.65,.59,.008,x,.48,.395,walnut);
   B(.59,.53,.009,x,.48,.402,oak);
  }
  B(2.22,.07,.06,0,.08,.405,walnut);
  // Low visitor writing ledge sits forward but below worktop.
  B(.54,.035,.22,-.69,.80,.46,oak);
  B(.34,.04,.24,.48,.985,-.08,black);
  B(.30,.20,.014,.48,1.12,-.175,blue);
  B(.18,.045,.16,-.31,.995,-.03,black);
 }
 if(id==='wineBottle'){
  // Wine bottle with a smooth continuous silhouette and a label wrapped around its front.
  const wineGlass=mat(0x344f3c,.15,.22),foil=mat(0x8e252b,.32,.38);
  C(.044,.205,0,.105,0,wineGlass,48);
  const shoulder=new T.Mesh(new T.CylinderGeometry(.017,.044,.065,48),wineGlass);
  shoulder.position.y=.24;g.add(shoulder);
  C(.017,.074,0,.3095,0,wineGlass,48);
  C(.018,.038,0,.351,0,foil,48);
  C(.013,.008,0,.374,0,cream,32);
  // Cylindrical label surface follows the curvature instead of protruding as a square plaque.
  const label=new T.Mesh(new T.CylinderGeometry(.0448,.0448,.105,48,1,true,-Math.PI*.39,Math.PI*.78),paper);
  label.position.y=.125;g.add(label);
  const band=new T.Mesh(new T.CylinderGeometry(.045,.045,.012,48,1,true,-Math.PI*.39,Math.PI*.78),black);
  band.position.y=.155;g.add(band);
 }
 if(id==='oilDrum'){
  // 200-litre-style steel drum: three pressed ribs, realistic rim and bungs.
  C(.29,.85,0,.44,0,blue,48);
  for(const y of [.055,.29,.57,.855])C(.296,.022,0,y,0,steel,48);
  C(.286,.024,0,.88,0,black,48);
  for(const x of [-.16,.16]){C(.039,.016,x,.902,0,steel,20);C(.024,.011,x,.915,0,black,20);}
  B(.24,.16,.008,0,.46,.291,paper);
  B(.19,.018,.01,0,.50,.298,black);
  for(let i=0;i<5;i++)B(.014,.06,.011,-.08+i*.04,.435,.30,black);
 }
 if(id==='pastryCabinet'){
  // Countertop hot-food case: transparent glazing, visible stocked trays and framed doors.
  B(1.20,.16,.69,0,.08,0,black);
  B(1.19,.075,.68,0,1.13,0,black);
  for(const x of [-.58,.58])for(const z of [-.33,.33])B(.022,.97,.022,x,.64,z,steel);
  B(1.12,.91,.008,0,.64,.33,glass);
  B(1.12,.91,.008,0,.64,-.33,glass);
  for(const x of [-.58,.58])B(.008,.91,.64,x,.64,0,glass);
  for(const y of [.28,.57,.86]){
   B(1.06,.023,.52,0,y,0,steel);
   for(let i=0;i<5;i++){
    const p=S(.077,-.41+i*.205,y+.075,.015,amber);p.scale.set(1.18,.62,.82);
    B(.09,.018,.042,-.41+i*.205,y+.025,.265,paper);
   }
  }
  B(.36,.055,.012,0,.14,.352,paper);
  B(1.14,.028,.022,0,.98,.338,steel);
 }
 if(id==='waitingSofa'){
  // Two-seat compact UK waiting room sofa, cushions properly resting on seat base.
  B(1.76,.20,.71,0,.29,0,fabric);
  B(1.76,.72,.15,0,.66,-.29,fabric);
  for(const x of [-.79,.79]){B(.18,.49,.72,x,.46,0,fabric);B(.16,.045,.64,x,.725,0,walnut);}
  for(const x of [-.385,.385]){
   B(.73,.17,.56,x,.47,.055,fabric);
   B(.71,.46,.14,x,.77,-.185,fabric);
   B(.012,.04,.55,x+.355,.56,.055,black);
  }
  for(const x of [-.70,.70])for(const z of [-.23,.23])B(.06,.12,.06,x,.07,z,black);
 }
 if(id==='pottedTree'){
  C(.25,.36,0,.19,0,mat(0x6b6c64,.1,.88),12);
  C(.27,.035,0,.38,0,steel,12);C(.23,.018,0,.403,0,soil,12);
  R([0,.4,0],[0,1.68,0],.043,oak);
  for(let i=0;i<13;i++){
   const a=i*2.4,y=.93+(i%5)*.17,r=.16+(i%3)*.09;
   R([0,y-.18,0],[Math.cos(a)*r,y,Math.sin(a)*r],.014,oak);
   const p=S(.16,Math.cos(a)*r,y,Math.sin(a)*r,i%3?green:mat(0x5e824d));p.scale.set(1.15,.65,1.3);
  }
  S(.19,0,1.72,0,green);
 }
 if(id==='wallClock'){
  const rim=C(.29,.045,0,.30,0,black,48);rim.rotation.x=Math.PI/2;
  const face=C(.266,.008,0,.30,.03,paper,48);face.rotation.x=Math.PI/2;
  for(let i=0;i<12;i++){const a=i*Math.PI/6;const t=B(.012,.033,.006,Math.sin(a)*.23,.30+Math.cos(a)*.23,.038,black);t.rotation.z=-a;}
  R([0,.30,.048],[.12,.38,.048],.007,black);R([0,.30,.05],[-.07,.46,.05],.009,black);
  S(.012,0,.30,.056,brass);
 }
 if(id==='chalkboardMenu'){
  B(.85,1.18,.055,0,.63,0,walnut);B(.75,1.07,.009,0,.64,.034,mat(0x27322c));
  for(let i=0;i<6;i++){B(.44,.009,.008,-.08,1.02-i*.14,.042,cream);B(.08,.009,.008,.25,1.02-i*.14,.042,cream);}
  R([-.36,1.15,-.03],[0,.08,-.38],.022,walnut);R([.36,1.15,-.03],[0,.08,-.38],.022,walnut);
  B(.5,.035,.06,0,.12,-.22,walnut);
 }
 const bounds=new T.Box3().setFromObject(g);if(Number.isFinite(bounds.min.y)&&Math.abs(bounds.min.y)>.001)for(const child of g.children)child.position.y-=bounds.min.y;
 g.userData={collection:'streetassettesting',batch:2,id,units:'metres',revision:'terminal-and-wine-v4',status:'review-required'};
 return g;
}

export const APPROVED_STREET_ASSET_IDS = ["retailCounter","highTable","stockedShelves","manholeCover","queueBarrier","queueBarrierOpen","queueBarrierLine","queueBarrierCorner","drinksFridge","streetPlanter","shopCounterTill","cardboardBox","cardTerminal","backBarShelves","receptionCounter","pottedTree","wineBottle","oilDrum","wallClock","chalkboardMenu","pastryCabinet","waitingSofa"] as const;
type ApprovedStreetAssetId = typeof APPROVED_STREET_ASSET_IDS[number];
const APPROVED_ASSET_IDS: ReadonlySet<string> = new Set(APPROVED_STREET_ASSET_IDS);
function createApprovedStreetAsset(id:ApprovedStreetAssetId):THREE.Group {
 const g = (BATCH1_ASSETS.some(a=>a.id===id) ? createBatch1Asset(id as Batch1AssetId) : createBatch2Asset(id as Batch2AssetId));
 g.userData={...g.userData,collection:'newassetsfromchatgpt',approved:true,assetName:id,status:'approved'};
 return g;
}
