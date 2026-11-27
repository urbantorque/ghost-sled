import{i as e,m as t}from"./chaos-CLXG6LOk.js";import{N as n,P as r,S as i,g as a,y as o}from"./course-CrrO1WN1.js";import{O as s,U as c,a as l,at as u,bn as d,bt as f,h as p,i as m,it as h,mt as g,o as _,ot as v,p as y,pt as b,wn as x,xt as S,y as C,yt as w,zn as T}from"./three.core-CQuEWvUl.js";import{o as E}from"./motion-49A_Vkhn.js";import{$ as ee,Dt as D,Et as te,Ot as O,Q as ne,Tt as re,X as k,Z as A,_t as j,at as ie,dt as ae,et as oe,ht as M,it as N,j as se,lt as P,nt as F,ot as I,pt as ce,rt as L,tt as le,ut as ue,wt as de}from"./index-gW_PfuQ5.js";var fe=new y(`#ECE6DA`),pe=new y(`#2E3448`),me=new y(`#3E6CA8`),he=new y(`#EEE4D0`),ge=new y(`#26242E`),_e=new y(`#26242E`),ve=new y(`#FFE7A8`),ye=new y(`#FFF3C4`),be=new y(`#FFD34D`),R=new y(`#FFE2BC`).convertSRGBToLinear(),xe=new T(0,1,0),Se=new h,Ce=new S,we=new T,Te=new T,Ee=new y;function De(){return new d({vertexShader:`
      varying vec2 vUv;
      varying vec3 vCol;
      void main() {
        vUv = uv;
        #ifdef USE_INSTANCING_COLOR
        vCol = instanceColor;
        #else
        vCol = vec3(1.0);
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }`,fragmentShader:`
      varying vec2 vUv;
      varying vec3 vCol;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float a = 1.0 - smoothstep(0.3, 1.0, d);
        gl_FragColor = vec4(vCol, a * a);
      }`,transparent:!0,depthWrite:!1,blending:2,polygonOffset:!0,polygonOffsetFactor:-4})}function Oe(){return new d({uniforms:{uColor:{value:new y(`#FFF0D0`)},uK:{value:0}},vertexShader:`
      varying float vAlong;
      varying float vFace;
      void main() {
        vAlong = position.y;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        vFace = abs(dot(n, normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }`,fragmentShader:`
      uniform vec3 uColor;
      uniform float uK;
      varying float vAlong;
      varying float vFace;
      void main() {
        float a = pow(vFace, 2.0) * smoothstep(0.0, 0.7, vAlong) * (1.0 - smoothstep(0.97, 1.0, vAlong)) * uK;
        gl_FragColor = vec4(uColor, a);
      }`,transparent:!0,depthWrite:!1,blending:2,side:2})}var ke=class{constructor(e){t(this,`particles`,void 0),t(this,`root`,new b),t(this,`paint`,P({coolShade:.18,rim:.22})),t(this,`poolMat`,De()),t(this,`shaftMat`,Oe()),t(this,`lampMat`,new v({color:16777215})),t(this,`owned`,[this.paint,this.poolMat,this.shaftMat,this.lampMat]),t(this,`plays`,[]),t(this,`pools`,null),t(this,`shaft`,null),t(this,`lamps`,null),t(this,`lampAt`,[]),t(this,`marks`,new Map),t(this,`beamPlay`,-1),t(this,`soarPlay`,-1),t(this,`ended`,new Map),t(this,`time`,0),t(this,`lantern`,null),this.particles=e,this.root.name=`gullhaven-pieces`}keep(e){return this.owned.push(e),e}clear(){for(let e of[...this.root.children])this.root.remove(e);for(let e of this.owned.splice(4))e.dispose();this.pools=null,this.shaft=null,this.lamps=null,this.lampAt=[],this.marks.clear(),this.beamPlay=this.soarPlay=-1,this.plays=[]}reset(){this.ended.clear();for(let e of this.marks.values())for(let t of e)t.st=0}build(e,t,n){this.clear(),this.plays=t;let r=[];for(let i of t)i.verb===`beam`?this.beamFor(e,i,r,n):i.verb===`soar`?this.soarFor(e,i,r,n):i.verb===`stacks`&&this.stacksFor(e,i,r);if(r.length){let e=new u(this.keep(L(r)),this.paint);e.castShadow=!0,e.receiveShadow=!0,this.root.add(e)}let i=0;for(let e of this.marks.values())i+=e.length;if(i){let e=this.keep(new w(1,1).rotateX(-Math.PI/2)),t=new c(e,this.poolMat,i);t.frustumCulled=!1,t.renderOrder=4,t.count=0,t.setColorAt(0,Ee.setRGB(0,0,0)),this.root.add(t),this.pools=t}if(this.beamPlay>=0){let e=this.keep(new C(1,.05,1,n?8:14,1,!0).translate(0,.5,0)),t=new u(e,this.shaftMat);t.frustumCulled=!1,t.renderOrder=5,t.visible=!1,this.root.add(t),this.shaft=t}if(this.lampAt.length){let e=new c(this.keep(new x(.32,10,8)),this.lampMat,this.lampAt.length);this.lampAt.forEach((t,n)=>{e.setMatrixAt(n,Se.makeTranslation(t[0],t[1],-t[2])),e.setColorAt(n,Ee.setRGB(.2,.2,.26))}),e.computeBoundingSphere(),this.root.add(e),this.lamps=e}}stripe(e,t,n,r,i,a,o,s){let c=r-t,l=i-n,u=Math.hypot(c,l)||1,d=-l/u*(a/2),f=c/u*(a/2),p=(t,n)=>[t,e.ground(t,n)+.05,-n];s.push(A(p(t-d,n-f),p(r-d,i-f),p(r+d,i+f),p(t+d,n+f),o))}posts(e,t,n,r,i,a,o){let s=[],c=e.edgeLimit(t),l=e.halfWidth(t);for(let u of[-1,1]){let d=(u>0?Math.min(c,.8)+.6:c+.4)+r,f=e.centerX(t)+u*(l+d),p=e.ground(f,t)-.3;o.push(N(new C(r*.85,r,n+.3,6,1),fe,{pos:[f,p+(n+.3)/2,-t]}));for(let e=0;e<a;e++)o.push(N(new C(r*.9+.02,r*.9+.02,n*.12,6,1,!0),i,{pos:[f,p+n*(.35+.5*e/Math.max(1,a)),-t]}));s.push([f,p+n+.6,t])}return s}beamFor(e,t,n,r){this.beamPlay=t.index;let i=[];for(let o of t.gates){if(this.posts(e,o.z,1.7,.16,pe,1,n),!r)for(let t of[-1,1])this.stripe(e,e.centerX(o.z)+t*(e.halfWidth(o.z)-.6),o.z-1.2,e.centerX(o.z)+t*(e.halfWidth(o.z)-.6),o.z+1.2,.35,he,n);i.push({x:a(o,0),z:o.z,y:e.ground(a(o,0),o.z),w:o.hw,st:0,at:-9,gate:o})}this.marks.set(t.index,i)}soarFor(e,t,n,r){this.soarPlay=t.index;let i=t.far,a=this.posts(e,i,6.5,.2,me,r?2:3,n);for(let e of a)n.push(N(new C(.4,.4,.12,8,1),_e,{pos:[e[0],e[1]-.45,-i]}));this.lampAt.push(...a);let o=e.halfWidth(i),s=e.centerX(i),c=Math.floor(o*2/1.6);for(let t=0;t<c;t+=1){let r=s-o+t*1.6+.2;this.stripe(e,r,i,r+1.2,i,.5,t%2?he:me,n)}}stacksFor(e,t,n){let r=[];for(let i of t.targets){for(let t of[-1,1]){let r=i.x+t*(i.hw+.18);this.stripe(e,r,i.z-1.6,r,i.z+1.6,.32,ge,n)}r.push({x:i.x,z:i.z,y:e.ground(i.x,i.z),w:i.hw,st:0,at:-9,gate:null})}this.marks.set(t.index,r)}beats(e,t){for(let n of e){if(n.type!==`moment`)continue;let e=this.plays.find(e=>e.key===n.key);if(!e)continue;if((n.phase===`won`||n.phase===`lost`)&&(this.ended.set(e.index,{t:this.time,won:n.phase===`won`}),e.index===this.soarPlay&&n.phase===`won`))for(let e of this.lampAt)this.particles?.sparkle(we.set(e[0],e[1],-e[2]),be,30,3.6,.8,.24,null,.5);let r=this.marks.get(e.index);if(!r||n.phase!==`step`&&n.phase!==`miss`)continue;let i=null;for(let e of r)e.st===0&&e.z<=t.z+2&&(!i||e.z>i.z)&&(i=e);i&&(i.st=n.phase===`step`?1:-1,i.at=this.time,i.st===1&&this.particles?.sparkle(we.set(i.x,i.y+.6,-i.z),be,22,3,.6,.2,null,.4))}}update(e,t,n,r,i,s,c,l){this.time=t;let u=i&&r?r.plays:this.plays.length?this.plays:o(e);u!==this.plays&&this.build(e,u,s);let d=i&&r?r.mo:null,f=c?.75:.6+.4*Math.sin(t*3.2),p=0,m=null,h=0,g=2,_=this.pools;for(let[i,o]of this.marks){if(!this.plays[i]||!_)continue;let c=d!==null&&d.active===i,u=this.ended.has(i)||d!==null&&d.next>i&&!c,v=c&&r?r.tick-d.t0:0,y=-1;if(!u){for(let e=0;e<o.length;e++)if(o[e].st===0){y=e;break}}for(let r=0;r<o.length;r++){let i=o[r];if(i.z<n.z-30||i.z>n.z+(s?220:320))continue;i.gate&&i.st===0&&c&&(i.x=a(i.gate,v));let d=t-i.at,b=0,x=ve;if(i.st===1?(b=d<.25?1.6:Math.max(.15,1.4*(1-(d-.25)/.9)),x=ye):b=i.st===-1?Math.max(0,.5*(1-d/.5)):u?0:r===y?.7+.5*f:.3,b<=.01)continue;i.y=e.ground(i.x,i.z);let S=i.y+.12;Se.compose(we.set(i.x,S,-i.z),Ce.identity(),Te.set(i.w*2+1.2,1,i.gate?4.2:3.4)),_.setMatrixAt(p,Se),_.setColorAt(p,Ee.copy(x).multiplyScalar(b)),p++,i.gate&&r===y&&Math.abs(i.z-n.z)<200&&(m=[i.x,S,i.z],h=b,g=i.w),b>.6&&l>.3&&Math.abs(i.z-n.z)<80&&ce(i.x,S+2,-i.z,R.r,R.g,R.b,7,Math.min(1.2,b*.5*l))}}if(_&&(_.count=p,_.instanceMatrix.needsUpdate=!0,_.instanceColor&&(_.instanceColor.needsUpdate=!0)),this.shaft){let e=this.lantern;if(this.shaft.visible=!!(e&&m),e&&m){let t=we.set(e[0],e[1],-e[2]),n=new T(m[0],m[1]+.2,-m[2]).sub(t),r=n.length();Ce.setFromUnitVectors(xe,n.normalize()),this.shaft.position.copy(t),this.shaft.quaternion.copy(Ce),this.shaft.scale.set(g*1.1,r,g*1.1),this.shaftMat.uniforms.uK.value=Math.min(1,h)*(.14+.36*Math.min(1,l))}}if(this.lamps&&this.soarPlay>=0){let e=this.plays[this.soarPlay],r=n.z>e.z0-(s?420:700)&&n.z<e.z1+120;if(this.lamps.visible=r,r){let e=d!==null&&d.active===this.soarPlay,r=this.ended.get(this.soarPlay),i=.1;if(r){let e=t-r.t;i=r.won?.9+2.2*Math.exp(-e*1.4):.5*Math.exp(-e*2)*(.6+.4*Math.sin(e*23))}else e?i=d.aux>0?1.1+.6*f:.45+.35*f:(!d||d.next<=this.soarPlay)&&(i=.35);Ee.copy(R).multiplyScalar(.5+i),i<.15&&Ee.setRGB(.2,.2,.26);for(let e=0;e<this.lampAt.length;e++){this.lamps.setColorAt(e,Ee);let t=this.lampAt[e];i>.5&&Math.abs(t[2]-n.z)<160&&ce(t[0],t[1],-t[2],R.r,R.g,R.b,12,Math.min(1.4,i*.6))}this.lamps.instanceColor&&(this.lamps.instanceColor.needsUpdate=!0)}}}},Ae=new y(`#C4CEE6`),z=new y(`#FFE7A8`),je=new y(`#FFE2BC`).convertSRGBToLinear(),Me=new y(`#1C2232`),Ne=520,Pe=150,Fe=16,Ie=30,Le=2.3,Re=7,B=new h,V=new S,ze=new T,Be=new T,Ve=new y,He=new T(0,1,0);function Ue(e,t){let n=Math.imul(e^2654435769,2246822507)^Math.imul(t+1663821227,3266489909);return n^=n>>>15,n=Math.imul(n,739982445),n^=n>>>12,(n>>>0)/4294967296}function We(e){return new d({vertexShader:`
      varying vec2 vUv;
      varying vec3 vCol;
      void main() {
        vUv = uv;
        #ifdef USE_INSTANCING_COLOR
        vCol = instanceColor;
        #else
        vCol = vec3(1.0);
        #endif
        ${e?`gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);`:`vec4 c = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float k = length(instanceMatrix[0].xyz);
        c.xy += position.xy * k;
        gl_Position = projectionMatrix * c;`}
      }`,fragmentShader:`
      varying vec2 vUv;
      varying vec3 vCol;
      void main() {
        vec2 q = vUv - 0.5;
        float d = length(q) * 2.0;
        float a = ${e?`(1.0 - smoothstep(0.0, 1.0, length(q * vec2(2.0, 1.0)) * 2.0)) * 0.7`:`exp(-d * d * 5.0) + (1.0 - smoothstep(0.0, 1.0, d)) * 0.25`};
        gl_FragColor = vec4(vCol * a, a);
      }`,transparent:!0,depthWrite:!1,blending:2})}function Ge(){let e=[],t=(t,n,r,i,a=0,o=0)=>{e.push(N(t,Ae,{pos:[n,r,i],rot:[o,0,a]}))};return t(new C(.26,.46,1.35,8),0,.9,0),t(new C(.16,.2,.4,7),.12,.25,0),t(new C(.16,.2,.4,7),-.12,.25,0),t(new x(.17,8,6),0,1.75,0),t(new C(.34,.38,.05,10),0,1.86,.03),t(new C(.12,.17,.2,8),0,1.97,0),t(new C(.07,.08,.62,6),.36,1.36,-.1,1.05),t(new C(.07,.08,.6,6),-.3,1.1,0,-.25),L(e)}function Ke(){let e=[],t=new C(1.6,1.1,13,6,1).rotateZ(Math.PI/2);return e.push(N(t,Me,{pos:[0,.6,0]})),e.push(N(new p(1.6,3.4,6).rotateZ(-Math.PI/2),Me,{pos:[8.1,.6,0]})),e.push(N(new C(1.1,1.1,2.2,4).rotateY(Math.PI/4),Me,{pos:[-2.5,2.4,0]})),e.push(N(new C(.12,.16,7,5),Me,{pos:[2.2,4.5,0]})),L(e)}var qe=class{constructor(){t(this,`root`,new b),t(this,`figMat`,new v({color:16777215,vertexColors:!0,transparent:!0,opacity:.8,depthWrite:!1})),t(this,`hullMat`,new v({color:16777215,vertexColors:!0,transparent:!0,opacity:.85,depthWrite:!1})),t(this,`glowMat`,We(!1)),t(this,`lieMat`,We(!0)),t(this,`keeper`,null),t(this,`keeperLamp`,null),t(this,`keeperPool`,null),t(this,`boats`,null),t(this,`boatLamps`,null),t(this,`boatLie`,null),t(this,`boatWake`,null),t(this,`wakeMat`,new d({vertexShader:`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }`,fragmentShader:`
      varying vec2 vUv;
      void main() {
        // A wedge widening astern (vUv.y 1 at the boat), broken, fading out behind.
        float w = mix(0.08, 0.5, 1.0 - vUv.y);
        float a = (1.0 - smoothstep(w * 0.6, w, abs(vUv.x - 0.5))) * smoothstep(0.0, 0.7, vUv.y) * 0.55;
        gl_FragColor = vec4(vec3(0.86, 0.9, 0.96), a);
      }`,transparent:!0,depthWrite:!1})),t(this,`fleetT`,0),t(this,`overAt`,-1),this.root.name=`gullhaven-legends`}ensure(e){if(this.keeper)return;let t=new u(Ge(),this.figMat);t.frustumCulled=!1,t.renderOrder=6,t.visible=!1,this.keeper=t;let n=new w(1,1),r=new c(n,this.glowMat,1);r.frustumCulled=!1,r.renderOrder=7,r.visible=!1,r.setColorAt(0,Ve.copy(z)),this.keeperLamp=r;let i=new c(new w(1,1).rotateX(-Math.PI/2),this.lieMat,1);i.frustumCulled=!1,i.renderOrder=5,i.visible=!1,this.keeperPool=i;let a=e?Fe/2:Fe,o=new c(Ke(),this.hullMat,a);o.frustumCulled=!1,o.visible=!1,this.boats=o;let s=new c(n,this.glowMat,a);s.frustumCulled=!1,s.renderOrder=7,s.visible=!1,s.setColorAt(0,Ve.copy(z)),this.boatLamps=s;let l=new c(new w(1,1).rotateX(-Math.PI/2),this.lieMat,a);l.frustumCulled=!1,l.renderOrder=6,l.visible=!1,l.setColorAt(0,Ve.copy(z)),this.boatLie=l;let d=new c(new w(1,1).rotateX(-Math.PI/2),this.wakeMat,a);d.frustumCulled=!1,d.renderOrder=5,d.visible=!1,this.boatWake=d,this.root.add(t,r,i,o,s,l,d)}reset(){this.fleetT=0,this.overAt=-1,this.hide()}hide(){for(let e of this.root.children)e.visible=!1}update(e,t,n,r,i,a,o,s,c,l){this.hide();let u=a&&i?i.legend:null;if(!i||!u||r.z<u.z0-Ne||r.z>u.z1+Pe)return;this.ensure(o);let d=i.lg;u.key===`keeper`&&u.path&&d.phase>=1?this.keeperAt(e,t,r,u,d.phase,d.head,s):u.key===`fleet`&&this.fleetAt(e,t,n,r,u,d.phase,s,c,l)}keeperAt(e,t,n,r,a,o,s){let c=r.path,l=a>=3,u=a===2?o:r.z0+18;u=Math.max(u,n.z+Math.max(18,Ie)),l&&(u=Math.max(u,Math.min(c.z1+40,n.z+18+10)));let d=Math.max(c.z0,Math.min(c.z1,u)),f=i(e,c,d)+r.side*Re,p=e.ground(f,d),m=l?Math.max(0,1-(n.z-r.z1)/90):a===1?.75:1;if(m<=.01)return;let h=s?0:t*6.5,g=Math.abs(Math.sin(h))*.07,_=Math.sin(h)*.05,v=(i(e,c,Math.min(c.z1,d+2))-i(e,c,Math.max(c.z0,d-2)))/4,y=this.keeper;y.visible=!0,y.position.set(f,p+g,-d),y.rotation.set(0,Math.PI+Math.atan(v),_),y.scale.setScalar(Le),this.figMat.opacity=.8*m;let b=f+.75*Le*Math.cos(Math.atan(v)),x=p+1.35*Le+g+.05*Math.sin(h*2),S=this.keeperLamp;S.visible=!0,B.compose(ze.set(b,x,-d+.1),V.identity(),Be.setScalar(4.5)),S.setMatrixAt(0,B),S.setColorAt(0,Ve.copy(z).multiplyScalar((1.6+.2*Math.sin(t*11))*m)),S.instanceMatrix.needsUpdate=!0,S.instanceColor&&(S.instanceColor.needsUpdate=!0);let C=this.keeperPool;C.visible=!0,B.compose(ze.set(f+.3,p+.08,-d),V.identity(),Be.set(9,1,14)),C.setMatrixAt(0,B),C.setColorAt(0,Ve.copy(z).multiplyScalar(.5*m)),C.instanceMatrix.needsUpdate=!0,C.instanceColor&&(C.instanceColor.needsUpdate=!0),Math.abs(d-n.z)<140&&ce(b,x,-d,je.r,je.g,je.b,9,.9*m)}fleetAt(e,t,n,r,i,a,o,s,c){a===0&&(this.fleetT=0,this.overAt=-1),this.fleetT+=o?0:n,a>=3&&this.overAt<0&&(this.overAt=t);let l=a===0?.25:a===1?.6:a===2?1:Math.max(0,1-(t-this.overAt)/6);if(l<=.01)return;let u=this.boats,d=this.boatLamps,f=this.boatLie,p=this.boatWake,m=u.count,g=i.z0+320+this.fleetT*7;for(let n=0;n<m;n++){let i=n%2,a=g-Math.floor(n/2)*68-i*30+(Ue(n,1)-.5)*10,m=260+i*170+40*Math.sin(a*.004+i)+(Ue(n,2)-.5)*20,_=c(Math.max(0,Math.min(e.finishZ,a)))+m,v=-.03+.06*Ue(n,4),y=o?0:.05*Math.sin(t*(.9+Ue(n,5))+n);V.setFromAxisAngle(He,-Math.PI/2+v),B.compose(ze.set(_,s+.4,-a),V,Be.set(1.5,1.5,1.5)),B.multiply(new h().makeRotationX(y)),u.setMatrixAt(n,B);let b=Math.hypot(_-r.x,a-r.z);B.compose(ze.set(_,s+12,-a),V.identity(),Be.setScalar(10+b*.035)),d.setMatrixAt(n,B),d.setColorAt(n,Ve.copy(z).multiplyScalar((1.3+.4*Ue(n,6))*l));let x=Math.atan2(r.x-_,-(r.z-a));V.setFromAxisAngle(He,x),B.compose(ze.set(_,s+2.5,-a),V,Be.set(10+b*.008,1,50+b*.05)),f.setMatrixAt(n,B),f.setColorAt(n,Ve.copy(z).multiplyScalar(.7*l)),V.setFromAxisAngle(He,v),B.compose(ze.set(_,s+.8,-(a-15)),V,Be.set(9,1,24)),p.setMatrixAt(n,B)}for(let e of[u,d,f,p])e.visible=!0,e.instanceMatrix.needsUpdate=!0,e.instanceColor&&(e.instanceColor.needsUpdate=!0);this.hullMat.opacity=.85*Math.min(1,l+.4)}dispose(){for(let e of this.root.children)e.geometry?.dispose();this.figMat.dispose(),this.hullMat.dispose(),this.glowMat.dispose(),this.lieMat.dispose(),this.wakeMat.dispose()}},Je=new y(`#363850`),Ye=new y(`#26283C`),Xe=new y(`#4C4E68`),Ze=new y(`#9A8E86`),Qe=new y(`#C2B6A6`),$e=new y(`#8A7E76`),H=new y(`#7E7C8E`),U=new y(`#5C5A6E`),et=new y(`#EEEAE2`),tt=new y(`#E4DED2`),nt=new y(`#3C3E54`),rt=new y(`#3A3236`),it=new y(`#4E4246`),W=new y(`#262430`),G=new y(`#2A2E48`),at=new y(`#3E6CA8`),ot=new y(`#E8E2D2`),st=new y(`#E8E2D2`),ct=new y(`#4A72AE`),lt=[new y(`#2E4A6A`),new y(`#3E5E50`),new y(`#E4DED0`),new y(`#4C3E5A`),new y(`#2A3A4E`)],ut=new y(`#F4F2EE`),dt=new y(`#EEE4D0`),ft=new y(`#D6E0F2`),pt=new y(`#A8AEBC`),mt=new y(`#2A2A34`),ht=new y(`#FFC88A`),gt=new y(`#FFE2BC`).convertSRGBToLinear(),_t=new y(`#FFB27A`).convertSRGBToLinear(),vt=3.2,yt=4,bt=.8,K=new h,q=new S,J=new T,Y=new T,X=new T(0,1,0);function Z(e,t){let n=Math.imul(e^2654435769,2246822507)^Math.imul(t+1663821227,3266489909);return n^=n>>>15,n=Math.imul(n,739982445),n^=n>>>12,(n>>>0)/4294967296}function Q(e,t,n,r,i){let a=new h().compose(new T(t,n,-r),new S().setFromAxisAngle(X,i),new T(1,1,1));for(let t of e)t.applyMatrix4(a);return e}function $(e,t){return e.centerX(t)+e.halfWidth(t)}function xt(e,t){return $(e,t)+Math.min(e.edgeLimit(t),bt)+.08}function St(e,t,n){let r=$(e,t),i=.8;for(;i<160&&!(M(e,r+i,t)<=n+.5);i+=4);let a=Math.max(.6,i-4),o=i;for(let i=0;i<6;i++){let i=(a+o)/2;M(e,r+i,t)<=n+.5?o=i:a=i}return r+o}function Ct(e,t){return new d({uniforms:{...e,uTime:ue.uTime},defines:{SEA_Q:t},vertexShader:`
      varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,fragmentShader:`
      uniform float uTime;
      varying vec3 vW;
      ${se}
      void main() {
        vec3 d = normalize(vW - cameraPosition);
        gl_FragColor = vec4(seaOfClouds(d).rgb, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `})}function wt(e,t,n){let r=[0,0,0];for(let i=1;i<=t;i++){let a=e*(i/t)**2;for(let e=0;e<n;e++){let t=e/n*Math.PI*2;r.push(Math.sin(t)*a,0,Math.cos(t)*a)}}let i=[];for(let e=0;e<n;e++)i.push(0,1+e,1+(e+1)%n);for(let e=1;e<t;e++){let t=1+(e-1)*n,r=1+e*n;for(let e=0;e<n;e++){let a=(e+1)%n;i.push(t+e,r+e,t+a,t+a,r+e,r+a)}}let a=new _;return a.setAttribute(`position`,new l(new Float32Array(r),3)),a.setIndex(i),a}function Tt(e){return new d({transparent:!0,depthWrite:!1,side:2,uniforms:{...e,uTime:ue.uTime,uFoam:{value:new y},uFoamShade:{value:new y},uLive:{value:1}},defines:{SEA_Q:0},vertexShader:`
      attribute float aU;
      attribute float aS;
      varying float vU;
      varying float vS;
      varying vec3 vW;
      void main() {
        vU = aU;
        vS = aS;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,fragmentShader:`
      uniform float uTime;
      uniform float uLive;
      uniform vec3 uFoam;
      uniform vec3 uFoamShade;
      varying float vU;
      varying float vS;
      varying vec3 vW;
      ${se}
      void main() {
        float T = uTime * uLive;
        // Lines of breaking water running in to the shore, broken along their length, and the wash at the foot.
        float run = vU * 6.0 + T * 0.55 + snoise(vec2(vS * 0.05, 1.0)) * 1.5;
        float line = smoothstep(0.55, 0.95, sin(run * 3.14159) * 0.5 + 0.5) * smoothstep(-0.3, 0.5, snoise(vec2(vS * 0.08, vU * 3.0 - T * 0.2)));
        float wash = 1.0 - smoothstep(0.0, 0.35, vU);
        float a = max(line * (1.0 - vU) * 0.8, wash * (0.75 + 0.25 * sin(T * 0.9 + vS * 0.03)));
        a *= smoothstep(1.0, 0.7, vU);
        vec3 d = vW - cameraPosition;
        float dist = length(d);
        a *= 1.0 - smoothstep(2600.0, 4200.0, dist);
        if (a < 0.01) discard;
        vec3 col = mix(uFoamShade, uFoam, smoothstep(0.2, 0.9, line + wash * 0.5));
        float t = dist;
        col = mix(col, uSeaHaze, smoothstep(2500.0, 18000.0, t) * 0.85);
        gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `})}function Et(){return new d({transparent:!0,depthWrite:!1,blending:1,uniforms:{...ue,uLive:{value:1},uScale:{value:400},uLit:{value:new y},uShade:{value:new y}},vertexShader:`
      uniform float uTime;
      uniform float uLive;
      uniform float uScale;
      attribute vec4 aSeed;
      attribute vec3 aSpan;
      varying float vA;
      varying float vH;
      void main() {
        float T = uTime * uLive;
        // aSpan: the column's height (from its foot under the rim to well over it), its rise speed, and its half-width.
        float H = aSpan.x;
        float k = fract(aSeed.w + T * aSpan.y / H);
        vec3 p = position;
        p.y += k * H;
        // Swirling as it climbs, and leaning inland (-x) where it spills over the rim.
        float sw = sin(T * 1.7 + aSeed.x * 6.28 + k * 9.0);
        p.x += sw * aSpan.z * 0.5 - smoothstep(0.65, 1.0, k) * 4.0;
        p.z += cos(T * 1.3 + aSeed.y * 6.28 + k * 7.0) * 1.2;
        vec4 mv = viewMatrix * modelMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(uScale * (0.2 + 0.24 * aSeed.z) / max(-mv.z, 1.0), 1.5, 18.0);
        // (Gone near the lens, where a mote is a blot on the glass.)
        vA = smoothstep(0.0, 0.18, k) * (1.0 - smoothstep(0.62, 1.0, k)) * (1.0 - smoothstep(160.0, 420.0, -mv.z)) * smoothstep(7.0, 22.0, -mv.z);
        vH = k;
      }
    `,fragmentShader:`
      uniform vec3 uLit;
      uniform vec3 uShade;
      varying float vA;
      varying float vH;
      void main() {
        vec2 q = gl_PointCoord - 0.5;
        // A streak drawn up by the wind: narrow across, long upward.
        float r = length(vec2(q.x * 2.6, q.y * 0.9));
        float a = (1.0 - smoothstep(0.12, 0.5, r)) * vA * 0.72;
        if (a < 0.01) discard;
        gl_FragColor = vec4(mix(uShade, uLit, 0.4 + 0.6 * vH), a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `})}function Dt(){return new d({transparent:!0,depthWrite:!1,side:2,blending:2,uniforms:{uK:{value:.3},uCol:{value:new y(`#F4F2E6`)}},vertexShader:`
      varying float vAlong;
      varying float vFace;
      varying float vFade;
      void main() {
        // (The cone runs along its own +x from the lantern: how far along it, 0 to 1.)
        vAlong = clamp(position.x / 900.0, 0.0, 1.0);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        vFace = abs(dot(n, normalize(-mv.xyz)));
        vFade = smoothstep(12.0, 40.0, -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,fragmentShader:`
      uniform float uK;
      uniform vec3 uCol;
      varying float vAlong;
      varying float vFace;
      varying float vFade;
      void main() {
        float a = pow(vFace, 2.2) * pow(1.0 - vAlong, 2.6) * uK * vFade * 0.5;
        gl_FragColor = vec4(uCol * a, 1.0);
      }
    `})}function Ot(){return new d({transparent:!0,depthWrite:!1,side:2,uniforms:{...ue,uLit:{value:new y},uShade:{value:new y},uFire:{value:new y(`#FF9A5A`)},uLive:{value:1}},vertexShader:`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,fragmentShader:`
      uniform float uTime;
      uniform float uLive;
      uniform vec3 uLit;
      uniform vec3 uShade;
      uniform vec3 uFire;
      varying vec2 vUv;
      ${kt}
      void main() {
        float T = uTime * uLive;
        // The plume leaves the fire upward and is bent flat inland (along +u) by the wind, widening as it goes.
        float t = vUv.x;
        float yc = 0.12 + 0.35 * pow(t, 0.55) * 0.5 + 0.03 * sin(t * 9.0 - T * 1.4);
        float w = 0.02 + 0.13 * t;
        float dy = (vUv.y - yc) / w;
        float n = snoise2(vec2(t * 5.0 - T * 0.5, vUv.y * 6.0)) * 0.6 + snoise2(vec2(t * 13.0 - T * 1.1, vUv.y * 15.0 + 2.0)) * 0.4;
        float dens = exp(-dy * dy * 1.4) * (0.7 + 0.5 * n) * (1.0 - smoothstep(0.55, 1.0, t)) * smoothstep(0.0, 0.04, t);
        float a = smoothstep(0.12, 0.6, dens) * 0.4;
        if (a < 0.01) discard;
        vec3 col = mix(uShade, uLit, clamp(0.5 + n * 0.4 - dy * 0.2, 0.0, 1.0));
        col = mix(col, uFire, (1.0 - smoothstep(0.0, 0.05, t)) * 0.35);
        gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `})}var kt=`
  vec3 g289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 g289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 gperm(vec3 x) { return g289(((x * 34.0) + 10.0) * x); }
  float snoise2(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = g289(i);
    vec3 p = gperm(gperm(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
`,At=class{constructor(e,n){t(this,`root`,new b),t(this,`course`,null),t(this,`detail`,`high`),t(this,`sea`,0),t(this,`mat`,void 0),t(this,`glow`,void 0),t(this,`cloth`,void 0),t(this,`rockMat`,void 0),t(this,`fenceMat`,void 0),t(this,`paintMat`,void 0),t(this,`owned`,[]),t(this,`seaMat`,void 0),t(this,`seaMesh`,void 0),t(this,`surfMat`,void 0),t(this,`driftMat`,void 0),t(this,`beamMat`,void 0),t(this,`smokeMat`,void 0),t(this,`windows`,[]),t(this,`lamps`,[]),t(this,`pierLamps`,[]),t(this,`pierHalo`,null),t(this,`haloMat`,We(!1)),t(this,`fire`,null),t(this,`light`,null),t(this,`beam`,null),t(this,`gulls`,null),t(this,`wheel`,[]),t(this,`hang`,[]),t(this,`pieces`,void 0),t(this,`legends`,new qe),t(this,`stackSpots`,[]),this.root.name=`gullhaven-world`,this.pieces=new ke(e),this.mat=P({coolShade:.5,stone:!0}),this.glow=P({coolShade:.4,emissive:ht.clone(),emissiveStrength:0}),this.cloth=P({coolShade:.45,cloth:!0,doubleSided:!0}),this.rockMat=P({coolShade:.12,doubleSided:!0,rim:.12,deepClear:!0}),this.fenceMat=P({coolShade:.3}),this.paintMat=P({coolShade:.18,rim:.22}),this.cloth.uniforms.uCloth.value=.16,this.seaMat=Ct(n,1),this.seaMesh=new u(wt(4800,28,96),this.seaMat),this.seaMesh.name=`sea`,this.seaMesh.frustumCulled=!1,this.seaMesh.renderOrder=-8,this.surfMat=Tt(n),this.driftMat=Et(),this.beamMat=Dt(),this.smokeMat=Ot()}setDetail(e){if(e===this.detail)return;this.detail=e;let t=e===`low`?0:1;this.seaMat.defines.SEA_Q!==t&&(this.seaMat.defines.SEA_Q=t,this.seaMat.needsUpdate=!0),this.course&&this.build(this.course)}setCourse(e){e!==this.course&&(this.course=e,this.build(e))}reset(){this.pieces.reset(),this.legends.reset()}beats(e,t){this.course&&te(this.course)&&this.pieces.beats(e,t)}dispose(){for(let e of[...this.root.children])this.root.remove(e);for(let e of this.owned)e.dispose();this.owned.length=0,this.pieces.clear(),this.windows=[],this.lamps=[],this.pierLamps=[],this.pierHalo=null,this.fire=null,this.light=null,this.beam=null,this.gulls=null,this.wheel=[],this.hang=[]}keep(e){return this.owned.push(e),e}add(e,t=this.mat,n=-1/0,r=1/0,i=!0){let a=new u(this.keep(e),t);return n>-1/0&&this.windows.push({m:a,z0:n,z1:r}),a.castShadow=i&&t!==this.glow,a.receiveShadow=!0,a.matrixAutoUpdate=!1,a.updateMatrix(),this.root.add(a),a}inst(e,t,n=this.mat){let r=new c(this.keep(e),n,Math.max(1,t));return r.castShadow=!0,r.receiveShadow=!0,r}build(e){if(this.dispose(),!te(e))return;this.sea=O(e);let t=this.detail===`low`;if(this.root.add(this.seaMesh),ie(t?`low`:`full`,()=>{this.fence(e,t),this.brow,this.moorWall(e,t),this.moorStones(e,t),this.gullies(e,t),this.stacks(e,t),this.surf(e,t),this.beacon(e,t),this.lighthouse(e,t),this.harbour(e,t),this.birds(e,t)}),this.pieces.lantern=this.light,this.root.add(this.pieces.root),this.root.add(this.legends.root),this.pierLamps.length){let e=new c(this.keep(new w(1,1)),this.haloMat,this.pierLamps.length);this.pierLamps.forEach(([t,n,r],i)=>{e.setMatrixAt(i,new h().compose(new T(t,n,-r),new S,new T(7,7,7))),e.setColorAt(i,new y(0,0,0))}),e.frustumCulled=!1,e.renderOrder=7,e.name=`pier-halos`,this.root.add(e),this.pierHalo=e}}fence(e,t){let i=vt*(t?2:1),a=r(e).harbour+8,o=Math.ceil((a-4)/i)+1,s=N(new C(.06,.08,1.45,t?4:5,1),Ze,{pos:[0,.62,0]}),c=[N(new C(.035,.035,1,4,1),$e,{pos:[0,1.15,.5],rot:[Math.PI/2,0,0]})];t||c.push(N(new C(.03,.03,1,4,1),$e,{pos:[0,.38,.5],rot:[Math.PI/2,0,0]}));let l=L(c),u=[];for(let e=0;e<4;e++)u.push(k(.03,1.1,.12,Qe,[0,.72+e%2*.05,(e+.5)/4]));let d=L(u),f=this.inst(s,o,this.fenceMat),p=this.inst(l,o,this.fenceMat),m=t?null:this.inst(d,o,this.fenceMat);m&&(m.castShadow=!1);let h=Math.ceil(o/yt),g=this.inst(Nt(at),h,this.cloth),_=t?null:this.inst(Nt(ot),h,this.cloth),v=N(new C(.025,.025,1,4,1),Ze,{pos:[0,1.85,0]}),y=t?null:this.inst(v,h,this.fenceMat),b=n(e),x=e=>{let t=0;for(let n of b)e<n.zL-30||e>n.zL+n.column+20||(t=Math.max(t,jt(n.zL-24,n.zL-6,e)*(1-jt(n.zL+n.column-10,n.zL+n.column+14,e))));return t},w=0,E=0,ee=0,D=0,te=0,O=null;for(let t=0;t<o;t++){let n=Math.min(a,4+t*i),r=xt(e,n),o=j(e,r,n);if(J.set(r,o-.06,-n),K.compose(J,q.identity(),Y.set(1,1,1)),f.setMatrixAt(w++,K),O){let e=J.clone().sub(O),t=e.length();if(q.setFromUnitVectors(new T(0,0,1),e.clone().normalize()),K.compose(O,q,Y.set(1,1,t)),p.setMatrixAt(E,K),m){let t=Math.atan2(e.x,e.z);q.setFromAxisAngle(X,t),K.compose(O,q,Y.set(1,1,Math.hypot(e.x,e.z)));let n=K.elements;n[9]+=e.y,m.setMatrixAt(E,K)}E++}if(O=J.clone(),t%yt===0){y&&y.setMatrixAt(ee++,K.compose(J,q.identity(),Y.set(1,1,1)));let e=x(n),r=Math.PI+(Z(t,3)-.5)*.3,i=-.18-e*1.35;q.setFromAxisAngle(X,r).multiply(new S().setFromAxisAngle(new T(0,0,1),-i)),K.compose(J.clone().add(new T(0,y?1.98:1.2,0)),q,Y.set(1,1,1)),!_||Math.floor(t/yt)%2==0?g.setMatrixAt(D++,K):_.setMatrixAt(te++,K)}}f.count=w,p.count=E,m&&(m.count=E),y&&(y.count=ee),g.count=D,_&&(_.count=te);for(let e of[y,g,_])e&&(e.castShadow=!1);for(let e of[f,p,m,y,g,_])e&&(e.computeBoundingSphere(),e.name=`fence`,this.root.add(e))}brow(e,t){let i=I({rx:.5,rz:.5,h:1,foot:3,layers:t?4:6,sides:t?5:7,rock:[Ye,Je,Xe],lie:F,taper:.25,shift:.2,dip:.2,warp:.35,rough:.35,lieMin:.12,seed:2880}),a=[],o=n(e),s=r(e).descent;for(let n=40,r=0;n<s;r++){if(n+=(t?34:18)+Z(r,61)*22,o.some(e=>n>e.zL-12&&n<e.zL+6)||Math.abs(n-de.z)<20||Math.abs(n-D(e))<30)continue;let i=$(e,n)+1.6+Z(r,62)*2.5,s=e.ground($(e,n)-.2,n),c=3+Z(r,63)*5;a.push([i,s-c*.55,n,c,Z(r,64)*6.28])}let c=this.inst(i,a.length,this.rockMat);a.forEach(([e,t,n,r,i],a)=>{q.setFromAxisAngle(X,i),K.compose(J.set(e,t,-n),q,Y.set(r,r*.8,r)),c.setMatrixAt(a,K)}),c.computeBoundingSphere(),c.name=`brow`,this.root.add(c)}moorWall(e,t){let n=2.6,i=[];if(t)i.push(N(new C(.42,.55,1,5,2),H,{pos:[0,.48,0],rot:[0,.3,0],scale:[1,1,n*1.04/1],jitter:.12})),i.push(N(new C(.36,.42,.14,5,1),F,{pos:[0,1,0],rot:[0,.3,0],scale:[1,1,n*1.02/.82],jitter:.06}));else{for(let e=0;e<3;e++)i.push(N(new m(.62,.42,.9),e%2?H:U,{pos:[0,.21,-2.6/2+.45+e*.86],jitter:.07}));for(let e=0;e<3;e++)i.push(N(new m(.5,.36,.82),e%2?U:H,{pos:[0,.6,-2.6/2+.85+e*.86],jitter:.07}));for(let e=0;e<6;e++)i.push(N(new m(.38,.32,.16),e%2?U:H,{pos:[0,.94,-1.08+e*.43],rot:[.12*(e%3-1),0,0],jitter:.04}));i.push(N(new m(.42,.08,n*.98),F,{pos:[.02,1.12,0],jitter:.03}))}let a=L(i),o=[],s=r(e).descent,c=4.2;for(let t=210;t<s;t+=n*1){if(Z(Math.floor(t/37),11)<.16)continue;let r=e.centerX(t)-e.halfWidth(t)-c,i=e.centerX(t+n)-e.halfWidth(t+n)-c;o.push([r,j(e,r,t),t,Math.atan2(i-r,n)])}for(let r=0;r<40;r++){let i=300+r*210+Z(r,5)*90;if(i>s-40)break;let a=30+Z(r,6)*80,l=e.centerX(i)-e.halfWidth(i)-c;for(let s=1.5;s<a;s+=n){if(t&&Z(r,Math.floor(s))<.2)continue;let n=l-s,a=i+s*.12;o.push([n,j(e,n,a),a,Math.PI/2+.12])}}let l=this.inst(a,o.length);o.forEach(([e,t,n,r],i)=>{q.setFromAxisAngle(X,r),K.compose(J.set(e,t-.12,-n),q,Y.set(1,.85+Z(i,1)*.3,1)),l.setMatrixAt(i,K)}),l.computeBoundingSphere(),l.name=`moor-wall`,this.root.add(l)}moorStones(e,t){let n=N(new s(1,0),Xe,{jitter:.35}),i=N(new x(.8,5,3,0,Math.PI*2,0,Math.PI/2),F,{pos:[.15,.55,-.1],scale:[1,.45,1],jitter:.1}),a=L([n,i]),o=[],c=r(e).sheds,l=t?24:12;for(let t=120,n=0;t<c;t+=l,n++){let r=9+Z(n,21)*120,i=e.centerX(t)-e.halfWidth(t)-r,a=t+Z(n,22)*l;o.push([i,j(e,i,a),a,.6+Z(n,23)*1.6,Z(n,24)*6.28])}let u=this.inst(a,o.length);o.forEach(([e,t,n,r,i],a)=>{q.setFromAxisAngle(X,i),K.compose(J.set(e,t-r*.35,-n),q,Y.set(r*1.3,r*.8,r)),u.setMatrixAt(a,K)}),u.computeBoundingSphere(),u.name=`moor-stones`,this.root.add(u);let d=[];for(let t=0;t<14;t++){let n=260+t*330+Z(t,31)*120;if(n>c)break;let r=e.centerX(n)-e.halfWidth(n)-18-Z(t,32)*50,i=j(e,r,n),a=1.6+Z(t,33)*1.4;d.push(N(new p(.9,a,6,3),U,{pos:[r,i+a/2-.1,-n],jitter:.18})),d.push(N(new x(.35,5,3),H,{pos:[r,i+a-.05,-n],jitter:.08}))}d.length&&(this.add(L(d)).name=`cairns`)}gullies(e,t){let r=[],i=[],a=[],o=[],s=[],c=[];for(let l of n(e)){this.lip(e,l,r),this.sock(e,l,i),this.geoWalls(e,l,c,t);let n=t?70:220,u=e.baseY(l.zL);for(let t=0;t<n;t++){let n=Z(l.index*977+t,41),r=Z(l.index*977+t,42),i=l.zL-4+n*(l.column+8),c=l.bx+2.5+r*($(e,i)-l.bx+7),d=u-26-r*10;a.push(c,d,-i),o.push(Z(t,l.index),Z(t+7,l.index),Z(t+13,l.index),Z(t+29,l.index)),s.push(40+n*8,6+r*4,3.4)}}if(this.add(L(t?[...r,...i.map(e=>(e.deleteAttribute(`aSway`),e))]:r)).name=`cornices`,c.length&&(this.add(L(c),this.rockMat).name=`geo-walls`),i.length&&!t){let e=new u(this.keep(L(i)),this.cloth);e.name=`windsocks`,e.castShadow=!0,this.root.add(e)}let d=this.keep(new _);d.setAttribute(`position`,new l(new Float32Array(a),3)),d.setAttribute(`aSeed`,new l(new Float32Array(o),4)),d.setAttribute(`aSpan`,new l(new Float32Array(s),3));let p=new f(d,this.driftMat);p.frustumCulled=!1,p.name=`spindrift`,p.renderOrder=3,this.root.add(p)}geoWalls(e,t,n,r){let i=this.sea-25;for(let[a,o]of[[t.zL-10,1],[t.zL+t.mouth-1,-1]]){let s=xt(e,a)+.15,c=Math.max(s+20,St(e,a+o*14,this.sea)+8),l=r?8:16,u=null,d=null;for(let r=0;r<=l;r++){let f=s+(c-s)*r/l,p=a+o*(Z(t.index*31+r,o>0?5:6)-.5)*3,m=[f,Math.max(i,M(e,f,a+o*16))+.2,-p],h=[f,i,-p];if(u&&d){let e=r%3?Je:Ye;n.push(A(d,h,m,u,e)),n.push(A(u,m,h,d,e));let a=u[1]-i;for(let e=1;e<6;e++){let s=i+e/6*a+(Z(r,e+t.index)-.5)*6;if(s>Math.min(u[1],m[1])-2)continue;let c=o*-.6;n.push(A([u[0],s,u[2]+c],[m[0],s+1.2,m[2]+c],[m[0],s+2.4,m[2]+c],[u[0],s+1.6,u[2]+c],e%2?Xe:F))}}u=m,d=h}}}lip(e,t,n){let r=t.zL,i=e.centerX(r)+9.5,a=xt(e,r)-.3,o=[[-1.6,-.02,0],[-.4,.04,0],[.35,.03,0],[.85,-.1,1],[1.1,-.4,1],[.95,-.85,2],[.5,-1.25,2]],s=[F,new y(`#D4DCF0`),new y(`#9CA6CA`)];for(let c=0;c<16;c++){let l=i+(a-i)*c/16,u=i+(a-i)*(c+1)/16,d=e.ground(l,r-1.8),f=e.ground(u,r-1.8),p=.65+.7*Z(t.index*53+c,71),m=.65+.7*Z(t.index*53+c+1,71);for(let e=0;e+1<o.length;e++){let[t,i]=o[e],[a,c,h]=o[e+1],g=[l,d+i,-(r+t*(t>0?p:1))],_=[u,f+i,-(r+t*(t>0?m:1))],v=[l,d+c,-(r+a*(a>0?p:1))],y=[u,f+c,-(r+a*(a>0?m:1))];n.push(A(g,_,y,v,s[h]))}}}sock(e,t,n){let r=t.zL-1,i=xt(e,r),a=j(e,i,r);n.push(Mt(N(new C(.035,.05,5.2,5,1),Qe,{pos:[0,2.6,0]}),i,a,r));for(let e=0;e<5;e++){let t=.34-e*.04,o=t-.04,s=new C(o,t,.42,8,1,!0),c=new Float32Array(s.getAttribute(`position`).count).fill(Math.min(1,e/4+.1)),u=N(s,e%2?ct:st,{pos:[0,5.4+e*.42,0]});u.setAttribute(`aSway`,new l(new Float32Array(u.getAttribute(`position`).count).fill(c[0]),1)),u.applyMatrix4(new h().makeRotationZ(.14)),n.push(Mt(u,i,a,r))}for(let e of n)e.getAttribute(`aSway`)||e.setAttribute(`aSway`,new l(new Float32Array(e.getAttribute(`position`).count),1))}stacks(e,t){let n=[{h:5,rx:.5,rz:.4,layers:13,seed:1514},{h:3,rx:.55,rz:.45,layers:10,seed:1515},{h:1.6,rx:.6,rz:.5,layers:7,seed:1516}].filter((e,n)=>!t||n===1).map(e=>I({rx:e.rx,rz:e.rz,h:e.h,layers:t?Math.ceil(e.layers*.6):e.layers,sides:t?6:8,rock:[Ye,Je,Xe],lie:null,taper:.28,shift:.12,dip:.07,warp:.25,bays:.25,rough:.3,seed:e.seed})),i=[[],[],[]],a=r(e).sheds-200,s=o(e).find(e=>e.verb===`stacks`);for(let[n,r]of(s?.targets??[]).entries()){let a=St(e,r.z,this.sea),o=12+Z(n,151)*8;i[t?0:n%2?1:2].push([a+26+Z(n,152)*24,r.z+(Z(n,153)-.5)*16,o,Z(n,154)*6.28,0])}let c=0;for(let n=60;n<a&&(n+=(t?220:120)+Z(c,51)*140,!(n>a));c++){let r=St(e,n,this.sea),a=40+Z(c,52)*220,o=16+Z(c,54)*20,s=t?0:Math.floor(Z(c,53)*3);i[s].push([r+a,n,o,Z(c,55)*6.28,0]),Z(c,56)<.45&&i[t?0:(s+1)%3].push([r+a+20+Z(c,57)*24,n+14+Z(c,58)*30,o*.55,Z(c,59)*6.28,0])}this.stackSpots=[],n.forEach((e,t)=>{let n=i[t];if(!n.length)return;let r=this.inst(e,n.length,this.rockMat);n.forEach(([e,t,n,i],a)=>{q.setFromAxisAngle(X,i),K.compose(J.set(e,this.sea-n*.6,-t),q,Y.set(n,n,n)),r.setMatrixAt(a,K),this.stackSpots.push([e,t,n*.5])}),r.computeBoundingSphere(),r.name=`sea-stacks`,this.root.add(r)})}surf(e,t){let n=[],r=[],i=[],a=[],o=this.sea+.15,s=t?8:4,c=-1,d=0,f=e.finishZ+400;for(let t=-60;t<=f;t+=s){let l=St(e,t,this.sea),u=n.length/3;n.push(l-.6,o,-t,l+9,o,-t),r.push(0,1),i.push(d,d),c>=0&&a.push(c,u,c+1,c+1,u,u+1),c=u,d+=s}for(let[e,t,s]of this.stackSpots){let c=n.length/3;for(let l=0;l<=14;l++){let u=l/14*Math.PI*2,d=s*.95;if(n.push(e+Math.sin(u)*d,o,-(t+Math.cos(u)*d),e+Math.sin(u)*(d+6.3),o,-(t+Math.cos(u)*(d+6.3))),r.push(0,1),i.push(l*6,l*6),l>0){let e=c+(l-1)*2,t=c+l*2;a.push(e,t,e+1,e+1,t,t+1)}}}let p=new _;p.setAttribute(`position`,new l(new Float32Array(n),3)),p.setAttribute(`aU`,new l(new Float32Array(r),1)),p.setAttribute(`aS`,new l(new Float32Array(i),1)),p.setIndex(a);let m=new u(this.keep(p),this.surfMat);m.frustumCulled=!1,m.renderOrder=-7,m.name=`surf`,this.root.add(m)}beacon(e,t){let n=de.z,r=$(e,n)+de.e,i=M(e,r,n),a=[];a.push(N(new x(6.4,9,4,0,Math.PI*2,0,Math.PI/2),F,{pos:[0,-.4,0],scale:[1,.32,1],jitter:.3}));let o=1.5;a.push(N(new C(2.1*o,2.5*o,5.2*o,t?8:12,4),U,{pos:[0,2.6*o,0],jitter:.08}));for(let e=0;e<4;e++)a.push(N(new C((2.52-e*.1)*o,(2.52-e*.1)*o,.1,t?8:12,1),H,{pos:[0,(.8+e*1.3)*o,0]}));a.push(N(new C(2.55*o,2.15*o,.5*o,t?8:12,1),H,{pos:[0,5.4*o,0]})),a.push(N(new C(2.6*o,2.6*o,.2,t?8:12,1),F,{pos:[0,5.75*o,0]})),a.push(k(.2,2.2,1.1,G,[-2.25*o,1.1,0]));let s=t?6:10;for(let e=0;e<s;e++){let t=e/s*Math.PI*2;a.push(ne([Math.cos(t)*.7*o,5.85*o,Math.sin(t)*.7*o],[Math.cos(t)*1.15*o,7.3*o,Math.sin(t)*1.15*o],.07,W))}a.push(N(new C(1.18*o,1.18*o,.1,10,1,!0),W,{pos:[0,7.3*o,0]})),a.push(N(new C(.72*o,.72*o,.1,10,1),W,{pos:[0,5.85*o,0]})),this.add(L(Q(a,r,i,n,0)),this.mat,n-10,n+10).name=`beacon`;let c=L([N(new p(1.4,2.2,7,1),new y(`#FFB060`),{pos:[0,10.65,0],jitter:.16}),N(new p(.75,2,5,1),new y(`#FFE0A0`),{pos:[.3,11.150000000000002,.15],jitter:.12})]),l=this.add(L(Q([c],r,i,n,0)),this.glow,n-10,n+10,!1);l.name=`beacon-fire`,this.fire=[r,i+7*o,n];let d=new w(1,1);d.translate(.5,.5,0);let f=new u(this.keep(d),this.smokeMat);f.position.set(r,i+7.2*o,-n),f.rotation.set(0,Math.PI,0),f.scale.set(60,26,1),f.frustumCulled=!1,f.renderOrder=4,f.name=`beacon-smoke`,this.root.add(f),this.windows.push({m:f,z0:n-10,z1:n+10})}lighthouse(e,t){let n=D(e),r=$(e,n)+re.e+4,i=M(e,r,n),a=[],o=t?10:16;a.push(N(new C(2.4,3.3,24,o,1),et,{pos:[0,12,0]})),a.push(N(new C(3.6,3.7,.9,o,1),H,{pos:[0,.45,0]}));for(let e=1;e<6;e++){let t=24*e/6,n=3.3-.9*t/24;a.push(N(new C(n+.06,n+.06,.18,o,1,!0),tt,{pos:[0,t,0]}))}if(a.push(N(new C(2.86,2.98,3.2,o,1,!0),nt,{pos:[0,12,0]})),a.push(k(.3,2.3,1.3,G,[-3.15,1.6,0])),!t)for(let[e,t]of[[6.5,.4],[11.5,-.6],[17,.2],[21,-.3]])a.push(k(.25,1.1,.6,G,[-Math.cos(t)*(3.15-.9*e/24),e,Math.sin(t)*(3.15-.9*e/24)],[0,-t,0]));a.push(N(new C(3.4,2.5,.5,o,1),W,{pos:[0,24.2,0]})),a.push(N(new C(3.3,3.3,.12,o,1,!0),W,{pos:[0,25.4,0]}));for(let e=0;e<(t?8:16);e++){let n=e/(t?8:16)*Math.PI*2;a.push(ne([Math.cos(n)*3.25,24.4,Math.sin(n)*3.25],[Math.cos(n)*3.25,25.45,Math.sin(n)*3.25],.04,W))}a.push(N(new C(1.9,1.9,.5,t?8:12,1),W,{pos:[0,24.7,0]})),a.push(N(new p(2.2,1.6,t?8:12,1),W,{pos:[0,28.4,0]})),a.push(N(new x(.35,6,4),W,{pos:[0,29.3,0]}));for(let e=0;e<(t?6:10);e++){let n=e/(t?6:10)*Math.PI*2;a.push(ne([Math.cos(n)*1.85,24.95,Math.sin(n)*1.85],[Math.cos(n)*1.85,27.6,Math.sin(n)*1.85],.06,W))}a.push(k(6,3.4,9,tt,[-8,1.7,0])),a.push(N(new C(0,4.9,2.6,4,1).rotateY(Math.PI/4),nt,{pos:[-8,4.7,0],scale:[.95,1,1.35]})),a.push(N(new C(0,3.43,1.82,4,1).rotateY(Math.PI/4),F,{pos:[-8,5.17,0],scale:[.95,1,1.35]})),a.push(k(.8,2.2,.8,U,[-8,5.4,3.2])),a.push(k(.12,2,1,G,[-11.03,1.1,2.4])),this.add(L(Q(a,r,i,n,0)),this.paintMat).name=`lighthouse`;let s=L(Q([N(new C(1.8,1.8,2.6,t?8:12,1),G,{pos:[0,26.25,0]}),k(.1,1.2,1.2,G,[-11.03,1.8,-2]),k(.1,1.2,1.2,G,[-11.03,1.8,1])],r,i,n,0));this.add(s,this.glow).name=`lighthouse-lamp`,this.light=[r,i+24+2.3,n];let c=new C(26,.9,900,t?10:18,1,!0);c.rotateZ(Math.PI/2),c.translate(450,0,0);let l=new u(this.keep(c),this.beamMat);l.position.set(r,i+24+2.3,-n),l.frustumCulled=!1,l.renderOrder=5,l.name=`lighthouse-beam`,this.root.add(l),this.beam=l}harbour(t,n){let i=r(t),a=t.finishZ,o=[],s=[];for(let e=0,n=i.descent+70;n<i.harbour+40;e++){let r=5+Z(e,71)*2,i=7+Z(e,72)*4,a=Z(e,73)<.7?-1:1,c=a<0?5+Z(e,74)*3:Math.max(1.5,t.edgeLimit(n)+.3),l=t.centerX(n)+a*(t.halfWidth(n)+c+r/2),u=a<0?j(t,l,n):t.ground($(t,n)-.5,n),d=3.2+Z(e,75)*1.2,f=[];if(f.push(k(r,d,i,Z(e,76)<.5?rt:it,[0,d/2,0])),f.push(N(new C(0,r*.74,r*.55,4,1).rotateY(Math.PI/4),nt,{pos:[0,d+r*.27,0],scale:[1,1,i/r*1.02]})),f.push(N(new C(0,r*.59,r*.44,4,1).rotateY(Math.PI/4),F,{pos:[0,d+r*.325+.08,0],scale:[1,1,i/r*1.02]})),a>0)for(let e of[-i/2+.4,i/2-.4])for(let t of[-r/2+.3,r/2-.3])f.push(k(.25,18,.25,rt,[t,-9,e]));let p=-a*(r/2+.02);f.push(k(.06,2.2,1.6,new y(`#5A4A40`),[p,1.1,0]));let m=k(.06,.8,.9,G,[p,d-.8,i/4]);o.push(...Q(f,l,u,n,Math.PI/2*0)),s.push(...Q([m],l,u,n,0)),this.lamps.push([l-a*(r/2+1.5),u+2,n,11]),n+=i+2+Z(e,77)*9}let c=i.harbour+10,u=xt(t,c)+3,d=[];d.push(k(6,1.2,40,H,[0,-.6,0],[-.06,0,0])),d.push(k(.6,1.6,40,U,[3.2,-.2,0],[-.06,0,0])),o.push(...Q(d,u,t.ground($(t,c)-.5,c),c+20,0));let f=i.harbour-10,m=a+160,h=[],g=[],v=Math.ceil((m-f)/8);for(let e=0;e<=v;e++){let n=f+e*8,r=t.centerX(n),i=t.halfWidth(n),o=t.ground(r+i,n)+.03,s=n<a?i+14:i+30+10*Math.sin(n*.11)-(n-a)*.1;if(h.push(r+i-.6,o,-n,r+s,o,-n),e>0){let t=(e-1)*2,n=e*2;g.push(t,t+1,n,t+1,n+1,n)}}let b=new _;b.setAttribute(`position`,new l(new Float32Array(h),3)),b.setIndex(g),o.push(N(b,ft));let x=[],S=e=>t.edgeLimit(e)+.05,w=e=>{let n=t.centerX(e);return Math.max(t.ground(n,e)+1.2,t.ground(n-t.halfWidth(e)-t.edgeLimit(e),e)+.35)};for(let e of[-1,1]){let r=e>0?i.harbour+30:i.harbour+60,o=e>0?4.4:3;for(let i=r;i<a;i+=8){let r=t.centerX(i),a=t.halfWidth(i),s=t.ground(r,i),c=e>0?13:S(i+4),l=e>0?s+1.2:w(i+4),u=r+e*(a+c+o/2);x.push(k(o,l-s+2,8.2,i%16<8?H:U,[u,(l+s-2)/2,-(i+4)])),x.push(k(o-.2,.25,8,F,[u,l+.12,-(i+4)])),e<0&&!n&&x.push(N(new C(.22,.28,.7,6,1),W,{pos:[u+o*.3,l+.4,-(i+2)]}))}let c=t.centerX(a),l=t.ground(c,a),u=e>0?l+1.4:w(a)+.2,d=c+e*(t.halfWidth(a)+(e>0?13+o/2:S(a)+4.05));x.push(N(new C(3.6,4,u-l+1.6,12,1),U,{pos:[d,(u+l-1.6)/2,-a]})),x.push(N(new C(3.4,3.4,.25,12,1),F,{pos:[d,u+.05,-a]})),x.push(N(new C(1.1,1.5,8,10,1),et,{pos:[d,u+4.1,-a]})),x.push(N(new C(1.3,1.3,.3,10,1),W,{pos:[d,u+8.2,-a]})),x.push(N(new p(1.15,1,10,1),W,{pos:[d,u+9.9,-a]})),s.push(N(new C(.8,.8,1.3,8,1),G,{pos:[d,u+9,-a]})),this.lamps.push([d,u+9,a,18]),this.pierLamps.push([d,u+9,a])}o.push(...x);for(let e=0;e<(n?6:11);e++){let n=i.harbour+40+e*22+Z(e,81)*10;if(n>a-14)break;let r=t.centerX(n),s=r+t.halfWidth(n)+5.4+Z(e,82)*3.1999999999999993,c=t.ground(r,n)-.3,l=7+Z(e,83)*4,u=lt[e%lt.length],d=[];d.push(N(new C(1.4,.9,l,8,1),u,{pos:[0,.6,0],rot:[Math.PI/2,0,0],scale:[1,1,.55]})),d.push(N(new p(1.4,2.2,8,1),u,{pos:[0,.6,-l/2-1],rot:[-Math.PI/2,0,0],scale:[1,.55,1]})),d.push(k(2.5,.12,l+1,F,[0,1.36,-.4])),d.push(k(1.6,1.6,2,tt,[0,2.1,1])),d.push(k(1.8,.2,2.3,F,[0,3,1])),d.push(ne([0,1.4,-1.8],[0,6.8,-1.8],.07,W)),o.push(...Q(d,s,c,n,(Z(e,84)-.5)*.7+.15))}let T=t.halfWidth(a),E=[],D=1.1,te=Math.floor(T*2/D);for(let e=0;e<4;e++)for(let n=0;n<te;n++){let r=a+e*D,i=r+D,o=(e,n)=>{let r=t.centerX(n)-T+e;return[r,t.ground(r,n)+.04,-n]};E.push(A(o(n*D,r),o((n+1)*D,r),o((n+1)*D,i),o(n*D,i),(n+e)%2?dt:W))}let O=[];for(let e=0;e<(n?6:11);e++){let n=e%2,r=i.harbour-30+Math.floor(e/2)*44+n*20+Z(e,91)*10;if(r>a+70)break;let o=t.centerX(r),c=12+n*15+Z(e,92)*5,l=o-t.halfWidth(r)-c,u=j(t,l,r)-.3,d=6+Z(e,93)*2.5,f=5+Z(e,94)*2,p=4+Z(e,95)*2.2,m=Z(e,96)<.55?tt:Z(e,96)<.8?it:new y(`#C8B6A0`),h=[];h.push(k(f,p,d,m,[0,p/2,0])),h.push(N(new C(0,d*.68,d*.42,4,1).rotateY(Math.PI/4),nt,{pos:[0,p+d*.2,0],scale:[f/d*1.05,1,1.02]})),h.push(N(new C(0,d*.51,d*.315,4,1).rotateY(Math.PI/4),F,{pos:[0,p+d*.2525+.08,0],scale:[f/d*1.05,1,1.02]})),h.push(k(.7,1.8,.7,U,[.6,p+d*.3,d/2-.6])),h.push(k(.08,2,.95,new y(`#4A3E3A`),[f/2+.02,1,-d/4])),O.push(...Q(h,l,u,r,0)),s.push(...Q([k(.08,1,.9,G,[f/2+.03,p*.62,d/5]),k(.08,1,.9,G,[f/2+.03,p*.62,-d/2.6])],l,u,r,0)),this.lamps.push([l+f/2+2,u+2,r,10])}o.push(...O),this.add(L(o),this.paintMat,i.descent-60,a+260).name=`harbour`;let re=this.add(L(E),this.paintMat,a-300,a+260,!1);re.name=`finish-line`,this.add(L(s),this.glow,i.descent-60,a+260).name=`harbour-lights`;let ie=ae(`gullhaven`,e.None),{coats:M,hats:se}=oe(`gullhaven`,ie),P=[],I=0;for(let e=a-90;e<a+16;e+=3.1){if(I++,n&&I%2)continue;let r=t.centerX(e)-t.halfWidth(e)-S(e)-.6-Z(I,97)*1.6,i=Math.max(w(e),j(t,r,e))+.05;P.push({x:r,y:i,z:-(e+(Z(I,98)-.5)*1.2),face:1,coat:M[I%M.length],hat:se[I*3%se.length]})}if(P.length){let e=this.add(le(P,`gullhaven`,n?ee:1),this.mat,i.harbour,a+200);e.name=`onlookers`,e.castShadow=!1}}birds(e,t){let r=e=>{let t=t=>[t[0]*e,t[1],t[2]],n=t([.06,.02,.1]),r=t([.62,.16,.04]),i=t([.6,.15,-.16]),a=t([.06,.02,-.12]),o=t([1.22,.04,-.12]),s=t([1.18,.04,-.22]);return[A(n,r,i,a,pt),A(a,i,r,n,ut),A(r,o,s,i,mt),A(i,s,o,r,ut)]},i=L([N(new g(.1,0),ut,{scale:[1,.9,3.4]}),N(new g(.07,0),ut,{pos:[0,.04,.32]}),A([0,.01,-.26],[.09,0,-.44],[-.09,0,-.44],[0,.01,-.26],pt),...r(1),...r(-1)]),a=t?2:4,o=n(e),s=t?14:30,c=this.inst(i,o.length*a+s,this.mat);c.castShadow=!1;for(let t of o){let n=e.baseY(t.zL);for(let e=0;e<a;e++){let r=t.zL+10+e/a*t.column*.8+Z(t.index,e)*8;this.hang.push([t.bx+(Z(e,t.index+3)-.5)*5,n+9+Z(e,t.index+5)*14,r,Z(e,t.index+7)*6.28,this.hang.length])}}for(let t=0;t<s;t++){let n=150+t/s*(e.finishZ-200)+Z(t,91)*60,r=St(e,n,this.sea),i=$(e,n),a=e.baseY(n)-20-Z(t,92)*60;this.wheel.push([this.hang.length+t,(i+r)/2+30+Z(t,93)*60,a,n,18+Z(t,94)*30,.15+Z(t,95)*.12,Z(t,96)*6.28])}c.count=this.hang.length+this.wheel.length,c.frustumCulled=!1,c.name=`gulls`,this.gulls=c,this.place(0,-1e9),this.root.add(c)}place(e,t){let n=this.gulls;if(n){for(let[r,i,a,o,s]of this.hang){if(Math.abs(a-t)>500&&t>-1e8)continue;let c=Math.sin(e*1.3+o)*.12,l=new S().setFromAxisAngle(X,Math.PI/2+Math.sin(o)*.3).multiply(new S().setFromAxisAngle(new T(0,0,1),c));K.compose(J.set(r,i+Math.sin(e*.9+o)*.6,-a),l,Y.set(1.1,1.1,1.1)),n.setMatrixAt(s,K)}for(let[r,i,a,o,s,c,l]of this.wheel){if(Math.abs(o-t)>900&&t>-1e8)continue;let u=e*c+l,d=new S().setFromAxisAngle(X,-u).multiply(new S().setFromAxisAngle(new T(0,0,1),.35));K.compose(J.set(i+Math.cos(u)*s,a+Math.sin(u*2)*3,-(o+Math.sin(u)*s)),d,Y.set(1.2,1.2,1.2)),n.setMatrixAt(r,K)}n.instanceMatrix.needsUpdate=!0}}update(e,t,n,r,i,a,o){if(!this.course)return;let s=+!E(),c=this.detail===`low`;this.seaMesh.position.set(a.position.x,this.sea,a.position.z),this.seaMesh.updateMatrixWorld();let l=c?520:900;for(let e of this.windows)e.m.visible=r.z>e.z0-l&&r.z<e.z1+120;this.surfMat.uniforms.uFoam.value.copy(o.snowLit).lerp(o.fog,.25),this.surfMat.uniforms.uFoamShade.value.copy(o.snowShade).lerp(o.fog,.35),this.surfMat.uniforms.uLive.value=s*+!c,this.driftMat.uniforms.uLit.value.copy(o.snowLit).lerp(o.rim,.2),this.driftMat.uniforms.uShade.value.copy(o.snowShade).lerp(o.snowLit,.4),this.driftMat.uniforms.uLive.value=s,this.driftMat.uniforms.uScale.value=1500,this.smokeMat.uniforms.uLit.value.copy(o.clouds.lit).lerp(o.fog,.5),this.smokeMat.uniforms.uShade.value.copy(o.clouds.shade).lerp(o.fog,.55),this.smokeMat.uniforms.uLive.value=s,this.place(t*s,r.z);let u=ue.uLampK.value;this.beam&&(this.beam.rotation.set(0,t*s*.63,-.025),this.beamMat.uniforms.uK.value=.26*Math.max(0,Math.min(1,(u-.6)/.8)),this.beam.visible=this.beamMat.uniforms.uK.value>.004);let d=Math.max(0,Math.min(1.6,(u-.35)/.8));this.glow.uniforms.uEmissiveStrength.value=Math.max(.35*!!this.fire,Math.min(1.25,d*1.3)),this.fire&&Math.abs(this.fire[2]-r.z)<220&&ce(this.fire[0],this.fire[1],-this.fire[2],_t.r,_t.g,_t.b,22,.6*(.85+.15*Math.sin(t*9*s))),this.light&&Math.abs(this.light[2]-r.z)<400&&ce(this.light[0],this.light[1],-this.light[2],1,.97,.9,30,.3+.5*Math.min(1,u)),this.pieces.update(this.course,t,r,i,n===`run`,c,E(),u);let f=this.course;if(this.legends.update(f,t,e,r,i,n===`run`,c,E(),this.sea,e=>St(f,e,this.sea)),this.pierHalo){let e=this.pierLamps.some(e=>Math.abs(e[2]-r.z)<700);if(this.pierHalo.visible=e&&d>.02,this.pierHalo.visible){let e=Math.min(1,d)*(.85+.15*Math.sin(t*2.1*s));for(let t=0;t<this.pierLamps.length;t++)this.pierHalo.setColorAt(t,new y().copy(ht).multiplyScalar(e));this.pierHalo.instanceColor&&(this.pierHalo.instanceColor.needsUpdate=!0)}}if(!(d<=.02))for(let[e,t,n,i]of this.lamps)n>r.z-30&&n<r.z+160&&ce(e,t,-n,gt.r,gt.g,gt.b,i,.5*Math.min(1,d))}},jt=(e,t,n)=>{let r=n<=e?0:n>=t?1:(n-e)/(t-e);return r*r*(3-2*r)};function Mt(e,t,n,r){return e.applyMatrix4(new h().makeTranslation(t,n,-r)),e}function Nt(e){let t=new _;t.setAttribute(`position`,new l(new Float32Array([0,0,0,.95,.16,0,0,.36,0,0,0,0,0,.36,0,.95,.16,0]),3)),t.setAttribute(`aSway`,new l(new Float32Array([0,1,0,0,0,1]),1));let n=new Float32Array(18);for(let t=0;t<6;t++)n.set([e.r,e.g,e.b],t*3);return t.setAttribute(`color`,new l(n,3)),t.computeVertexNormals(),t}export{At as GullhavenWorld};