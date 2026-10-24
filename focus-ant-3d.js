/* focus-ant-3d.js: the Focus ant and mark in 3D, as parametric Three.js (r128+) geometry. Mark units, Y up, ground y = 0, ant faces +X.
   Usage: import * as THREE from 'three'; import {buildAnt, poseAnt, rimMat, buildMark, MATS, PROPS, MARK} from './focus-ant-3d.js';
   const ant = buildAnt(MATS.clay(), 'teardrop'); scene.add(ant); poseAnt(ant, {phase, curl, carry, antUp, antFwd, domeR, stand});
   "Your ant": buildAnt(rimMat(), 'teardrop') gives a soft sage rim light, readable in a crowd.
   MARK is centred on the origin (logo x → world X, logo y → world Z). A top-down camera with up = (0,0,-1) shows the upright logo. */
const THREE = globalThis.THREE;
const GREEN=0x6FA585, FOREST=0x1C2B1E, MIST=0xF0F4EF;
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v)), lerp=(a,b,t)=>a+(b-a)*t, ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2, smooth=(a,b,t)=>{t=clamp((t-a)/(b-a));return t*t*(3-2*t)};
/* The approved mark, in mark units (from focus-brand LOGO geometry, centred). */
const MARK={dots:{A2:[-1.933,-4.167,2.55],B2:[-1.933,2.433,1.833],B3:[4.667,2.433,2.55],C2:[-1.933,9.033,1.236]},
  frames:[[-8.533,-4.167,1.632,.816],[-8.533,2.433,1.1,.55],[-8.533,9.033,.756,.378],[4.667,9.033,1.632,.816]],pick:[7.367,-7.867,3.0]};

/* ---------- materials ---------- */
const MATS={clay:()=>new THREE.MeshStandardMaterial({color:GREEN,roughness:.9,metalness:0}),
            satin:()=>new THREE.MeshPhysicalMaterial({color:GREEN,roughness:.45,metalness:0,clearcoat:.25,clearcoatRoughness:.6})};
const eyeMat=new THREE.MeshStandardMaterial({color:FOREST,roughness:1});
function rimMat(){const m=MATS.clay();m.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <dithering_fragment>',
  'float rim=1.0-clamp(dot(normalize(normal),normalize(vViewPosition)),0.0,1.0);gl_FragColor.rgb+=vec3(0.784,0.851,0.769)*pow(rim,2.2)*0.6;\n#include <dithering_fragment>')};return m}

