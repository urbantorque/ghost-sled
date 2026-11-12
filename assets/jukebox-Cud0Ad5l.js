import{i as e}from"./chaos-Bfeh7OYa.js";import{H as t,d as n}from"./index-DJ9BgbMf.js";var r=[{biome:`alpine`,name:`Pinecrest`},{biome:`glacier`,name:`Frostfang`},{biome:`volcanic`,name:`Ember Peak`},{biome:`blossom`,name:`Sakura Ridge`}],i=[{mood:e.None,name:`Clear Skies`},{mood:e.Blizzard,name:`Blizzard`},{mood:e.Lantern,name:`Lantern Night`},{mood:e.GlassIce,name:`Glass Ice`},{mood:e.Comet,name:`Comet Night`},{mood:e.Haunted,name:`Haunted Hollow`},{mood:e.Powder,name:`Powder Day`}],a=[{s:`intro`,name:`Intro`},{s:`verse`,name:`Verse`},{s:`chorus`,name:`Chorus (hook)`},{s:`bridge`,name:`Bridge`}],o=`
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
`;function s(e,n){return{speed:22,grounded:!0,carve:.3,drifting:!1,slip:0,onIce:!1,boostGlow:0,drafting:!1,comboChain:0,comboMult:1,intensity:Math.min(1,e+t(n,0)),danger:0,crashed:!1}}var c=e=>({tick:0,...e});function l(t){let l=t.audio;if(!l||document.querySelector(`.gs-jb`))return;let u=document.createElement(`style`);u.textContent=o,document.head.appendChild(u);let d=`alpine`,f=e.None,p=0,m=.36,h=`idle`,g=0,_=!1,v=0,y=document.createElement(`section`);y.className=`gs-jb`,y.setAttribute(`aria-label`,`Jukebox`),y.innerHTML=`
    <div class="top"><div><h2>Jukebox</h2><p>The score on demand. Debug builds only.</p></div>
      <button type="button" data-act="fold" aria-expanded="true">Hide</button></div>
    <div class="body">
      <h3>Title</h3>
      <div class="row"><button type="button" class="primary" data-act="title">Main Theme</button>
        <button type="button" data-act="results">Results Reprise</button>
        <button type="button" data-act="stop">Silence the Band</button></div>
      <h3>Mountain</h3>
      <div class="row" data-group="biome">${r.map(e=>`<button type="button" data-biome="${e.biome}" aria-pressed="${e.biome===d}">${e.name}</button>`).join(``)}</div>
      <label>Mood<select name="mood" autocomplete="off" data-act="mood">${i.map(e=>`<option value="${e.mood}">${e.name}</option>`).join(``)}</select></label>
      <h3>Stage</h3>
      <div class="row" data-group="stage">${[0,1,2].map(e=>`<button type="button" data-stage="${e}" aria-pressed="${e===p}">Stage ${e+1}</button>`).join(``)}</div>
      <h3>Run Music by Section</h3>
      <div class="row">${a.map(e=>`<button type="button" data-sec="${e.s}">${e.name}</button>`).join(``)}
        <button type="button" data-act="flow">Let It Flow</button></div>
      <h3>Landings</h3>
      <div class="row"><button type="button" data-land="drop">Build into a Drop</button>
        <button type="button" data-land="lift">Lift a Key</button>
        <button type="button" data-land="finish">Finish Line</button>
        <button type="button" data-act="breakdown">Break Down</button></div>
      <label>Drive <span data-out="drive">0.36</span><input type="range" name="drive" min="0" max="1" step="0.01" value="0.36" data-act="drive"></label>
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
      <h3>Cues in the Score</h3>
      <div class="row"><button type="button" data-cue="lantern">Lantern Lit</button>
        <button type="button" data-cue="dash">Dash</button>
        <button type="button" data-cue="ward">Ward</button>
        <button type="button" data-cue="gate">Sky Gate</button>
        <button type="button" data-cue="pass">Pass</button>
        <button type="button" data-cue="stage">Stage Line</button></div>
      <label>Sled Sound<select name="sled" autocomplete="off" data-act="sled">${n.map(e=>`<option value="${e.id}">${e.name}</option>`).join(``)}</select></label>
      <div class="now" aria-live="off" data-out="now">Press a button to start the audio.</div>
    </div>`,document.body.appendChild(y);let b=e=>y.querySelector(e),x=(e,t,n)=>{for(let r of y.querySelectorAll(`[data-group="${e}"] button`))r.setAttribute(`aria-pressed`,String(r.getAttribute(t)===n))},S=()=>{if(l.unlock(),h!==`run`&&(l.setScene(`run`),l.setMood(f,d),h=`run`),l.debugMusic({stage:p}),!g){v=performance.now();let e=t=>{let n=Math.min(.1,(t-v)/1e3);v=t,h===`run`&&l.update(s(m,p),n),g=requestAnimationFrame(e)};g=requestAnimationFrame(e)}},C=(e,t=[])=>{l.beats(e);for(let e of t)l.simEvent(e)},w=(e,t)=>void window.setTimeout(t,e),T=(e,t,n=1,r=1)=>c({type:`moment`,key:`jukebox`,verb:e,phase:t,n,of:r});y.addEventListener(`click`,t=>{let n=t.target.closest(`button`);if(!n)return;let r=n.dataset.act;if(r===`fold`){let e=y.classList.toggle(`closed`);n.textContent=e?`Show Jukebox`:`Hide`,n.setAttribute(`aria-expanded`,String(!e));return}if(r===`title`){l.unlock(),l.debugMusic(null),l.setScene(`title`),l.setMood(e.None,d),h=`title`;return}if(r===`results`){l.unlock(),l.debugMusic(null),l.setScene(`results`),l.setMood(f,d),h=`results`;return}if(r===`stop`){l.setVolumes({master:1,music:0,sfx:.8}),_=!0;return}if(_&&(l.setVolumes({master:1,music:.8,sfx:.8}),_=!1),n.dataset.biome){d=n.dataset.biome,x(`biome`,`data-biome`,d),h===`run`?l.setMood(f,d):h===`title`&&l.setMood(e.None,d);return}if(n.dataset.stage){p=Number(n.dataset.stage),x(`stage`,`data-stage`,String(p)),h===`run`&&l.debugMusic({stage:p});return}if(n.dataset.sec){S(),l.debugMusic({stage:p,section:n.dataset.sec});return}if(r===`flow`){S(),l.debugMusic({stage:p});return}if(n.dataset.land){S(),l.debugMusic({stage:p});let e=n.dataset.land,t=l.debugLand(e===`finish`?3.6:2.4,e);if(e===`finish`&&t!==null){let e=l.debugTap()?.ctx,n=e?Math.max(0,(t-e.currentTime-.05)*1e3):3500;w(n,()=>C([c({type:`finish`,bonus:0,seconds:120,rank:1,of:6})]))}return}if(r===`breakdown`){S(),C([c({type:`crash`})]);return}let i=n.dataset.cue;if(i)switch(S(),i){case`enter`:C([c({type:`marquee`,phase:`enter`,key:`jukebox`,name:`The Jukebox`,verb:`gates`,line:``,cam:`low`,light:null,side:1,took:0,total:0,clean:!0,won:!1})]);break;case`gates`:for(let e=1;e<=6;e++)w((e-1)*1e3,()=>C([T(`gates`,`step`,e,6)]));break;case`rings`:for(let e=1;e<=3;e++)w((e-1)*450,()=>C([T(`rings`,`step`,e,3)]));break;case`steps`:for(let e=1;e<=4;e++)w((e-1)*2e3,()=>C([T(`steps`,`step`,e,4)]));break;case`miss`:C([T(`gates`,`miss`,0,6)]);break;case`lead`:case`trail`:C([T(`race`,i)]);break;case`close`:C([T(`collapse`,`close`)]);break;case`won`:case`lost`:C([T(`gates`,i,6,6)]);break;case`lantern`:C([],[{type:`lantern`,phase:`lit`,cells:2}]);break;case`dash`:C([],[{type:`dash`,phase:`start`,cells:1}]),w(1600,()=>C([],[{type:`dash`,phase:`end`,cells:1}]));break;case`ward`:C([],[{type:`ward`,cause:`tree`,cells:0}]);break;case`gate`:C([],[{type:`skyGate`,id:1,stage:0}]);break;case`pass`:C([c({type:`pass`,ghost:{id:7,name:`Jukebox`,kind:`pool`,dx:1.5},word:`passed`,text:``,first:!1,chain:1,ladder:2,octave:!1,gifts:0,muted:!1})]);break;case`stage`:C([c({type:`stage`,index:0,name:`Stage line`,last:!1,seconds:40,vsGhost:null,vsBest:null})])}}),y.addEventListener(`input`,e=>{let t=e.target;if(t.dataset.act===`drive`){m=Number(t.value);let e=b(`[data-out="drive"]`);e&&(e.textContent=m.toFixed(2))}else t.dataset.act===`mood`?(f=Number(t.value),(h===`run`||h===`results`)&&l.setMood(f,d)):t.dataset.act===`sled`&&l.setSledSound(t.value)});let E=[`Intro`,`Verse`,`Chorus`,`Bridge`,`Finale`],D=[`C`,`Db`,`D`,`Eb`,`E`,`F`,`F#`,`G`,`Ab`,`A`,`Bb`,`B`];window.setInterval(()=>{let e=b(`[data-out="now"]`);if(!e||y.classList.contains(`closed`))return;let t=l.debugLevels();if(!t.running)return;let n=l.core?.music.key(),r=E[t.section]??``,i=t.landingIn>=0?`, drop in ${t.landingIn.toFixed(1)} s`:``,a=`${h===`idle`?`Title screen`:h[0].toUpperCase()+h.slice(1)}: ${r} bar ${t.bar+1} of ${t.cycleBars}${i}. ${n?`${D[n.tonic%12]}, ${n.bpm} bpm`:``}. Drive ${t.drive.toFixed(2)}${_?`, band silenced`:``}.`;e.textContent!==a&&(e.textContent=a)},250)}export{l as openJukebox};