import * as THREE from 'three';
/** SFUK police station expansion V3. Review only, pr-dev. Units: metres. */
export const POLICE_EXPANSION_ASSETS=[
{id:'policeHoldingCellSingle',name:'Single holding cell'},
{id:'policeHoldingCellDouble',name:'Two-person holding cell'},
{id:'policeInterviewRoom',name:'Secure interview room'},
{id:'policeCustodyBench',name:'Custody waiting bench'},
{id:'policeFingerprintStation',name:'Fingerprint booking station'},
{id:'policePropertyStorage',name:'Secure property shelving'},
{id:'policeStaffLockers',name:'Police staff lockers'},
{id:'policeChargeDesk',name:'Charge and booking counter'},
{id:'policeCorridorBench',name:'Wall-fixed corridor bench'},
{id:'policeNoticeboard',name:'Station briefing noticeboard'},
{id:'policeFilingCabinet',name:'Metal records cabinet'},
{id:'policeEvidenceTrolley',name:'Evidence transport trolley'}
] as const;
export function createPoliceExpansionAsset(id:string):THREE.Group{
const g=new THREE.Group();g.name=id;
const m=(c:number,metal=0,rough=.72)=>new THREE.MeshStandardMaterial({color:c,metalness:metal,roughness:rough});
const wall=m(0x9ca4a2),concrete=m(0x858d8d),floor=m(0x596469),steel=m(0x788995,.7,.32),dark=m(0x27323a),black=m(0x171e24),navy=m(0x263e59),wood=m(0x7c6651),paper=m(0xe7e3d5),blue=m(0x31577c),yellow=m(0xd2b35b),glass=new THREE.MeshStandardMaterial({color:0x91b6c6,metalness:.1,roughness:.18,transparent:true,opacity:.45});
function b(w:number,h:number,d:number,x:number,y:number,z:number,mat:THREE.Material){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;g.add(o);return o}
function rod(a:number[],c:number[],r:number,mat:THREE.Material){const p=new THREE.Vector3(...a),q=new THREE.Vector3(...c),v=q.clone().sub(p);const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,v.length(),10),mat);o.position.copy(p.add(q).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());g.add(o)}
function cy(r:number,h:number,x:number,y:number,z:number,mat:THREE.Material){const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,16),mat);o.position.set(x,y,z);g.add(o)}
function sign(txt:string,w:number,h:number,x:number,y:number,z:number){const c=document.createElement('canvas');c.width=768;c.height=192;const a=c.getContext('2d')!;a.fillStyle='#233b56';a.fillRect(0,0,768,192);a.strokeStyle='#f2f2ed';a.lineWidth=9;a.strokeRect(9,9,750,174);a.font='bold 75px Arial';a.textAlign='center';a.textBaseline='middle';a.fillStyle='#fff';a.fillText(txt,384,98,700);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const o=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:t,side:THREE.DoubleSide}));o.position.set(x,y,z);g.add(o)}
function room(w:number,d:number,opening=1.65){
b(w,.14,d,0,.07,0,floor);
b(w,2.65,.14,0,1.40,-d/2,wall);
b(.14,2.65,d,-w/2,1.40,0,wall);b(.14,2.65,d,w/2,1.40,0,wall);
// Complete front wall with a central structural door opening.
const side=(w-opening)/2;
for(const x of [-(opening+side)/2,(opening+side)/2])b(side,2.65,.15,x,1.40,d/2,wall);
b(opening,.20,.15,0,2.63,d/2,wall);
b(opening,.16,.20,0,.19,d/2,concrete);
for(const x of [-w/2+.16,w/2-.16])b(.04,2.45,.04,x,1.35,d/2+.085,concrete);
b(w-.25,.11,.06,0,.20,-d/2+.10,dark);
// Removable roof: full structural slab, hidden in review mode to reveal interior.
const roof=b(w,.16,d,0,2.83,0,concrete);roof.name='inspectionRoof';
const light=b(.82,.025,.24,0,2.70,-.38,paper);light.name='inspectionRoof';
}
function door(w:number,z:number,barred:boolean){const h=2.39;for(const x of [-w/2,w/2])b(.075,h,.085,x,1.32,z,steel);for(const y of [.15,2.50])b(w+.08,.07,.085,0,y,z,steel);
if(barred){for(let x=-w/2+.13;x<w/2-.05;x+=.15)rod([x,.21,z],[x,2.45,z],.021,steel);b(w,.045,.09,0,1.28,z,steel)}
else{b(w-.08,h-.10,.055,0,1.33,z,dark);b(w-.28,.31,.018,0,1.62,z+.04,glass);for(const y of [1.44,1.80])b(w-.25,.025,.03,0,y,z+.055,steel)}
b(.16,.27,.14,w/2-.18,1.19,z+.07,black);b(.12,.045,.055,w/2-.18,1.18,z+.17,steel);for(const y of [.43,2.15])b(.12,.14,.15,-w/2-.045,y,z,black)}
function bench(x:number,y:number,z:number,w:number){b(w,.09,.52,x,y,z,wood);for(const dx of [-w/2+.16,w/2-.16]){b(.10,y-.08,.38,x+dx,(y-.08)/2,z,steel);b(.11,.10,.55,x+dx,.16,z,steel)}}
function drawer(x:number,y:number,z:number,w:number,h:number){b(w,h,.045,x,y,z,steel);b(w*.36,.018,.025,x,y,z+.035,black)}
if(id==='policeHoldingCellSingle'||id==='policeHoldingCellDouble'){
const dbl=id==='policeHoldingCellDouble',w=dbl?4.5:3.1,d=3.45;room(w,d,1.52);
const z=d/2+.10,doorW=1.34;
b(doorW+.20,.18,.16,0,2.53,z,wall);door(doorW,z,dbl?true:false);
b(.34,.31,.045,doorW/2+.39,1.61,z+.04,dark);b(.25,.17,.015,doorW/2+.39,1.61,z+.071,glass);
bench(-w/2+.84,.60,-d/2+.48,dbl?1.50:1.25);if(dbl)bench(w/2-.84,.60,-d/2+.48,1.50);
b(.59,.82,.08,w/2-.41,.48,-d/2+.42,wall);cy(.21,.29,w/2-.45,.30,-d/2+.36,steel);
const ring=new THREE.Mesh(new THREE.TorusGeometry(.18,.035,8,22),steel);ring.rotation.x=Math.PI/2;ring.position.set(w/2-.45,.47,-d/2+.36);g.add(ring);
b(.22,.14,.04,w/2-.42,1.14,-d/2+.07,steel);
for(const x of [-w/2+.55,w/2-.55])b(.02,2.40,.02,x,1.39,-d/2+.09,concrete);
b(.60,.065,.21,0,2.48,-d/2+.17,paper);b(.20,.22,.03,-.38,2.18,-d/2+.08,dark);
sign(dbl?'HOLDING 02':'HOLDING 01',.80,.19,0,2.71,z+.08);
}else if(id==='policeInterviewRoom'){
room(3.9,3.5,1.24);door(1.1,1.85,false);b(1.45,.085,.78,0,.83,-.10,wood);for(const x of [-.55,.55])b(.08,.75,.62,x,.42,-.10,steel);
for(const z of [-.91,.68]){b(.54,.08,.52,0,.46,z,dark);b(.48,.50,.09,0,.74,z+(z<0?-.22:.22),navy);for(const x of [-.19,.19])b(.05,.41,.05,x,.24,z,steel)}
b(.26,.20,.20,.34,.96,-.10,black);b(.20,.12,.015,.34,1.00,.01,glass);
b(.48,.06,.32,-.32,.90,-.10,paper);b(.17,.035,.12,-.42,.94,-.07,black);b(.43,.30,.05,0,2.10,-1.70,dark);b(.32,.20,.02,0,2.10,-1.66,glass);
sign('INTERVIEW',.72,.20,0,2.73,1.83);
}else if(id==='policeCustodyBench'||id==='policeCorridorBench'){
const corridor=id==='policeCorridorBench';
if(!corridor){
bench(0,.59,0,2.9);
b(2.9,.34,.07,0,.93,-.25,navy);
for(const x of [-.94,0,.94])b(.06,.38,.08,x,.95,-.24,steel);
for(const x of [-1.0,1.0])b(.10,.15,.48,x,.70,0,steel);
}else{
// A true cantilevered wall-mounted bench: no floor legs or floating mounting panel.
const seat=b(2.5,.085,.53,0,.53,0,wood);
b(2.50,.30,.065,0,.86,-.265,navy);
for(const x of [-.96,0,.96]){
b(.12,.23,.045,x,.66,-.285,steel);
rod([x,.33,-.30],[x,.49,.18],.036,steel);
b(.13,.09,.18,x,.50,-.18,steel);
for(const y of [.58,.74])cy(.018,.012,x,y,-.311,black);
}
for(const x of [-1.08,1.08])b(.10,.014,.014,x,.58,.17,black);
}
}else if(id==='policeFingerprintStation'){
// Freestanding custody fingerprint workstation, with a recognisable optical platen.
b(1.65,.065,.78,0,.91,0,concrete);
for(const x of [-.72,.72]){b(.055,.82,.055,x,.47,-.28,steel);b(.055,.82,.055,x,.47,.28,steel)}
b(1.50,.075,.12,0,.25,-.30,steel);
b(.59,.43,.065,-.43,1.32,-.20,black);
b(.52,.35,.009,-.43,1.33,-.162,blue);
b(.11,.25,.11,-.43,1.02,-.20,steel);
b(.40,.035,.19,-.43,.95,.06,black);
for(let i=0;i<6;i++)b(.035,.009,.035,-.57+(i%3)*.09,.974,.01+Math.floor(i/3)*.065,steel);
// Angled sloping scanner top, separated into a palm platen and four-finger capture area.
b(.57,.16,.43,.40,1.035,.06,black);
const platen=b(.49,.018,.34,.40,1.126,.06,glass);platen.rotation.x=-.12;
b(.44,.014,.27,.40,1.141,.06,navy);
for(let i=0;i<4;i++)b(.076,.012,.13,.245+i*.105,1.151,.055,steel);
b(.19,.04,.055,.40,1.152,.255,blue);
b(.32,.27,.24,.48,1.27,-.24,dark);
b(.22,.12,.012,.48,1.29,-.11,blue);
b(.47,.48,.045,0,.64,.365,navy);
b(.23,.12,.014,0,.68,.391,paper);
}else if(id==='policePropertyStorage'){
// Open rack: individual shelves, posts, and a thin back panel, never a solid cabinet.
for(let y=.18;y<2.24;y+=.49)b(2.22,.045,.73,0,y,0,dark);
b(2.24,2.20,.025,0,1.14,-.405,steel);
for(const x of [-1.11,1.11])for(const z of [-.35,.35])b(.065,2.26,.065,x,1.14,z,steel);
for(let i=0;i<4;i++)for(let j=0;j<3;j++){const x=-.73+j*.73,y=.44+i*.49;b(.57,.27,.43,x,y,0,wood);b(.30,.10,.015,x,y+.02,.251,paper);b(.09,.025,.022,x,y-.09,.256,steel)}
b(2.43,.08,.87,0,2.31,0,steel);sign('PROPERTY',1.0,.21,0,2.45,.43);
}else if(id==='policeStaffLockers'){
for(let i=0;i<4;i++){const x=-1.01+i*.67;b(.62,2.02,.57,x,1.04,0,steel);b(.56,1.90,.018,x,1.06,.30,navy);
for(let j=0;j<4;j++)b(.34,.013,.025,x,1.72+j*.045,.32,black);
b(.035,.19,.035,x+.22,1.06,.34,steel);b(.10,.10,.02,x-.17,1.70,.32,paper)}
b(2.70,.10,.65,0,2.11,0,dark);b(2.70,.10,.67,0,.06,0,dark);
}else if(id==='policeChargeDesk'){
// Counter with continuous protective glazed screen and a deliberately open document slot.
b(2.9,.12,1.02,0,1.05,0,wood);
b(2.9,.88,.14,0,.56,.44,navy);
for(const x of [-1.34,1.34])b(.12,.94,.90,x,.54,0,wood);
b(2.95,.055,1.08,0,1.14,0,concrete);
b(2.70,.025,.04,0,1.18,.52,steel);
// Glass is above the public edge (positive z), with clear visible separation.
const screenZ=.485;
for(const x of [-1.42,0,1.42])b(.055,1.13,.065,x,1.78,screenZ,steel);
b(2.95,.065,.075,0,2.37,screenZ,steel);
b(2.95,.045,.075,0,1.22,screenZ,steel);
const safetyGlass=new THREE.MeshStandardMaterial({color:0xa3cadb,transparent:true,opacity:.30,roughness:.09,metalness:.06,side:THREE.DoubleSide,depthWrite:false});
for(const x of [-.71,.71])b(1.34,.88,.018,x,1.90,screenZ,safetyGlass);
// Low transaction slot with open gap above the countertop, and metal pass-through tray.
b(1.0,.025,.35,0,1.24,.49,steel);
b(.94,.018,.28,0,1.262,.49,black);
for(const x of [-.51,.51])b(.03,.17,.05,x,1.35,screenZ,steel);
b(.61,.43,.07,-.68,1.45,-.21,black);
b(.52,.34,.018,-.68,1.46,-.16,glass);
b(.11,.28,.09,-.68,1.22,-.22,steel);
b(.44,.06,.27,-.68,1.22,.09,black);
b(.62,.025,.42,.30,1.20,-.17,paper);
b(.27,.10,.17,.94,1.22,.12,black);
for(let i=0;i<4;i++)drawer(-.87+i*.56,.69,-.53,.45,.25);
sign('CUSTODY',.94,.22,0,.58,.526);
}else if(id==='policeNoticeboard'){
b(1.86,1.22,.08,0,.93,0,wood);b(1.72,1.08,.02,0,.93,.055,navy);
for(let i=0;i<7;i++){const x=-.61+(i%3)*.60,y=.54+Math.floor(i/3)*.34;b(.43,.25,.012,x,y,.072,i%4===0?yellow:paper);cy(.015,.012,x,y+.11,.084,steel);for(let j=0;j<3;j++)b(.30,.005,.006,x,y+.05-j*.06,.082,dark)}
}else if(id==='policeFilingCabinet'){
b(.92,1.57,.62,0,.81,0,steel);for(let i=0;i<4;i++){const y=.30+i*.36;drawer(0,y,.322,.82,.30);b(.20,.045,.02,0,y,.357,black);b(.28,.065,.014,0,y+.085,.35,paper)}b(.97,.08,.68,0,.055,0,black);
}else if(id==='policeEvidenceTrolley'){
for(const y of [.35,1.02])b(1.30,.06,.76,0,y,0,steel);for(const x of [-.56,.56])for(const z of [-.29,.29]){b(.055,1.05,.055,x,.56,z,black);cy(.085,.08,x,.11,z,black)}
rod([.59,1.10,-.29],[.59,1.10,.29],.026,steel);
for(let i=0;i<3;i++){const x=-.39+i*.40;b(.31,.19,.31,x,.49,0,wood);b(.22,.065,.014,x,.51,.163,paper)}
b(.48,.20,.37,0,1.16,0,dark);b(.37,.09,.015,0,1.17,.195,paper);
}else throw Error('Unknown police expansion asset: '+id);
// Subtle edge and fastening details for standalone props.
if(id==='policeStaffLockers')for(let i=0;i<4;i++){const x=-1.01+i*.67;b(.50,.018,.03,x,.31,.325,steel);b(.07,.065,.025,x+.22,1.03,.355,black)}
if(id==='policeFilingCabinet')for(let i=0;i<4;i++){const y=.30+i*.36;for(const x of [-.35,.35])b(.018,.018,.015,x,y,.358,black)}
if(id==='policeCustodyBench')for(const x of [-1.28,1.28])b(.12,.10,.10,x,.57,.21,steel);
g.userData={id,status:'pending-review',branch:'pr-dev',gameplayIntegrated:false,collection:'Police Station Expansion V3'};return g;
}
