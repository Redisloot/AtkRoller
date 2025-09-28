const SHEET_API = 'https://script.google.com/macros/s/AKfycbyrNAcNgZvXEgH5VDFLXFnYjo8LMlupJ0CI2YySqHtns4mOwf80DQNyEIf1yVfjNShm/exec';
let attacks = [], settings = {};

async function fetchAttacks() {
  const resp = await fetch(`${SHEET_API}?action=getAttacks`);
  attacks = await resp.json();
  const sel = document.getElementById('attackSelect');
  sel.innerHTML = attacks.map(a => `<option>${a.Name}</option>`).join('');
}

async function fetchSettings() {
  const resp = await fetch(`${SHEET_API}?action=getSettings`);
  settings = await resp.json();
  // populate settings form
  document.getElementById('doubleMod').checked = settings.double_mod_on_crit;
  document.getElementById('critThreshold').value = settings.crit_threshold;
  document.getElementById('bgColor').value = settings.bg_color;
  document.getElementById('btnColor').value = settings.button_color;
  document.getElementById('txtColor').value = settings.text_color;
  applyTheme();
}

function applyTheme() {
  document.body.style.background = settings.bg_color;
  document.body.style.color = settings.txt_color;
  document.querySelectorAll('button').forEach(b => b.style.background = settings.button_color);
}

function rollDamage() {
  const atk = attacks.find(a => a.Name === document.getElementById('attackSelect').value);
  const rolls = +document.getElementById('rollCount').value;
  const ac = +document.getElementById('targetAC').value || null;
  const critMin = +settings.crit_threshold;
  const dblMod = settings.double_mod_on_crit;
  const tbody = document.querySelector('#results tbody');
  tbody.innerHTML = '';
  let total = 0;

  for (let i = 0; i < rolls; i++) {
    const nat = Math.floor(Math.random()*20)+1;
    const toHit = nat + +atk.ToHit;
    let dmg=0, hitTxt='No', tag='';
    if (nat===1)      { hitTxt='FUMBLE'; tag='fumble'; }
    else if (nat>=critMin) {
      dmg = rollDice(atk.NumDice*2, atk.DieType) + (+atk.DamageMod)*(dblMod?2:1);
      hitTxt='CRIT!'; tag='crit';
    }
    else if (!ac || toHit>=ac) {
      dmg = rollDice(atk.NumDice, atk.DieType) + +atk.DamageMod;
      hitTxt='Yes';
    }
    total += dmg;
    const tr = document.createElement('tr');
    if(tag) tr.classList.add(tag);
    tr.innerHTML = `<td>${nat}+${atk.ToHit}</td><td>${hitTxt}</td><td>${dmg}</td>`;
    tbody.appendChild(tr);
  }
  document.getElementById('total').textContent = `Total Damage: ${total} ${atk['Damage Type']}`;
}

function rollDice(n, type) {
  const sides = +type.replace('d','');
  let sum=0;
  for(let i=0;i<n;i++) sum += Math.floor(Math.random()*sides)+1;
  return sum;
}

async function saveSettings() {
  const obj = {
    double_mod_on_crit: document.getElementById('doubleMod').checked,
    crit_threshold: +document.getElementById('critThreshold').value,
    bg_color: document.getElementById('bgColor').value,
    button_color: document.getElementById('btnColor').value,
    text_color: document.getElementById('txtColor').value
  };
  await fetch(`${SHEET_API}?action=saveSettings`, {
    method:'POST', body: JSON.stringify(obj)
  });
  settings = obj; applyTheme();
}

document.getElementById('rollBtn').onclick = rollDamage;
document.getElementById('settingsBtn').onclick = () => document.getElementById('settingsModal').classList.remove('hidden');
document.getElementById('closeSettings').onclick = () => document.getElementById('settingsModal').classList.add('hidden');
document.getElementById('saveSettings').onclick = saveSettings;

window.onload = async () => {
  await fetchAttacks();
  await fetchSettings();

};
