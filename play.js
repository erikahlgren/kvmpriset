(function(){
  "use strict";

  var pollTimer = null;

  async function render(){
    var root = $('#play-root');
    root.innerHTML = '<p style="color:var(--muted)">Laddar…</p>';
    await authReady;
    if (!currentUid){ root.innerHTML = '<p>Kunde inte ansluta. Ladda om sidan.</p>'; return; }

    if (localStorage.getItem('kvm_pinOk') !== '1'){
      var quizState = await ensureStateDoc();
      if (quizState.pin){
        root.innerHTML =
          '<div class="card" style="display:flex;flex-direction:column;gap:14px;">'+
          '<h2>Ange PIN-kod</h2>'+
          '<p style="color:var(--ink-soft)">Fråga quizvärden om koden för kvällens gissning.</p>'+
          '<div class="field"><label for="pin-entry">PIN-kod</label><input id="pin-entry" maxlength="4" inputmode="numeric" placeholder="1234"></div>'+
          '<button class="btn primary" id="pin-unlock">Lås upp</button>'+
          '</div>';
        $('#pin-entry', root).focus();
        $('#pin-unlock', root).addEventListener('click', function(){
          var v = $('#pin-entry', root).value.trim();
          if (v === quizState.pin){
            localStorage.setItem('kvm_pinOk', '1');
            render();
          } else {
            toast('Fel PIN-kod, försök igen.');
          }
        });
        $('#pin-entry', root).addEventListener('keydown', function(e){
          if (e.key === 'Enter') $('#pin-unlock', root).click();
        });
        return;
      }
    }

    var name = localStorage.getItem('kvm_playerName') || '';
    if (!name){
      root.innerHTML =
        '<div class="card" style="display:flex;flex-direction:column;gap:14px;">'+
        '<h2>Vem gissar?</h2>'+
        '<div class="field"><label for="name-input">Ditt namn</label><input id="name-input" placeholder="Förnamn"></div>'+
        '<button class="btn primary" id="name-start">Starta gissningen</button>'+
        '</div>';
      $('#name-start', root).addEventListener('click', function(){
        var v = $('#name-input', root).value.trim();
        if (!v){ toast('Skriv ditt namn först.'); return; }
        localStorage.setItem('kvm_playerName', v);
        render();
      });
      $('#name-input', root).addEventListener('keydown', function(e){
        if (e.key === 'Enter') $('#name-start', root).click();
      });
      return;
    }

    // Already revealed? Skip straight to results.
    var stateRes = await sb.from('meta').select('revealed').eq('id','state').maybeSingle();
    if (stateRes.data && stateRes.data.revealed){
      renderResults();
      return;
    }

    var existing = {};
    try {
      var gres = await sb.from('guesses').select('guesses').eq('id', currentUid).maybeSingle();
      if (gres.data) existing = gres.data.guesses || {};
    } catch(e){}

    var html = '';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">';
    html += '<h2>Hej '+esc(name)+'!</h2>';
    html += '<button class="btn ghost" id="change-name" style="font-size:.8rem;padding:6px 12px;">Byt namn</button>';
    html += '</div>';
    html += '<p style="color:var(--ink-soft)">Gissa priset per kvadratmeter för varje bostad. Du kan ändra dina svar tills kvizvärden avslöjar resultatet.</p>';
    html += '<div id="reveal-banner-slot"></div>';
    html += '<div style="display:flex;flex-direction:column;gap:10px;margin-top:6px;">';
    PROPERTIES.forEach(function(p){
      html += '<div class="card guess-row">';
      html += imgOrPlaceholder(p.imgOutside, 'thumb', 'width:72px;height:54px;');
      html += '<div class="guess-info">';
      html += '<span class="addr">'+esc(p.address)+'</span>';
      html += '<span class="chip" style="width:fit-content;">'+ (p.area?fmtInt(p.area)+' m²':'') +'</span>';
      html += '</div>';
      html += '<div class="guess-field"><input type="number" inputmode="numeric" min="0" step="100" id="guess-'+p.id+'" value="'+esc(existing[p.id]||'')+'"><span class="unit">kr/m²</span></div>';
      html += '</div>';
    });
    html += '</div>';
    html += '<div class="sticky-bar">';
    html += '<span class="count" id="guess-count"></span>';
    html += '<button class="btn primary" id="submit-guesses">Skicka in</button>';
    html += '</div>';
    root.innerHTML = html;

    $('#change-name', root).addEventListener('click', function(){
      localStorage.removeItem('kvm_playerName');
      render();
    });

    function updateCount(){
      var filled = PROPERTIES.filter(function(p){
        var el = $('#guess-'+p.id, root);
        return el && parseFloat(el.value) > 0;
      }).length;
      $('#guess-count', root).textContent = filled + '/' + PROPERTIES.length + ' ifyllda';
      $('#submit-guesses', root).disabled = filled < PROPERTIES.length;
    }
    PROPERTIES.forEach(function(p){
      $('#guess-'+p.id, root).addEventListener('input', updateCount);
    });
    updateCount();

    $('#submit-guesses', root).addEventListener('click', async function(){
      var guesses = {};
      var ok = true;
      PROPERTIES.forEach(function(p){
        var v = parseFloat($('#guess-'+p.id, root).value);
        if (!(v > 0)) ok = false;
        guesses[p.id] = v;
      });
      if (!ok){ toast('Fyll i alla tio innan du skickar in.'); return; }
      try {
        var res = await sb.from('guesses').upsert({
          id: currentUid,
          name: name,
          guesses: guesses,
          submitted_at: new Date().toISOString()
        });
        if (res.error) throw res.error;
        toast('Inskickat! Lycka till 🎯');
      } catch(err){
        toast('Kunde inte skicka in svaret just nu, försök igen.');
      }
    });

    if (pollTimer) clearInterval(pollTimer);
    async function checkRevealed(){
      var snap = await sb.from('meta').select('revealed').eq('id','state').maybeSingle();
      var revealed = snap.data && snap.data.revealed;
      var slot = $('#reveal-banner-slot', root);
      if (!slot) return;
      if (revealed){
        slot.innerHTML = '<div class="banner"><span style="font-size:1.4rem;">🏆</span><span class="msg">Resultatet är klart!</span><button class="btn primary" id="go-reveal">Visa resultat</button></div>';
        $('#go-reveal', slot).addEventListener('click', function(){
          clearInterval(pollTimer); pollTimer = null;
          renderResults();
        });
        PROPERTIES.forEach(function(p){ var el = $('#guess-'+p.id, root); if (el) el.disabled = true; });
        var bar = $('.sticky-bar', root); if (bar) bar.hidden = true;
      } else {
        slot.innerHTML = '';
      }
    }
    checkRevealed();
    pollTimer = setInterval(checkRevealed, 4000);
  }

  async function renderResults(){
    var root = $('#play-root');
    root.innerHTML = '<p style="color:var(--muted)">Laddar resultat…</p>';
    var lbRes = await sb.from('leaderboard').select('*').eq('id','results').maybeSingle();
    var entries = lbRes.data ? lbRes.data.entries : [];
    var answers = lbRes.data ? (lbRes.data.answers_revealed || {}) : {};
    if (!lbRes.data){
      root.innerHTML = '<div class="card"><p>Väntar på att quizvärden avslöjar resultatet…</p></div>';
      return;
    }
    drawReveal('#play-root', entries, answers);
  }

  render();
})();
