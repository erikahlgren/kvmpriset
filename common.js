// Shared by both host.js (index.html) and play.js (play.html).
// Deliberately does NOT include map generation, the present slideshow, the
// host panel, or computeAndReveal — those stay host-only so the contestant
// page never even downloads that code.
(function(){
  "use strict";

  window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  window.currentUid = null;
  window.authReady = (async function(){
    var existing = await window.sb.auth.getSession();
    if (existing.data.session){
      window.currentUid = existing.data.session.user.id;
      return window.currentUid;
    }
    var res = await window.sb.auth.signInAnonymously();
    if (res.error){ console.error('auth error', res.error); return null; }
    window.currentUid = res.data.user.id;
    return window.currentUid;
  })();

  window.PROPERTY_IDS = PROPERTIES.map(function(p){ return p.id; });
  window.PROPERTIES_BY_ID = {};
  PROPERTIES.forEach(function(p){ window.PROPERTIES_BY_ID[p.id] = p; });

  window.$ = function(sel, root){ return (root||document).querySelector(sel); };
  window.$all = function(sel, root){ return Array.prototype.slice.call((root||document).querySelectorAll(sel)); };
  window.esc = function(str){
    return String(str==null?'':str).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  };
  window.fmtInt = function(n){
    if (n==null || isNaN(n)) return '–';
    return new Intl.NumberFormat('sv-SE').format(Math.round(n));
  };
  window.fmtKvm = function(n){ return fmtInt(n) + ' kr/m²'; };
  window.toast = function(msg){
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function(){ t.remove(); }, 3200);
  };
  window.houseSvg = function(){
    return '<svg viewBox="0 0 100 75" class="placeholder-svg" aria-hidden="true">'+
      '<path d="M8 42 L50 10 L92 42" />'+
      '<rect x="18" y="42" width="64" height="26" />'+
      '<rect x="44" y="50" width="14" height="18" />'+
      '</svg>';
  };
  window.imgOrPlaceholder = function(src, cls, extraStyle){
    var style = extraStyle ? ' style="'+extraStyle+'"' : '';
    if (src){
      return '<div class="'+cls+'"'+style+'><img src="'+esc(src)+'" alt="" loading="lazy"></div>';
    }
    return '<div class="'+cls+' pad"'+style+'>'+houseSvg()+'</div>';
  };

  window.generatePin = function(){
    return String(Math.floor(1000 + Math.random() * 9000));
  };
  window.ensureStateDoc = async function(){
    var res = await sb.from('meta').select('*').eq('id','state').maybeSingle();
    if (res.data) return res.data;
    var initial = { id:'state', revealed:false, revealed_at:null, pin: generatePin() };
    try { await sb.from('meta').insert(initial); } catch(e){}
    return initial;
  };

  window.drawReveal = function(rootSel, entries, answers){
    var root = $(rootSel);
    var medals = ['🥇','🥈','🥉'];
    var html = '';

    if (entries.length > 0){
      var winner = entries[0];
      html += '<div class="winner-banner">';
      html += '<div class="medal">🏆</div>';
      html += '<div class="name">'+esc(winner.name)+'</div>';
      html += '<div class="sub">Total avvikelse: '+fmtKvm(winner.totalDiff)+'</div>';
      html += '</div>';
    }

    html += '<div class="table-wrap"><table><thead><tr><th>#</th><th>Namn</th><th class="num">Total avvikelse</th></tr></thead><tbody>';
    entries.forEach(function(e, i){
      var isMe = e.name === (localStorage.getItem('kvm_playerName')||'');
      html += '<tr class="'+(isMe?'me':'')+'">';
      html += '<td><span class="rank-medal">'+(medals[i]||(i+1))+'</span></td>';
      html += '<td>'+esc(e.name)+(e.complete===false?' <span class="chip badge-warn">ofullständig</span>':'')+'</td>';
      html += '<td class="num">'+fmtKvm(e.totalDiff)+'</td>';
      html += '</tr>';
    });
    if (entries.length === 0) html += '<tr><td colspan="3">Inga gissningar inlämnade ännu.</td></tr>';
    html += '</tbody></table></div>';

    html += '<h2 style="margin-top:6px;">Bostad för bostad</h2>';
    html += '<div style="display:flex;flex-direction:column;gap:8px;">';
    PROPERTY_IDS.forEach(function(id, i){
      var p = PROPERTIES_BY_ID[id];
      var a = answers[id];
      if (!p || !a) return;
      var rows = entries.map(function(e){
        var pp = e.perProperty ? e.perProperty[id] : undefined;
        return { name: e.name, guess: pp ? pp.guess : undefined, diff: pp ? pp.diff : undefined };
      }).filter(function(r){ return r.diff != null; }).sort(function(x,y){ return x.diff - y.diff; });
      html += '<details class="prop-detail">';
      html += '<summary><span class="chip">'+(i+1)+'</span> '+esc(p.address)+' <span class="chip" style="margin-left:auto;">'+fmtKvm(a.price_per_sqm)+'</span></summary>';
      html += '<div class="body">';
      html += '<p style="color:var(--ink-soft);font-size:.9rem;">Sålt för '+fmtInt(a.sold_price)+' kr'+(p.area?(' &middot; '+fmtInt(p.area)+' m²'):'')+'</p>';
      if (rows.length){
        html += '<div class="table-wrap"><table><thead><tr><th>Namn</th><th class="num">Gissning</th><th class="num">Avvikelse</th></tr></thead><tbody>';
        rows.forEach(function(r, ri){
          html += '<tr><td>'+(ri===0?'<span class="closest">🎯 </span>':'')+esc(r.name)+'</td><td class="num">'+fmtKvm(r.guess)+'</td><td class="num">'+fmtKvm(r.diff)+'</td></tr>';
        });
        html += '</tbody></table></div>';
      }
      html += '</div></details>';
    });
    html += '</div>';

    root.innerHTML = html;
  };
})();
