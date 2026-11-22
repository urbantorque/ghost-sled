import{i as e}from"./chaos-DKRDCDPw.js";import{C as t,pt as n,rt as r}from"./index-B-4LZ7ba.js";var i=[{biome:`alpine`,name:`Pinecrest`,course:`pinecrest`},{biome:`glacier`,name:`Frostfang`,course:`frostfang`},{biome:`volcanic`,name:`Ember Peak`,course:`ember`},{biome:`blossom`,name:`Sakura Ridge`,course:`sakura`},{biome:`lantern`,name:`Lanternfall`,course:`lanternfall`}],a=[{id:`intro`,name:`Intro`},{id:`a`,name:`A: Verse`},{id:`b`,name:`B: Chorus (hook)`},{id:`c`,name:`C: Second Verse`},{id:`d`,name:`D: Stage Two`},{id:`bd`,name:`Breakdown`},{id:`b2`,name:`B2: Last-Stage Chorus`},{id:`c2`,name:`C2: The Climb`}],o=[`race`,`gates`,`rings`,`collapse`,`steps`,`slide`,`shatter`,`surge`,`flourish`,`follow`,`kindle`,`carry`,`any`],s=e=>e[0].toUpperCase()+e.slice(1),c=[{mood:e.None,name:`Clear Skies`},{mood:e.Blizzard,name:`Blizzard`},{mood:e.Lantern,name:`Lantern Night`},{mood:e.GlassIce,name:`Glass Ice`},{mood:e.Comet,name:`Comet Night`},{mood:e.Haunted,name:`Haunted Hollow`},{mood:e.Powder,name:`Powder Day`}],l=[{s:`intro`,name:`Intro`},{s:`verse`,name:`Verse`},{s:`chorus`,name:`Chorus (hook)`},{s:`bridge`,name:`Bridge`}],u=`
.gs-jb { position: fixed; top: max(12px, env(safe-area-inset-top)); right: max(12px, env(safe-area-inset-right)); color-scheme: dark; z-index: 2147483000; width: min(380px, calc(100vw - 24px));
  max-height: calc(100dvh - 24px); overflow: auto; overscroll-behavior: contain; box-sizing: border-box;
  padding: 14px 14px 16px; border-radius: 18px; background: rgb(18 25 51 / 0.86);
  box-shadow: inset 0 0 0 1px rgb(245 243 255 / 0.14); color: #F5F3FF;
  font: 600 13px/1.35 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; font-variant-numeric: tabular-nums; }
.gs-jb h2 { margin: 0 0 2px; font-size: 15px; font-weight: 900; letter-spacing: 0.01em; text-wrap: balance; }
.gs-jb h3 { margin: 14px 0 6px; font-size: 13px; font-weight: 800; text-wrap: balance; }
.gs-jb p { margin: 0; color: rgb(245 243 255 / 0.72); font-weight: 600; }
.gs-jb .row { display: flex; flex-wrap: wrap; gap: 6px; }
.gs-jb button { appearance: none; border: 0; border-radius: 999px; padding: 6px 11px; min-height: 30px;
  background: transparent; color: #F5F3FF; box-shadow: inset 0 0 0 1px rgb(245 243 255 / 0.28);
  font: inherit; font-weight: 800; cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
.gs-jb button:active { transform: translateY(1px); }
.gs-jb button:hover { box-shadow: inset 0 0 0 1px rgb(245 243 255 / 0.6); }
.gs-jb button:focus-visible { outline: 2px solid #F5F3FF; outline-offset: 2px; }
.gs-jb button[aria-pressed='true'] { background: #F5F3FF; color: #121933; box-shadow: none; }
.gs-jb button.primary { background: #FF4D2E; color: #121933; box-shadow: none; }
.gs-jb .top { display: flex; align-items: start; justify-content: space-between; gap: 8px; }
.gs-jb label { display: grid; gap: 4px; margin-top: 10px; font-weight: 800; }
.gs-jb input[type=range] { width: 100%; accent-color: #F5F3FF; }
.gs-jb select { font: inherit; font-weight: 700; color: #F5F3FF; background: #121933; border-radius: 999px;
  border: 1px solid rgb(245 243 255 / 0.28); padding: 5px 10px; min-height: 30px; }
.gs-jb .now { margin-top: 10px; padding: 8px 10px; border-radius: 18px; background: rgb(245 243 255 / 0.06);
  color: rgb(245 243 255 / 0.86); min-height: 2.7em; }
.gs-jb.closed { width: auto; padding: 6px; }
.gs-jb.closed .body { display: none; }
`;function d(e,t){return{speed:22,grounded:!0,carve:.3,drifting:!1,slip:0,onIce:!1,boostGlow:0,drafting:!1,comboChain:0,comboMult:1,intensity:Math.min(1,e+n(t,0)),danger:0,crashed:!1}}var f=e=>({tick:0,...e});function p(n){let p=n.audio;if(!p||document.querySelector(`.gs-jb`))return;let m=document.createElement(`style`);m.textContent=u,document.head.appendChild(m);let h=`alpine`,g=`pinecrest`,_=e.None,v=0,y=.36,b=`idle`,x=0,S=!1,C=0,w=document.createElement(`section`);w.className=`gs-jb`,w.setAttribute(`aria-label`,`Jukebox`),w.innerHTML=`
    <div class="top"><div><h2>Jukebox</h2><p>The score on demand. Debug builds only.</p></div>
      <button type="button" data-act="fold" aria-expanded="true">Hide</button></div>
    <div class="body">
      <h3>Title</h3>
      <div class="row"><button type="button" class="primary" data-act="title">Main Theme</button>
        <button type="button" data-act="results">Results Reprise</button>
        <button type="button" data-act="stop">Silence the Band</button></div>
      <h3>Mountain</h3>
      <div class="row" data-group="biome">${i.map(e=>`<button type="button" data-course="${e.course}" aria-pressed="${e.course===g}">${e.name}</button>`).join(``)}</div>
      <label>Mood<select name="mood" autocomplete="off" data-act="mood">${c.map(e=>`<option value="${e.mood}">${e.name}</option>`).join(``)}</select></label>
      <h3>Stage</h3>
      <div class="row" data-group="stage">${[0,1,2].map(e=>`<button type="button" data-stage="${e}" aria-pressed="${e===v}">Stage ${e+1}</button>`).join(``)}</div>
      <h3>Run Music by Section</h3>
      <div class="row">${l.map(e=>`<button type="button" data-sec="${e.s}">${e.name}</button>`).join(``)}
        <button type="button" data-act="flow">Let It Flow</button></div>
      <h3>Produced Score by Section</h3>
      <div class="row">${a.map(e=>`<button type="button" data-pid="${e.id}">${e.name}</button>`).join(``)}</div>
      <div class="row" style="margin-top:6px"><button type="button" data-band="produced" aria-pressed="true">Produced Score</button>
        <button type="button" data-band="live" aria-pressed="false">Live Band</button></div>
      <h3>Landings</h3>
      <div class="row"><button type="button" data-land="drop">Build into a Drop</button>
        <button type="button" data-land="lift">Lift a Key</button>
        <button type="button" data-land="finish">Finish Line</button>
        <button type="button" data-act="breakdown">Break Down</button>
        <button type="button" data-act="breath">Breath and Crash Back</button></div>
      <label>Drive <span data-out="drive">0.36</span><input type="range" name="drive" min="0" max="1" step="0.01" value="0.36" data-act="drive"></label>
      <h3>Stingers (One per Set-Piece Verb)</h3>
      <div class="row">${o.map(e=>`<button type="button" data-st="${e}">${s(e)}</button>`).join(``)}</div>
      <h3>Rider Motifs</h3>
      <div class="row">${Object.keys(r).map(e=>`<button type="button" data-rider="${e}">${s(e)}</button>`).join(``)}</div>
      <h3>Set Pieces</h3>
      <div class="row"><button type="button" data-cue="enter">Card Call</button>
        <button type="button" data-cue="gates">Gates</button>
        <button type="button" data-cue="rings">Rings</button>
        <button type="button" data-cue="steps">Steps</button>
        <button type="button" data-cue="miss">A Miss</button>
        <button type="button" data-cue="lead">Race Lead</button>
        <button type="button" data-cue="trail">Race Trail</button>
        <button type="button" data-cue="close">Collapse Closing</button>
        <button type="button" data-cue="won">Won</button>
        <button type="button" data-cue="lost">Lost</button></div>
      <h3>Set-Piece Steps</h3>
      <div class="row"><button type="button" data-cue="shatter">Bells Swing</button>
        <button type="button" data-cue="roar">Forge Roars</button>
        <button type="button" data-cue="gutter">Forge Gutters</button>
        <button type="button" data-cue="slide">Glass Sings</button>
        <button type="button" data-cue="kindle">Lamps Catch</button>
        <button type="button" data-cue="follow">The Wake Fills</button>
        <button type="button" data-cue="wake">Back in the Wake</button>
        <button type="button" data-cue="low">Flame Low</button>
        <button type="button" data-cue="gutterFlame">Flame Gutters</button>
        <button type="button" data-cue="catch">Flame Catches</button>
        <button type="button" data-cue="brazier">Brazier Takes</button></div>
      <h3>Legends and the Hero Frame</h3>
      <div class="row"><button type="button" data-cue="legend">A Legend Comes and Goes</button>
        <button type="button" data-cue="ribbon">A Ribbon's Quarters</button>
        <button type="button" data-cue="hero">The Hero Frame</button></div>
      <h3>Cues in the Score</h3>
      <div class="row"><button type="button" data-cue="lantern">Lantern Lit</button>
        <button type="button" data-cue="dash">Dash</button>
        <button type="button" data-cue="ward">Ward</button>
        <button type="button" data-cue="gate">Sky Gate</button>
        <button type="button" data-cue="pass">Pass</button>
        <button type="button" data-cue="stage">Stage Line</button></div>
      <label>Sled Sound<select name="sled" autocomplete="off" data-act="sled">${t.map(e=>`<option value="${e.id}">${e.name}</option>`).join(``)}</select></label>
      <div class="now" aria-live="off" data-out="now">Press a button to start the audio.</div>
    </div>`,document.body.appendChild(w);let T=e=>w.querySelector(e),E=(e,t,n)=>{for(let r of w.querySelectorAll(`[data-group="${e}"] button`))r.setAttribute(`aria-pressed`,String(r.getAttribute(t)===n))},D=()=>{if(p.unlock(),b!==`run`&&(p.setScene(`run`),p.setMood(_,h,g),b=`run`),p.debugMusic({stage:v}),!x){C=performance.now();let e=t=>{let n=Math.min(.1,(t-C)/1e3);C=t,b===`run`&&p.update(d(y,v),n),x=requestAnimationFrame(e)};x=requestAnimationFrame(e)}},O=(e,t=[])=>{p.beats(e);for(let e of t)p.simEvent(e)},k=(e,t)=>void window.setTimeout(t,e),A=(e,t,n=1,r=1)=>f({type:`moment`,key:`jukebox`,verb:e,phase:t,n,of:r});w.addEventListener(`click`,t=>{let n=t.target.closest(`button`);if(!n)return;let r=n.dataset.act;if(r===`fold`){let e=w.classList.toggle(`closed`);n.textContent=e?`Show Jukebox`:`Hide`,n.setAttribute(`aria-expanded`,String(!e));return}if(r===`title`){p.unlock(),p.debugMusic(null),p.setScene(`title`),p.setMood(e.None,h,g),b=`title`;return}if(r===`results`){p.unlock(),p.debugMusic(null),p.setScene(`results`),p.setMood(_,h,g),b=`results`;return}if(r===`stop`){p.setVolumes({master:1,music:0,sfx:.8}),S=!0;return}if(S&&(p.setVolumes({master:1,music:.8,sfx:.8}),S=!1),n.dataset.course){g=n.dataset.course,h=i.find(e=>e.course===g)?.biome??`alpine`,E(`biome`,`data-course`,g),b===`run`?p.setMood(_,h,g):b===`title`&&p.setMood(e.None,h,g);return}if(n.dataset.stage){v=Number(n.dataset.stage),E(`stage`,`data-stage`,String(v)),b===`run`&&p.debugMusic({stage:v});return}if(n.dataset.sec){D(),p.debugMusic({stage:v,section:n.dataset.sec});return}if(r===`flow`){D(),p.debugMusic({stage:v});return}if(n.dataset.land){D(),p.debugMusic({stage:v});let e=n.dataset.land,t=p.debugLand(e===`finish`?3.6:2.4,e);if(e===`finish`&&t!==null){let e=p.debugTap()?.ctx,n=e?Math.max(0,(t-e.currentTime-.05)*1e3):3500;k(n,()=>O([f({type:`finish`,bonus:0,seconds:120,rank:1,of:6})]))}return}if(n.dataset.pid){D(),p.debugMusic({stage:v,id:n.dataset.pid});return}if(n.dataset.band){p.unlock(),p.debugProduced(n.dataset.band===`produced`);for(let e of w.querySelectorAll(`[data-band]`))e.setAttribute(`aria-pressed`,String(e===n));return}if(r===`breath`){D(),p.debugMusic({stage:v}),p.debugBreath(1.4);return}if(n.dataset.st){D(),O([f({type:`marquee`,phase:`enter`,key:`jukebox`,name:`The Jukebox`,verb:n.dataset.st,line:``,cam:`low`,light:null,side:1,took:0,total:0,clean:!0,won:!1})]);return}if(n.dataset.rider){D(),p.debugMotif(n.dataset.rider);return}if(r===`breakdown`){D(),O([f({type:`crash`})]);return}let a=n.dataset.cue;if(a)switch(D(),a){case`enter`:O([f({type:`marquee`,phase:`enter`,key:`jukebox`,name:`The Jukebox`,verb:`gates`,line:``,cam:`low`,light:null,side:1,took:0,total:0,clean:!0,won:!1})]);break;case`gates`:for(let e=1;e<=6;e++)k((e-1)*1e3,()=>O([A(`gates`,`step`,e,6)]));break;case`rings`:for(let e=1;e<=3;e++)k((e-1)*450,()=>O([A(`rings`,`step`,e,3)]));break;case`steps`:for(let e=1;e<=4;e++)k((e-1)*2e3,()=>O([A(`steps`,`step`,e,4)]));break;case`miss`:O([A(`gates`,`miss`,0,6)]);break;case`lead`:case`trail`:O([A(`race`,a)]);break;case`close`:O([A(`collapse`,`close`)]);break;case`won`:case`lost`:O([A(`gates`,a,6,6)]);break;case`shatter`:for(let e=1;e<=3;e++)k((e-1)*1500,()=>O([A(`shatter`,`step`,e,3)]));break;case`roar`:O([A(`surge`,`step`,47,44)]);break;case`gutter`:O([A(`surge`,`step`,34,44)]);break;case`slide`:for(let e=1;e<=4;e++)k((e-1)*700,()=>O([A(`slide`,`step`,e,4)]));break;case`kindle`:for(let e=1;e<=6;e++)k((e-1)*650,()=>O([A(`kindle`,`step`,e,6)]));break;case`follow`:for(let e=1;e<=8;e++)k((e-1)*550,()=>O([A(`follow`,`step`,e,8)]));break;case`wake`:O([A(`follow`,`lead`)]);break;case`low`:for(let e=3;e>=1;e--)k((3-e)*1400,()=>O([A(`carry`,`step`,e,10)]));break;case`gutterFlame`:O([A(`carry`,`trail`)]);break;case`catch`:O([A(`carry`,`lead`)]);break;case`brazier`:O([A(`carry`,`close`)]);break;case`legend`:{let e=(e,t=0)=>f({type:`legend`,phase:e,key:`jukebox`,name:`The Jukebox`,line:``,kind:`sky`,side:1,n:t});O([e(`warn`)]),k(2600,()=>O([e(`start`)])),k(8200,()=>O([e(`end`)]));break}case`ribbon`:for(let e=1;e<=4;e++)k((e-1)*1300,()=>O([f({type:`legend`,phase:`step`,key:`jukebox`,name:`The Jukebox`,line:``,kind:`ribbon`,side:-1,n:e})]));break;case`hero`:O([f({type:`heroFrame`,phase:`lip`,key:`jukebox`,inS:1,secs:1.6})]),k(1e3,()=>O([f({type:`heroFrame`,phase:`apex`,key:`jukebox`,inS:0,secs:1.6})])),k(2600,()=>O([f({type:`heroFrame`,phase:`out`,key:`jukebox`,inS:0,secs:1.6})],[{type:`land`,quality:`perfect`,airtime:2.6,halfTurns:0,flips:0,impact:.4,late:!1}]));break;case`lantern`:O([],[{type:`lantern`,phase:`lit`,cells:2}]);break;case`dash`:O([],[{type:`dash`,phase:`start`,cells:1}]),k(1600,()=>O([],[{type:`dash`,phase:`end`,cells:1}]));break;case`ward`:O([],[{type:`ward`,cause:`tree`,cells:0}]);break;case`gate`:O([],[{type:`skyGate`,id:1,stage:0}]);break;case`pass`:O([f({type:`pass`,ghost:{id:7,name:`Jukebox`,kind:`pool`,dx:1.5},word:`passed`,text:``,first:!1,chain:1,ladder:2,octave:!1,gifts:0,muted:!1})]);break;case`stage`:O([f({type:`stage`,index:0,name:`Stage line`,last:!1,seconds:40,vsGhost:null,vsBest:null})])}}),w.addEventListener(`input`,e=>{let t=e.target;if(t.dataset.act===`drive`){y=Number(t.value);let e=T(`[data-out="drive"]`);e&&(e.textContent=y.toFixed(2))}else t.dataset.act===`mood`?(_=Number(t.value),(b===`run`||b===`results`)&&p.setMood(_,h,g)):t.dataset.act===`sled`&&p.setSledSound(t.value)});let j=[`Intro`,`Verse`,`Chorus`,`Bridge`,`Finale`],M=[`C`,`Db`,`D`,`Eb`,`E`,`F`,`F#`,`G`,`Ab`,`A`,`Bb`,`B`];window.setInterval(()=>{let e=T(`[data-out="now"]`);if(!e||w.classList.contains(`closed`))return;let t=p.debugLevels();if(!t.running)return;let n=p.core?.music.key(),r=j[t.section]??``,i=t.landingIn>=0?`, drop in ${t.landingIn.toFixed(1)} s`:``,a=p.debugStems(),o=`${a?.produced?`Produced score (${a.tier} pack, ${a.format}), section ${a.section}. `:a?`Live band (the produced score is not loaded, or is switched off). `:`Live band. `}${b===`idle`?`Title screen`:b[0].toUpperCase()+b.slice(1)}: ${r} bar ${t.bar+1} of ${t.cycleBars}${i}. ${n?`${M[n.tonic%12]}, ${n.bpm} bpm`:``}. Drive ${t.drive.toFixed(2)}${S?`, band silenced`:``}.`;e.textContent!==o&&(e.textContent=o)},250)}export{p as openJukebox};