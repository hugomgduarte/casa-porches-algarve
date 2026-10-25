/* Casa Porches — código partilhado do Guia do Hóspede e do Explorar o Algarve */
window.startGuide=function(){
  var HOME=[37.125046,-8.399062];
  var CATS={beach:{c:'#2a9fd6',i:'🏖️'},food:{c:'#d9822b',i:'🍽️'},fun:{c:'#7b5bd6',i:'🎢'},see:{c:'#3c9a5f',i:'📍'},help:{c:'#c0392b',i:'🏥'},fest:{c:'#c2185b',i:'🎉'},shop:{c:'#5d6d7e',i:'🛒'}};
  var EVMAP={events:'fest',markets:'fest',water:'fun',indoor:'fun',nature:'see',sea:'see',outdoor:'fun',cities:'see'};
  var codes=LANGS.map(function(l){return l.code});
  var cur='en', T=TXT.en;
  function get(path){return path.split('.').reduce(function(o,k){return o&&o[k]},T)}
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function gmaps(q){return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(q)}
  function dir(p){return 'https://www.google.com/maps/dir/?api=1&origin='+HOME.join(',')+'&destination='+(p.lat!=null?p.lat+','+p.lng:encodeURIComponent(p.q))}

  if(document.getElementById('ssid')){document.getElementById('ssid').textContent=WIFI.ssid;document.getElementById('pwd').textContent=WIFI.password;}

  var FLAGS={
    pt:'<svg viewBox="0 0 30 20"><rect width="12" height="20" fill="#046a38"/><rect x="12" width="18" height="20" fill="#da291c"/><circle cx="12" cy="10" r="4.2" fill="#ffe900"/><circle cx="12" cy="10" r="2.4" fill="#da291c"/></svg>',
    en:'<svg viewBox="0 0 60 40"><rect width="60" height="40" fill="#012169"/><path d="M0,0 60,40M60,0 0,40" stroke="#fff" stroke-width="8"/><path d="M0,0 60,40M60,0 0,40" stroke="#c8102e" stroke-width="3"/><path d="M30,0V40M0,20H60" stroke="#fff" stroke-width="12"/><path d="M30,0V40M0,20H60" stroke="#c8102e" stroke-width="7"/></svg>',
    es:'<svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#aa151b"/><rect y="5" width="30" height="10" fill="#f1bf00"/></svg>',
    fr:'<svg viewBox="0 0 30 20"><rect width="10" height="20" fill="#002654"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#ce1126"/></svg>',
    de:'<svg viewBox="0 0 30 20"><rect width="30" height="7" fill="#000"/><rect y="6.6" width="30" height="7" fill="#dd0000"/><rect y="13.3" width="30" height="6.7" fill="#ffce00"/></svg>',
    it:'<svg viewBox="0 0 30 20"><rect width="10" height="20" fill="#009246"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#ce2b37"/></svg>'
  };
  var lbtn=document.getElementById('langBtn'), lmenu=document.getElementById('langMenu');
  function lclose(){lmenu.classList.remove('open');lbtn.setAttribute('aria-expanded','false')}
  LANGS.forEach(function(l){var b=document.createElement('button');b.dataset.set=l.code;b.innerHTML=(FLAGS[l.code]||'')+'<span>'+l.name+'</span>';b.onclick=function(){setLang(l.code);lclose()};lmenu.appendChild(b)});
  lbtn.onclick=function(e){e.stopPropagation();lbtn.setAttribute('aria-expanded',lmenu.classList.toggle('open'))};
  document.addEventListener('click',function(e){if(!document.getElementById('langDD').contains(e.target))lclose()});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')lclose()});

  /* ---- map ---- */
  var touch=('ontouchstart' in window)||navigator.maxTouchPoints>0;
  var map=null, layers={}, markers=[], home=null, hidden={};
  if(window.L && document.getElementById('leafmap')){
    map=L.map('leafmap',{scrollWheelZoom:false,dragging:!touch,tap:true}).setView(HOME,12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; OpenStreetMap'}).addTo(map);
    var icon=function(cls,bg,txt){return L.divIcon({className:'',html:'<div class="pin '+cls+'" style="background:'+bg+'">'+txt+'</div>',iconSize:cls?[40,40]:[30,30],iconAnchor:cls?[20,20]:[15,15],popupAnchor:[0,-14]})};
    home=L.marker(HOME,{icon:icon('home','','🏠'),zIndexOffset:1000}).addTo(map);
    Object.keys(CATS).forEach(function(k){layers[k]=L.layerGroup().addTo(map)});
    /* pontos: praias/locais (folha Mapa) + restaurantes + eventos com coordenadas; locais iguais juntam-se num só ponto */
    var all=[];
    PLACES.forEach(function(p){ if(p.lat!=null) all.push({cat:p.cat,o:p}) });
    (window.RESTAURANTS||[]).forEach(function(r){ if(r.lat!=null) all.push({cat:'food',o:r,price:r.price}) });
    (window.EVENTS||[]).forEach(function(e){ if(e.lat!=null) all.push({cat:EVMAP[e.cat]||'see',o:e}) });
    var groups={};
    all.forEach(function(x){var k=x.cat+'|'+x.o.lat.toFixed(4)+','+x.o.lng.toFixed(4);(groups[k]=groups[k]||[]).push(x)});
    /* pontos mesmo ao lado da casa: desenhados à volta da casa para não ficarem escondidos */
    var nearKeys=Object.keys(groups).filter(function(k){var o=groups[k][0].o;return Math.abs(o.lat-HOME[0])<0.004&&Math.abs(o.lng-HOME[1])<0.004});
    Object.keys(groups).forEach(function(k){var g=groups[k],c=g[0].cat,o=g[0].o,txt=(g.length===1&&o.icon)?o.icon:CATS[c].i;
      var ni=nearKeys.indexOf(k), ic;
      if(ni>=0){var a=-Math.PI/2+ni*2*Math.PI/nearKeys.length, dx=Math.round(34*Math.cos(a)), dy=Math.round(34*Math.sin(a));
        ic=L.divIcon({className:'',html:'<div class="pin" style="background:'+CATS[c].c+'">'+txt+'</div>',iconSize:[30,30],iconAnchor:[15-dx,15-dy],popupAnchor:[dx,dy-14]});}
      else ic=icon('',CATS[c].c,txt);
      var m=L.marker([o.lat,o.lng],{icon:ic}).addTo(layers[c]); m._g=g; markers.push(m)});
    var pts=[HOME].concat(all.filter(function(x){return x.cat!=='help'&&x.o.lat<37.17&&x.o.lng>-8.56&&x.o.lng<-8.28}).map(function(x){return [x.o.lat,x.o.lng]}));
    map.fitBounds(pts,{padding:[20,20]});
    if(touch){
      var hint=document.getElementById('maphint'); hint.classList.add('show');
      hint.addEventListener('click',function(){hint.classList.remove('show');map.dragging.enable()});
      if('IntersectionObserver' in window) new IntersectionObserver(function(e){ if(!e[0].isIntersecting){map.dragging.disable();hint.classList.add('show')} }).observe(document.getElementById('leafmap'));
    } else {
      map.on('focus click',function(){map.scrollWheelZoom.enable()});
      map.on('mouseout',function(){map.scrollWheelZoom.disable()});
    }
  } else if(document.getElementById('map')){
    document.getElementById('map').style.display='none';
  }

  function renderMap(){
    if(!map) return;
    home.bindPopup('<b>Casa Porches</b><br>'+esc(T.homePopup));
    markers.forEach(function(m){var g=m._g,o=g[0].o;
      var body=g.map(function(x){return '<b>'+esc(x.o.name)+'</b>'+(x.price?' <span style="color:#a88a4e">'+esc(x.price)+'</span>':'')+'<br>'+esc((x.o.d&&(x.o.d[cur]||x.o.d.en))||'')}).join('<hr style="border:0;border-top:1px solid #eee;margin:6px 0">');
      m.bindPopup('<div style="max-height:220px;overflow:auto">'+body+'</div><a target="_blank" rel="noopener" href="'+dir(o)+'">'+esc(T.directions)+'</a>',{maxWidth:260})});
    var ch=document.getElementById('chips'); ch.innerHTML='';
    Object.keys(CATS).forEach(function(k){
      var b=document.createElement('button'); if(hidden[k]) b.className='off';
      b.innerHTML='<i style="background:'+CATS[k].c+'"></i>'+esc(T.cats[k]);
      b.onclick=function(){hidden[k]=!hidden[k]; if(hidden[k]){map.removeLayer(layers[k]);b.className='off'} else {map.addLayer(layers[k]);b.className=''}};
      ch.appendChild(b);
    });
  }

  var evCat='upcoming', evTag='';
  function ico(o){return o.img?'<img class="ico ph" loading="lazy" alt="" src="'+esc(o.img)+'">':'<span class="ico">'+esc(o.icon||'📍')+'</span>'}
  function dt(s){var p=s.split('-');return new Date(+p[0],+p[1]-1,+p[2])}
  function fmtD(d,o){try{return new Intl.DateTimeFormat(cur==='en'?'en-GB':cur,o).format(d)}catch(e){return d.toDateString()}}
  function range(s,e){var a=dt(s),b=dt(e||s);
    if(+a===+b) return fmtD(a,{weekday:'short',day:'numeric',month:'short',year:'numeric'});
    if(a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()) return a.getDate()+'–'+fmtD(b,{day:'numeric',month:'short',year:'numeric'});
    return fmtD(a,{day:'numeric',month:'short'})+' – '+fmtD(b,{day:'numeric',month:'short',year:'numeric'})}
  function evRender(){
    if(!window.EVENTS||!document.getElementById('evList')) return;
    var l=cur, U=EV_UI;
    document.querySelectorAll('[data-ev]').forEach(function(el){el.textContent=U[el.dataset.ev][l]});
    var cats=document.getElementById('evCats'); cats.innerHTML='';
    Object.keys(EV_CATS).forEach(function(k){var b=document.createElement('button');b.className=evCat===k?'on':'';b.textContent=EV_CATS[k][l];b.onclick=function(){evCat=k;evRender()};cats.appendChild(b)});
    document.getElementById('evWhoLbl').textContent=U.forWho[l];
    var tg=document.getElementById('evTags'); tg.innerHTML='';
    [''].concat(Object.keys(EV_TAGS)).forEach(function(k){var b=document.createElement('button');b.className='tag'+(evTag===k?' on':'');b.textContent=k?EV_TAGS[k][l]:U.anyone[l];b.onclick=function(){evTag=k;evRender()};tg.appendChild(b)});
    var today=new Date();today.setHours(0,0,0,0);
    var items=[];
    if(evCat==='upcoming'){
      EVENTS.forEach(function(e){
        if(e.sessions) e.sessions.forEach(function(s){items.push({e:e,start:s[0],end:s[1],sub:s[2]})});
        else if(e.start) items.push({e:e,start:e.start,end:e.end});
      });
      items=items.filter(function(x){return dt(x.end||x.start)>=today}).sort(function(a,b){return dt(a.start)-dt(b.start)});
    } else {
      items=EVENTS.filter(function(e){return e.cat===evCat}).map(function(e){
        var nx=null; if(e.sessions){nx=e.sessions.filter(function(s){return dt(s[1])>=today})[0]}
        return {e:e,start:nx?nx[0]:e.start,end:nx?nx[1]:e.end,sub:nx?nx[2]:null};
      });
    }
    if(evTag) items=items.filter(function(x){return (x.e.tags||[]).indexOf(evTag)>=0});
    var html=items.map(function(x){
      var e=x.e, T=TOWNS[e.town]||{}, when='', badge='';
      if(x.start && !(x.start && dt(x.end||x.start)<today)){
        when=range(x.start,x.end);
        if(dt(x.start)<=today) badge='<span class="badge live">'+U.now[l]+'</span>';
        else if(e.cat==='events'||e.sessions) badge='<span class="badge ok">'+U.confirmed[l]+'</span>';
      } else if(e.usual){
        when=U.usually[l]+': '+e.usual[l]+(e.last?' · '+U.last[l]+': '+range(e.last[0],e.last[1]):'');
      } else if(e.season){ when=e.season[l] }
      var dist=x.sub?'':T.km===0?U.inPorches[l]:(T.km?'≈ '+T.km+' km · '+T.min+' min '+U.fromHouse[l]:'');
      var place=(x.sub?x.sub:(T.name||''));
      var q=x.sub||(e.name+' '+(T.name||'Algarve'));
      return '<div class="card"><div class="t"><span class="nm">'+ico(e)+'<span>'+esc(e.name)+badge+'</span></span></div>'
        +(when?'<div class="when">'+esc(when)+'</div>':'')
        +'<div class="loc">'+esc([place,dist].filter(Boolean).join(' · '))+'</div>'
        +'<p>'+esc(e.d[l]||e.d.en)+(e.price?' <b>'+esc(e.price)+'</b>':'')+'</p>'
        +'<div class="meta">'+(e.tags||[]).map(function(t){return '<span>'+esc(EV_TAGS[t][l])+'</span>'}).join('')+'</div>'
        +'<div class="links"><a class="map" target="_blank" rel="noopener" href="'+gmaps(q)+'">Google Maps →</a>'+(e.url?'<a class="map" target="_blank" rel="noopener" href="'+esc(e.url)+'">'+U.website[l]+' →</a>':'')+'</div></div>';
    }).join('');
    document.getElementById('evList').innerHTML=html||'<p class="note">'+U.none[l]+'</p>';
    document.getElementById('evNote').textContent=U.note[l];
  }
  var restFilter='near';
  function renderRest(){
    if(!window.RESTAURANTS||!document.getElementById('restList')) return;
    var l=cur, chips=document.getElementById('restChips'), list=document.getElementById('restList');
    var keys=['all','near'].concat(Object.keys(REST_CATS).filter(function(k){return k!=='near'}));
    chips.innerHTML='';
    keys.forEach(function(k){var b=document.createElement('button');b.className=(restFilter===k?'on':'');
      b.textContent=k==='all'?REST_UI.all[l]:REST_CATS[k][l];b.onclick=function(){restFilter=k;renderRest()};chips.appendChild(b)});
    var items=RESTAURANTS.filter(function(r){return restFilter==='all'||(restFilter==='near'?r.near:r.cat===restFilter)});
    if(restFilter==='all') items=items.slice().sort(function(a,b){return (b.near?1:0)-(a.near?1:0)});
    list.innerHTML=items.map(function(r){
      return '<div class="card"><div class="t"><span class="nm">'+ico(r)+'<span>'+esc(r.name)+'</span></span><small>'+esc(r.price)+'</small></div><div class="loc">'+esc(r.loc)+'</div><p>'+esc(r.d[l]||r.d.en)+'</p><div class="meta"><span>'+esc(REST_CATS[r.cat][l])+'</span>'+(r.near?'<span class="near">'+esc(REST_UI.near[l])+'</span>':'')+'</div><a class="map" target="_blank" rel="noopener" href="'+gmaps(r.q)+'">Google Maps →</a></div>'}).join('');
    document.getElementById('restNote').textContent='€ <20 € · €€ 20–40 € · €€€ 40–80 € · €€€€ >80 € — '+REST_UI.price[l];
  }
  function setLang(l){
    if(codes.indexOf(l)<0) l='en';
    cur=l; T=TXT[l]; document.documentElement.lang=l;
    document.title=document.body.dataset.page==='explore'?T.explore.title:T.title;
    document.querySelectorAll('[data-t]').forEach(function(el){var v=get(el.dataset.t); if(v!=null) el.textContent=v});
    document.querySelectorAll('[data-list]').forEach(function(ul){ul.innerHTML=(T[ul.dataset.list]||[]).map(function(x){return '<li>'+esc(x)+'</li>'}).join('')});
    document.querySelectorAll('[data-places]').forEach(function(box){
      box.innerHTML=PLACES.filter(function(p){return p.list===box.dataset.places}).map(function(p){
        return '<div class="card pic">'+(p.img?'<img class="cimg" loading="lazy" alt="" src="'+esc(p.img)+'">':'')+'<div class="cbody"><div class="t">'+esc(p.name)+(p.dist?'<small>'+esc(p.dist)+'</small>':'')+'</div><p>'+esc(p.d[l]||p.d.en)+'</p><a class="map" target="_blank" rel="noopener" href="'+gmaps(p.q)+'">Google Maps →</a></div></div>'}).join('')});
    renderRest();
    evRender();
    lbtn.innerHTML=(FLAGS[l]||'')+'<span>'+l.toUpperCase()+'</span><span style="font-size:.7rem;opacity:.8">▾</span>';
    lmenu.querySelectorAll('button').forEach(function(b){b.classList.toggle('on',b.dataset.set===l)});
    document.querySelectorAll('a[data-page]').forEach(function(a){var h=a.getAttribute('href').split('?')[0].split('#');a.setAttribute('href',h[0]+'?lang='+l+(h[1]?'#'+h[1]:''))});
    try{localStorage.setItem('guiaLang',l)}catch(e){}
    try{var u=new URL(location.href);u.searchParams.set('lang',l);history.replaceState(null,'',u)}catch(e){}
    renderMap();
  }

  document.querySelectorAll('[data-copy]').forEach(function(b){
    b.addEventListener('click',function(){
      var t=document.getElementById(b.dataset.copy).textContent;
      var done=function(){b.textContent=T.copied;setTimeout(function(){b.textContent=T.copy},1500)};
      if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(done,function(){})}
      else{var r=document.createRange();r.selectNodeContents(document.getElementById(b.dataset.copy));var s=getSelection();s.removeAllRanges();s.addRange(r);try{document.execCommand('copy');done()}catch(e){}}
    });
  });

  var q=new URLSearchParams(location.search).get('lang'), saved=null;
  try{saved=localStorage.getItem('guiaLang')}catch(e){}
  var navs=(navigator.languages||[navigator.language||'en']).map(function(x){return (x||'').slice(0,2).toLowerCase()});
  var auto=navs.filter(function(c){return codes.indexOf(c)>=0})[0];
  setLang(codes.indexOf(q)>=0?q:(saved||auto||'pt'));
};
/* Os conteúdos vêm de data/site.json (gerado a partir do Excel Conteudos_Site_Casa_Porches.xlsx) */
fetch('data/site.json',{cache:'no-cache'}).then(function(r){return r.json()}).then(function(d){
  for(var k in d) window[k]=d[k];
  window.startGuide();
}).catch(function(e){
  document.querySelector('main').insertAdjacentHTML('afterbegin','<section><p>⚠️ Não foi possível carregar os conteúdos. Recarregue a página. / Could not load content, please reload.</p></section>');
  console.error(e);
});