/* ---------- the ant ---------- */
const SPH=new THREE.SphereGeometry(1,40,28), CYL=new THREE.CylinderGeometry(1,1,1,16,1);
/* Body proportions (mark units). Head ≥ abdomen > thorax; the abdomen tapers to the back. */
const PROPS={
  teardrop:{name:'Teardrop',head:[3.25,2.1],tho:[0,1.3,.95],abd:{type:'tear',x0:-1.55,L:4.7,w:1.8}},
  oval:{name:'Slim oval',head:[3.3,2.05],tho:[0,1.3,1.0],abd:{type:'ell',x:-3.9,rx:2.35,rw:1.65}},
  dots:{name:'Small dots',head:[3.3,2.15],tho:[0,1.1,1.1],abd:{type:'ell',x:-3.3,rx:1.85,rw:1.85}},
};
let PROP='teardrop';   // default proportions (Lalit's "less three balls" note)
const H0=2.35;
const HIPS=[[.5,.85],[0,1.0],[-.5,.85]], FEET=[[2.6,3.0],[.15,3.4],[-2.7,3.1]];
const tearProfile=(w,L)=>{const pts=[];for(let i=0;i<=40;i++){const u=i/40;pts.push(new THREE.Vector2(Math.max(w*Math.pow(Math.sin(Math.PI*Math.pow(u,.72)),.85),1e-4),u*L))}return pts};
function abdGeo(pr){const a=pr.abd;if(a.type==='tear'){const g=new THREE.LatheGeometry(tearProfile(a.w,a.L),40);g.rotateZ(Math.PI/2);g.translate(a.x0,0,0);return g}return SPH}
function buildAnt(mat,prop=PROP){
  const g=new THREE.Group(); const m=mat||MATS.clay(); const pr=PROPS[prop];
  const mesh=(geo,mm=m)=>{const o=new THREE.Mesh(geo,mm);o.castShadow=true;o.receiveShadow=true;g.add(o);return o};
  g.userData={mat:m,pr,abd:mesh(abdGeo(pr)),tho:mesh(SPH),head:mesh(SPH),eyes:[mesh(SPH,eyeMat),mesh(SPH,eyeMat)],legs:[],ants:[],crumb:mesh(SPH)};
  for(let k=0;k<6;k++)g.userData.legs.push({a:mesh(CYL),b:mesh(CYL),j:mesh(SPH),f:mesh(SPH)});
  for(let k=0;k<2;k++)g.userData.ants.push({s:mesh(CYL),t:mesh(SPH)});
  return g;
}
const _v=new THREE.Vector3(),_u=new THREE.Vector3(0,1,0);
function seg(o,a,b,r){_v.subVectors(b,a);const L=_v.length();o.position.copy(a).addScaledVector(_v,.5);o.scale.set(r,Math.max(L,1e-4),r);o.quaternion.setFromUnitVectors(_u,_v.normalize());}
function poseAnt(g,{phase=0,curl=0,carry=0,antUp=0,antFwd=0,domeR=2.55,showCrumb=null,stand=0,push=0}={}){
  // push 0→1: rolling a ball. Head lowered, antennae forward-down, front legs pressed on the ball.
  antUp-=.8*push; antFwd+=.7*push;
  const U=g.userData, c=ease(clamp(curl)), bob=(1-stand)*Math.abs(Math.sin(phase*Math.PI*2))*.12*(1-c);
  const y=lerp(H0+bob,domeR*.62,c);                          // the body lowers as it curls
  const pr=U.pr, hx=pr.head[0], hr=pr.head[1];
  // curl: the ant rolls into one soft dome. The head becomes the dome, the thorax and abdomen tuck under it.
  U.head.position.set(lerp(hx,0,c),y-.45*push,0);const hR=lerp(hr,domeR,c);U.head.scale.set(hR,lerp(hr,domeR*.62,c),hR);
  U.tho.position.set(lerp(pr.tho[0],0,c),y,0);const tk=1-smooth(.2,.8,c);U.tho.scale.set(pr.tho[1]*tk+.001,pr.tho[2]*.92*tk+.001,pr.tho[2]*tk+.001);
  const A=pr.abd, ak=1-smooth(.15,.75,c);
  if(A.type==='tear'){U.abd.position.set(lerp(0,-A.x0*.6,c),y+.15,0);U.abd.scale.set(ak+.001,.92*ak+.001,ak+.001)}
  else{U.abd.position.set(lerp(A.x,0,c),y+.1,0);U.abd.scale.set(A.rx*ak+.001,A.rw*.92*ak+.001,A.rw*ak+.001)}
  U.eyes.forEach((e,i)=>{const s=i?1:-1;e.position.set(lerp(hx+hr*.74,0,c),y+hr*.27-.45*push,s*hr*.43*(1-c));e.scale.setScalar(hr*.2*(1-smooth(0,.4,c)));e.visible=c<.4});
  const legK=1-smooth(0,.55,c);
  let n=0;for(const s of [1,-1])for(let i=0;i<3;i++){const L=U.legs[n++];
    const grp=((i%2===0)===(s>0))?0:1; let p=((phase+grp*.5)%1+1)%1, off,lift=0;
    if(p<.5)off=1.3*(1-4*p);else{const q=(p-.5)/.5;off=-1.3+2.6*ease(q);lift=Math.sin(Math.PI*q)}
    off*=(1-stand);lift*=(1-stand);
    const hip=new THREE.Vector3(HIPS[i][0],y-.35,HIPS[i][1]*s);
    const foot=new THREE.Vector3(FEET[i][0]+off,lift*.9,FEET[i][1]*s);
    if(i===0&&push>0)foot.lerp(new THREE.Vector3(hx+hr*.65,y-.3,1.15*s),push);
    foot.lerp(hip,1-legK);
    const knee=hip.clone().lerp(foot,.45);knee.y+=.75*legK;knee.z+=.35*s*legK;
    const r=.34*legK+.001;seg(L.a,hip,knee,r);seg(L.b,knee,foot,r);L.j.position.copy(knee);L.j.scale.setScalar(r*1.05);L.f.position.copy(foot);L.f.scale.setScalar(r*1.25);
    [L.a,L.b,L.j,L.f].forEach(o=>o.visible=legK>.02)}
  U.ants.forEach((A,i)=>{const s=i?1:-1, k=1-smooth(0,.45,c);
    const base=new THREE.Vector3(hx+hr*.5,y+hr*.68-.45*push,s*hr*.36);
    const dir=new THREE.Vector3(1.0+antFwd*.4,.9+antUp*.7,s*.55).normalize();
    const tip=base.clone().addScaledVector(dir,2.9*k+.001);
    seg(A.s,base,tip,.22*k+.001);A.t.position.copy(tip);A.t.scale.setScalar(.5*k+.001);A.s.visible=A.t.visible=k>.02});
  const cr=showCrumb!=null?showCrumb:carry; U.crumb.visible=!!cr;
  if(carry){U.crumb.position.set(hx+hr+1.6,y+.4,0);U.crumb.scale.setScalar(1.5)}
}

