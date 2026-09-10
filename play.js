(function(){
  "use strict";

  var metaPollTimer = null;
  var saveDebounce = null;
  var pinUnlockedThisLoad = false; // intentionally in-memory only: re-prompt on every fresh visit

  var myGuesses = {};
  var myIndex = 0;
  var lastKnownHostIndex = null;
  var myName = ''; // intentionally in-memory only: never persisted client-side, re-entered every visit

  async function render(){
    var root = $('#play-root');
    root.innerHTML = '<p style="color:var(--muted)">Laddar…</p>';
    await authReady;
    if (!currentUid){ root.innerHTML = '<p>Kunde inte ansluta. Ladda om sidan.</p>'; return; }

    if (!pinUnlockedThisLoad){
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
            pinUnlockedThisLoad = true;
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

    if (!myName){
      root.innerHTML =
        '<div class="card" style="display:flex;flex-direction:column;gap:14px;">'+
        '<h2>Vem gissar?</h2>'+
        '<div class="field"><label for="name-input">Ditt namn</label><input id="name-input" placeholder="Förnamn"></div>'+
        '<button class="btn primary" id="name-start">Starta gissningen</button>'+
        '</div>';
      $('#name-start', root).addEventListener('click', async function(){
        var v = $('#name-input', root).value.trim();
        if (!v){ toast('Skriv ditt namn först.'); return; }
        myName = v;
        // Register/update the name right away so the host's live list shows who's
        // joined, even before guesses are filled in. Preserve any existing guesses
        // (e.g. if the DB row already exists from earlier in this same quiz) rather
        // than wiping them just because the name is being re-entered.
        try {
          var existing = await sb.from('guesses').select('id').eq('id', currentUid).maybeSingle();
          if (existing.data){
            await sb.from('guesses').update({ name: v }).eq('id', currentUid);
          } else {
            await sb.from('guesses').insert({ id: currentUid, name: v, guesses: {} });
          }
        } catch(e){}
        render();
      });
      $('#name-input', root).addEventListener('keydown', function(e){
        if (e.key === 'Enter') $('#name-start', root).click();
      });
      return;
    }

    // Already revealed? Skip straight to results.
    var stateRes = await sb.from('meta').select('revealed, present_index').eq('id','state').maybeSingle();
    if (stateRes.data && stateRes.data.revealed){
      renderResults();
      return;
    }

    var gres = await sb.from('guesses').select('guesses').eq('id', currentUid).maybeSingle();
    myGuesses = (gres.data && gres.data.guesses) || {};

    if (stateRes.data && typeof stateRes.data.present_index === 'number'){
      lastKnownHostIndex = stateRes.data.present_index;
      myIndex = lastKnownHostIndex;
    }
    if (myIndex < 0 || myIndex >= PROPERTIES.length) myIndex = 0;

    renderQuestionShell(myName);
    drawQuestion();

    if (metaPollTimer) clearInterval(metaPollTimer);
    metaPollTimer = setInterval(pollMeta, 4000);
  }

  function renderQuestionShell(name){
    // 'name' param here is just the display value already captured in myName
    var root = $('#play-root');
    var html = '';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">';
    html += '<h2>Hej '+esc(name)+'!</h2>';
    html += '<button class="btn ghost" id="change-name" style="font-size:.8rem;padding:6px 12px;">Byt namn</button>';
    html += '</div>';
    html += '<div id="reveal-banner-slot"></div>';
    html += '<div id="question-slot"></div>';
    root.innerHTML = html;
    $('#change-name', root).addEventListener('click', function(){
      myName = '';
      if (metaPollTimer){ clearInterval(metaPollTimer); metaPollTimer = null; }
      render();
    });
  }

  function drawQuestion(){
    var root = $('#question-slot');
    if (!root) return;
    var p = PROPERTIES[myIndex];
    var filledCount = PROPERTY_IDS.filter(function(id){ return myGuesses[id] > 0; }).length;

    var html = '';
    html += '<div class="card" style="display:flex;flex-direction:column;gap:14px;">';
    html += '<div style="display:flex;gap:14px;align-items:center;">';
    html += imgOrPlaceholder(p.imgOutside, 'thumb', 'width:84px;height:63px;flex-shrink:0;');
    html += '<div style="flex:1;min-width:0;">';
    html += '<div style="font-weight:600;font-size:1.05rem;">'+esc(p.address)+'</div>';
    html += '<div class="chip-row" style="margin-top:6px;">'+(p.area ? '<span class="chip">'+fmtInt(p.area)+' m²</span>' : '')+'</div>';
    html += '</div>';
    html += '</div>';
    html += '<div class="guess-field" style="justify-content:center;">';
    html += '<input type="number" inputmode="numeric" min="0" step="100" id="guess-input" value="'+esc(myGuesses[p.id]||'')+'">';
    html += '<span class="unit">kr/m²</span>';
    html += '</div>';
    html += '</div>';

    html += '<div class="dots" style="margin-top:14px;">';
    PROPERTIES.forEach(function(_, i){
      html += '<button class="dot '+(i===myIndex?'active':'')+'" data-dot="'+i+'" aria-label="Bostad '+(i+1)+'"></button>';
    });
    html += '</div>';

    html += '<div class="question-nav">';
    html += '<button class="btn" id="q-prev" '+(myIndex===0?'disabled':'')+'>← Föregående</button>';
    html += '<div class="question-progress">'+filledCount+'/'+PROPERTIES.length+' ifyllda</div>';
    html += '<button class="btn" id="q-next" '+(myIndex===PROPERTIES.length-1?'disabled':'')+'>Nästa →</button>';
    html += '</div>';

    root.innerHTML = html;

    var input = $('#guess-input', root);
    input.focus();
    input.addEventListener('input', function(){
      scheduleSave();
      $('.question-progress', root).textContent =
        PROPERTY_IDS.filter(function(id){ return (id === p.id ? parseFloat(input.value) : myGuesses[id]) > 0; }).length +
        '/' + PROPERTIES.length + ' ifyllda';
    });
    input.addEventListener('blur', function(){ saveCurrentValue(); flushSave(); });

    $('#q-prev', root).addEventListener('click', function(){ goTo(myIndex - 1); });
    $('#q-next', root).addEventListener('click', function(){ goTo(myIndex + 1); });
    $all('[data-dot]', root).forEach(function(d){
      d.addEventListener('click', function(){ goTo(parseInt(d.dataset.dot)); });
    });
  }

  function saveCurrentValue(){
    var input = $('#guess-input');
    if (!input) return;
    var v = parseFloat(input.value);
    var p = PROPERTIES[myIndex];
    if (v > 0) myGuesses[p.id] = v;
    else delete myGuesses[p.id];
  }

  function goTo(i){
    if (i < 0 || i >= PROPERTIES.length) return;
    saveCurrentValue();
    flushSave();
    myIndex = i;
    drawQuestion();
  }

  function scheduleSave(){
    if (saveDebounce) clearTimeout(saveDebounce);
    saveDebounce = setTimeout(function(){ saveCurrentValue(); flushSave(); }, 700);
  }

  async function flushSave(){
    var complete = PROPERTY_IDS.every(function(id){ return myGuesses[id] > 0; });
    try {
      await sb.from('guesses').upsert({
        id: currentUid,
        name: myName,
        guesses: myGuesses,
        submitted_at: complete ? new Date().toISOString() : null
      });
    } catch(e){}
  }

  async function pollMeta(){
    var snap = await sb.from('meta').select('revealed, present_index').eq('id','state').maybeSingle();
    if (!snap.data) return;

    var bannerSlot = $('#reveal-banner-slot');
    if (snap.data.revealed){
      if (bannerSlot){
        bannerSlot.innerHTML = '<div class="banner"><span style="font-size:1.4rem;">🏆</span><span class="msg">Resultatet är klart!</span><button class="btn primary" id="go-reveal">Visa resultat</button></div>';
        $('#go-reveal', bannerSlot).addEventListener('click', function(){
          if (metaPollTimer){ clearInterval(metaPollTimer); metaPollTimer = null; }
          renderResults();
        });
      }
      var input = $('#guess-input');
      if (input) input.disabled = true;
      return;
    }

    if (typeof snap.data.present_index === 'number' && snap.data.present_index !== lastKnownHostIndex){
      lastKnownHostIndex = snap.data.present_index;
      saveCurrentValue();
      flushSave();
      myIndex = lastKnownHostIndex;
      drawQuestion();
    }
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
    drawReveal('#play-root', entries, answers, myName);
  }

  render();
})();
