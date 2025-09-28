const SHEET_API = 'https://script.google.com/macros/s/AKfycbyrNAcNgZvXEgH5VDFLXFnYjo8LMlupJ0CI2YySqHtns4mOwf80DQNyEIf1yVfjNShm/exec'; // ← replace with your Apps Script exec URL
const COLUMNS = ['Name','DamageType','ToHit','NumDice','DieType','DamageMod'];
const PASTEL_PALETTE = {
  White: '#FFFFFF',
  Black: '#000000',
  'Light Yellow': '#FAEDCB',
  'Light Mint': '#C9E4DE',
  'Light Blue': '#C6DEF1',
  'Light Lavender': '#DBCDF0',
  'Light Pink': '#F2C6DE',
  'Light Peach': '#F7D9C4'
};

let attacks = [], settings = {};

// Fetch attacks from sheet and populate combobox
async function fetchAttacks() {
  const resp = await fetch(`${SHEET_API}?action=getAttacks`);
  attacks = await resp.json();
  const sel = document.getElementById('attackSelect');
  sel.innerHTML = attacks.map(a => `<option>${a.Name}</option>`).join('');
  if (attacks.length) sel.selectedIndex = 0;
}

// Fetch settings from sheet and apply theme
async function fetchSettings() {
  const resp = await fetch(`${SHEET_API}?action=getSettings`);
  settings = await resp.json();
  document.getElementById('doubleMod').checked   = settings.double_mod_on_crit;
  document.getElementById('critThreshold').value = settings.crit_threshold;
  document.getElementById('bgColor').value       = settings.bg_color;
  document.getElementById('btnColor').value      = settings.button_color;
  document.getElementById('txtColor').value      = settings.text_color;
  applyTheme();
}

// Fill the three color <select> controls
function populateColorPickers() {
  const bg  = document.getElementById('bgColor');
  const btn = document.getElementById('btnColor');
  const txt = document.getElementById('txtColor');
  Object.keys(PASTEL_PALETTE).forEach(name => {
    const opt = `<option>${name}</option>`;
    bg.innerHTML  += opt;
    btn.innerHTML += opt;
    txt.innerHTML += opt;
  });
}

// Apply colors to body/buttons
function applyTheme() {
  const bgHex  = PASTEL_PALETTE[settings.bg_color]   || settings.bg_color;
  const btnHex = PASTEL_PALETTE[settings.button_color]|| settings.button_color;
  const txtHex = PASTEL_PALETTE[settings.text_color]  || settings.text_color;

  document.body.style.backgroundColor = bgHex;
  document.body.style.color           = txtHex;
  document.querySelectorAll('button').forEach(b => {
    b.style.backgroundColor = btnHex;
    b.style.color           = txtHex;
  });
}

// Utility: roll n dice of type "dX"
function rollDice(n, type) {
  const sides = parseInt(type.replace('d',''),10);
  let sum = 0;
  for (let i=0; i<n; i++) sum += Math.floor(Math.random()*sides)+1;
  return sum;
}

// Main roll logic
function rollDamage() {
  const atk   = attacks.find(a => a.Name === document.getElementById('attackSelect').value);
  const rolls = parseInt(document.getElementById('rollCount').value,10);
  const ac    = parseInt(document.getElementById('targetAC').value,10) || null;
  const critMin = parseInt(settings.crit_threshold,10);
  const dblMod  = settings.double_mod_on_crit;
  const tbody   = document.querySelector('#results tbody');
  tbody.innerHTML = '';
  let total = 0;

  for (let i=0; i<rolls; i++) {
    const nat = Math.floor(Math.random()*20)+1;
    const toHit = nat + parseInt(atk.ToHit,10);
    let dmg=0, hitTxt='No', tag='';
    if (nat===1) {
      hitTxt='FUMBLE'; tag='fumble';
    }
    else if (nat>=critMin) {
      dmg = rollDice(parseInt(atk.NumDice,10)*2, atk.DieType)
          + parseInt(atk.DamageMod,10)*(dblMod?2:1);
      hitTxt='CRIT!'; tag='crit';
    }
    else if (!ac || toHit>=ac) {
      dmg = rollDice(parseInt(atk.NumDice,10), atk.DieType)
          + parseInt(atk.DamageMod,10);
      hitTxt='Yes';
    }
    total += dmg;
    const tr = document.createElement('tr');
    if (tag) tr.classList.add(tag);
    tr.innerHTML = `<td>${nat}+${atk.ToHit}</td><td>${hitTxt}</td><td>${dmg}</td>`;
    tbody.appendChild(tr);
  }

  document.getElementById('total').textContent =
    `Total Damage: ${total} ${atk['Damage Type']}`;
}

// Render the Attack Editor table from current `attacks` array
function renderEditorTable() {
  const tbody = document.querySelector('#editorTable tbody');
  tbody.innerHTML = '';
  attacks.forEach((a,idx) => {
    const tr = document.createElement('tr');
    tr.dataset.index = idx;
    tr.onclick = () => tr.classList.toggle('selected');
    COLUMNS.forEach(col => {
      const td = document.createElement('td');
      td.contentEditable = 'true';
      td.innerText = a[col]||'';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

// Save edited attacks back to Google Sheet
async function saveAttacks() {
  const rows = Array.from(
    document.querySelectorAll('#editorTable tbody tr')
  ).map(tr => {
    const cells = tr.querySelectorAll('td');
    const obj = {};
    COLUMNS.forEach((col,i) => obj[col] = cells[i].innerText.trim()||'0');
    return obj;
  });

  await fetch(`${SHEET_API}?action=saveAttacks`, {
    method: 'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify(rows)
  });

  await fetchAttacks();
  document.getElementById('editorModal').classList.add('hidden');
}

// Onload: wire everything up
window.onload = async () => {
  populateColorPickers();
  await fetchAttacks();
  await fetchSettings();

  document.getElementById('rollBtn').onclick = rollDamage;
  document.getElementById('settingsBtn').onclick =
    () => document.getElementById('settingsModal').classList.remove('hidden');
  document.getElementById('closeSettings').onclick =
    () => document.getElementById('settingsModal').classList.add('hidden');
  document.getElementById('saveSettings').onclick = async () => {
    settings = {
      double_mod_on_crit: document.getElementById('doubleMod').checked,
      crit_threshold:      parseInt(document.getElementById('critThreshold').value,10),
      bg_color:            document.getElementById('bgColor').value,
      button_color:        document.getElementById('btnColor').value,
      text_color:          document.getElementById('txtColor').value
    };
    await fetch(`${SHEET_API}?action=saveSettings`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(settings)
    });
    applyTheme();
    document.getElementById('settingsModal').classList.add('hidden');
  };

  document.getElementById('editAttacksBtn').onclick = () => {
    renderEditorTable();
    document.getElementById('editorModal').classList.remove('hidden');
  };
  document.getElementById('addRowBtn').onclick = () => {
    const tbody = document.querySelector('#editorTable tbody');
    const tr = document.createElement('tr');
    COLUMNS.forEach(_ => {
      const td = document.createElement('td');
      td.contentEditable = 'true';
      td.innerText = '';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  };
  document.getElementById('deleteRowsBtn').onclick = () => {
    document.querySelectorAll('#editorTable tr.selected').forEach(r => r.remove());
  };
  document.getElementById('saveAttacksBtn').onclick = saveAttacks;
};