/* ---------- the mark ---------- */
function frameRing(h,k,t,mat){ // rounded-square hairline ring lying on the ground
  const s=new THREE.Shape(),r=k,o=h; const rr=(sh,hh,rad)=>{sh.moveTo(-hh+rad,-hh);sh.lineTo(hh-rad,-hh);sh.quadraticCurveTo(hh,-hh,hh,-hh+rad);sh.lineTo(hh,hh-rad);sh.quadraticCurveTo(hh,hh,hh-rad,hh);sh.lineTo(-hh+rad,hh);sh.quadraticCurveTo(-hh,hh,-hh,hh-rad);sh.lineTo(-hh,-hh+rad);sh.quadraticCurveTo(-hh,-hh,-hh+rad,-hh)};
  rr(s,o,r);const hole=new THREE.Path();rr(hole,o-t,Math.max(r-t,.01));s.holes.push(hole);
  const geo=new THREE.ExtrudeGeometry(s,{depth:.18,bevelEnabled:false,curveSegments:12});geo.rotateX(-Math.PI/2);
  const m=new THREE.Mesh(geo,mat);m.receiveShadow=true;m.castShadow=true;return m;
}
function dome(r,mat){const m=new THREE.Mesh(SPH,mat);m.scale.set(r,r*.62,r);m.position.y=r*.62*.55;m.castShadow=m.receiveShadow=true;return m}


const lineMat=new THREE.MeshStandardMaterial({color:GREEN,roughness:.9});
function buildMark(mat){const g=new THREE.Group();
  for(const k in MARK.dots){const [x,z,r]=MARK.dots[k];const d=dome(r,mat);d.position.x=x;d.position.z=z;g.add(d)}
  for(const [x,z,h,k] of MARK.frames){const f=frameRing(h,k,.32,lineMat);f.position.set(x,0,z);g.add(f)}
  const p=new THREE.Mesh(SPH,mat);p.scale.setScalar(MARK.pick[2]);p.position.set(MARK.pick[0],MARK.pick[2]+.9,MARK.pick[1]);p.castShadow=true;g.add(p);g.userData.pick=p;return g}
export {GREEN,FOREST,MIST,MARK,MATS,PROPS,rimMat,buildAnt,poseAnt,frameRing,dome,buildMark,tearProfile};
