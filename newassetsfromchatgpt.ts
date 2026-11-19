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
  | 'roadSign' | 'wheelieBinBlack' | 'wheelieBinBrown' | 'wheelieBinGreen' | 'wheelieBinBlue' | 'parkBench';

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
  const g = group(name);
  if (['pillarPostBox','wallPostBox','busStopPole','busShelter','telephoneBox','litterBin'].includes(name)) {
    buildReworkedStreetAsset(g, name);
    g.userData = {collection:'newassetsfromchatgpt', standalone:true, units:'metres', assetName:name, detailVersion:4};
    return g;
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
  upgradeDepthAndSurfaces(g, name);
  g.userData = { collection: 'newassetsfromchatgpt', standalone: true, units: 'metres', assetName: name };
  return g;
}
export const STREET_ASSET_NAMES: readonly StreetAssetName[] = [
  'pillarPostBox', 'wallPostBox', 'busStopPole', 'busShelter', 'busBench',
  'timetableBoard', 'streetLamp', 'bollard', 'railings', 'litterBin',
  'recyclingBin', 'telephoneBox', 'electricalCabinet', 'streetNameSign',
  'pedestrianCrossing', 'roadSign', 'wheelieBinBlack', 'wheelieBinBrown',
  'wheelieBinGreen', 'wheelieBinBlue', 'parkBench',
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
