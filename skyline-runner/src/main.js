import * as THREE from 'three';
import './style.css';

const $ = (id) => document.getElementById(id);
const lanes = [-2.35, 0, 2.35];
const dailyKey = new Date().toISOString().slice(0, 10);
const dailyTarget = 520 + [...dailyKey].reduce((total, letter) => total + letter.charCodeAt(0), 0) % 5 * 95;
const progress = { best: Number(localStorage.getItem('skyline-best') || 0), totalCrystals: Number(localStorage.getItem('skyline-crystals') || 0), skin: Number(localStorage.getItem('skyline-skin') || 0), history: JSON.parse(localStorage.getItem('skyline-history') || '[]'), dailyDone: localStorage.getItem('skyline-daily') === dailyKey };
const skins = [{ name: '晚霞快递', body: '#d26542', pack: '#27484a', unlock: 0 }, { name: '苔原信使', body: '#5d9b88', pack: '#27484a', unlock: 45 }, { name: '沙金航员', body: '#cf9c4d', pack: '#4a4031', unlock: 120 }];
const state = { mode: 'READY', lane: 1, y: 0, vy: 0, sliding: 0, speed: 14, distance: 0, coins: 0, combo: 0, multiplier: 1, comboTimer: 0, shield: false, magnet: 0, boost: 0, shake: 0, spawn: 0, wasAirborne: false, landPulse: 0, chapter: 0, best: progress.best };
const touchDevice = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
let renderPixelRatio = touchDevice ? Math.min(devicePixelRatio, 1.15) : Math.min(devicePixelRatio, 1.75);
const frameQuality = { elapsed: 0, frames: 0, stableWindows: 0 };
const audio = { context: null, muted: localStorage.getItem('skyline-muted') === 'true' };
const haptics = { enabled: localStorage.getItem('skyline-haptics') !== 'false' };
function haptic(pattern) { if (haptics.enabled && navigator.vibrate) navigator.vibrate(pattern); }
function unlockAudio() { if (audio.muted) return; if (!audio.context) audio.context = new AudioContext(); if (audio.context.state === 'suspended') audio.context.resume(); }
function tone(frequency, duration, type = 'sine', volume = .035, glide = 0) { if (audio.muted || !audio.context) return; const now = audio.context.currentTime; const oscillator = audio.context.createOscillator(); const gain = audio.context.createGain(); oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, now); if (glide) oscillator.frequency.exponentialRampToValueAtTime(Math.max(35, frequency + glide), now + duration); gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(volume, now + .012); gain.gain.exponentialRampToValueAtTime(.0001, now + duration); oscillator.connect(gain).connect(audio.context.destination); oscillator.start(now); oscillator.stop(now + duration + .02); }
function sfx(name) { const sounds = { lane: () => tone(180,.055,'triangle',.018,45), jump: () => tone(260,.17,'sine',.045,190), slide: () => tone(120,.11,'sawtooth',.022,-40), coin: () => { tone(720,.07,'sine',.035,220); setTimeout(() => tone(980,.08,'sine',.028,150), 48); }, power: () => { tone(330,.14,'triangle',.05,220); setTimeout(() => tone(620,.2,'sine',.03,280), 70); }, near: () => tone(450,.11,'sine',.032,110), hit: () => { tone(110,.3,'sawtooth',.07,-65); tone(70,.34,'square',.035,-20); }, land: () => tone(95,.06,'triangle',.018,-25) }; sounds[name]?.(); }

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(renderPixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = !touchDevice;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.querySelector('#app').prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#6f9ea2');
scene.fog = new THREE.Fog('#6f9ea2', 36, 125);
const camera = new THREE.PerspectiveCamera(57, innerWidth / innerHeight, .1, 180);
camera.position.set(0, 4.4, 7.8);
scene.add(new THREE.HemisphereLight('#e8e0c9', '#243a38', 2.3));
const sun = new THREE.DirectionalLight('#ffd8a8', 2.2); sun.position.set(-12, 19, 9); sun.castShadow = true; scene.add(sun);

const world = new THREE.Group(); scene.add(world);
const track = new THREE.Group(); world.add(track);
const dynamic = new THREE.Group(); world.add(dynamic);
const cloudBank = [];
const skyTraffic = [];
const chapterPalettes = [
  { name: '暮光货运区', sky: new THREE.Color('#6f9ea2'), fog: new THREE.Color('#6f9ea2'), sun: new THREE.Color('#ffd8a8') },
  { name: '高空风廊', sky: new THREE.Color('#688fa0'), fog: new THREE.Color('#688fa0'), sun: new THREE.Color('#e5d8b1') },
  { name: '夜航塔群', sky: new THREE.Color('#344b61'), fog: new THREE.Color('#344b61'), sun: new THREE.Color('#d1b06f') },
];

function material(color, emissive = null) { return new THREE.MeshStandardMaterial({ color, roughness: .66, metalness: .18, ...(emissive ? { emissive: color, emissiveIntensity: emissive } : {}) }); }
function box(w, h, d, color) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color)); m.castShadow = true; m.receiveShadow = true; return m; }

function buildWorld() {
  const railMat = material('#223238'); const lineMat = material('#e5b56d', .22);
  for (let s = 0; s < 15; s++) {
    const segment = new THREE.Group(); segment.position.z = -s * 10;
    const deck = box(8.7, .28, 10, '#334b4c'); deck.position.y = -.28; segment.add(deck);
    for (const x of [-4.1, -1.17, 1.17, 4.1]) { const rail = box(.13, .14, 10, railMat.color); rail.position.set(x, .02, 0); segment.add(rail); }
    const dash = box(.07, .02, 2.8, lineMat.color); dash.position.set(0, -.12, 0); segment.add(dash);
    const pylon = box(.22, 4.8, .22, '#3b4a46'); pylon.position.set(s % 2 ? -5 : 5, -2.55, -3.7); segment.add(pylon);
    track.add(segment);
  }
  const cityMat = ['#3e5553', '#4d625d', '#5b7069', '#354a4a'];
  for (let i = 0; i < 50; i++) { const h = 3 + Math.random() * 14; const b = box(2.2 + Math.random()*3, h, 2.5 + Math.random()*4, cityMat[i % cityMat.length]); b.position.set((Math.random() > .5 ? 1 : -1) * (7 + Math.random()*14), h/2 - 1.9, -Math.random()*150); world.add(b); }
  const cloudMat = new THREE.MeshStandardMaterial({ color:'#dce4d7', transparent:true, opacity:.26, roughness:1, depthWrite:false });
  for (let i=0;i<28;i++) { const cloud = new THREE.Group(); for(let p=0;p<3;p++){ const puff=new THREE.Mesh(new THREE.SphereGeometry(1.5+p*.32,10,8),cloudMat); puff.position.set((p-1)*1.25, Math.sin(p*2)*.35, 0); cloud.add(puff); } cloud.position.set((Math.random()>.5?1:-1)*(8+Math.random()*20), 3+Math.random()*11, -Math.random()*155); cloud.scale.setScalar(.55+Math.random()*1.3); world.add(cloud); cloudBank.push(cloud); }
  for (let i=0;i<10;i++) { const ship=new THREE.Group(); const hull=box(1.25,.22,.48,'#d6b16c'); const cockpit=box(.35,.16,.32,'#25454a'); cockpit.position.set(.18,.17,0); ship.add(hull,cockpit); ship.position.set((i%2?1:-1)*(7+Math.random()*10), 2.5+Math.random()*7, -12-Math.random()*120); ship.userData={ speed:.9+Math.random()*1.8, drift:Math.random()*6, direction:i%2?1:-1 }; world.add(ship); skyTraffic.push(ship); }
}

function makePlayer() {
  const p = new THREE.Group();
  const body = box(.75, 1.05, .5, '#d26542'); body.position.y = .76; p.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.34, 12, 10), material('#e7bb91')); head.position.y = 1.52; head.castShadow = true; p.add(head);
  const visor = box(.5, .14, .05, '#19343b'); visor.position.set(0, 1.57, -.31); p.add(visor);
  const pack = box(.48, .58, .22, '#27484a'); pack.position.set(0, .85, .34); p.add(pack);
  const armL = box(.16, .72, .17, '#d26542'); armL.position.set(-.52, .82, 0); p.add(armL);
  const armR = box(.16, .72, .17, '#d26542'); armR.position.set(.52, .82, 0); p.add(armR);
  const legL = box(.19, .7, .21, '#253d3e'); legL.position.set(-.22, -.27, .03); p.add(legL);
  const legR = box(.19, .7, .21, '#253d3e'); legR.position.set(.22, -.27, .03); p.add(legR);
  p.userData = { body, head, pack, armL, armR, legL, legR };
  p.position.y = 0; return p;
}
const player = makePlayer(); world.add(player);
const landingRing = new THREE.Mesh(new THREE.RingGeometry(.18, .28, 20), new THREE.MeshBasicMaterial({ color: '#e7bd75', transparent: true, opacity: 0, side: THREE.DoubleSide }));
landingRing.rotation.x = -Math.PI / 2; landingRing.position.y = .015; world.add(landingRing);
const boostTrail = Array.from({ length: 8 }, (_, i) => { const streak = new THREE.Mesh(new THREE.BoxGeometry(.035,.035,.55), new THREE.MeshBasicMaterial({ color:'#efc77f', transparent:true, opacity:0 })); streak.userData.delay = i*.045; world.add(streak); return streak; });
buildWorld();

function applySkin() { const skin = skins[progress.skin] || skins[0]; player.userData.body.material.color.set(skin.body); player.userData.armL.material.color.set(skin.body); player.userData.armR.material.color.set(skin.body); player.userData.pack.material.color.set(skin.pack); }
function renderProgress() {
  $('profile-best').textContent = `${String(progress.best).padStart(4,'0')}m`; $('profile-crystals').textContent = String(progress.totalCrystals).padStart(3,'0'); $('daily-status').textContent = progress.dailyDone ? '航线完成' : `0 / ${dailyTarget}m`;
  $('skin-select').innerHTML = skins.map((skin, index) => { const unlocked = progress.totalCrystals >= skin.unlock; return `<button type="button" class="skin${progress.skin === index ? ' is-selected' : ''}${unlocked ? '' : ' is-locked'}" data-skin="${index}" ${unlocked ? '' : 'disabled'}><i style="--skin:${skin.body}"></i>${unlocked ? skin.name : `${skin.unlock} 晶体解锁`}</button>`; }).join('');
  document.querySelectorAll('[data-skin]').forEach(button => { button.onclick = () => { progress.skin = Number(button.dataset.skin); localStorage.setItem('skyline-skin', String(progress.skin)); applySkin(); renderProgress(); }; });
}
applySkin(); renderProgress();
$('sound-toggle').textContent = audio.muted ? '声音 关' : '声音 开';
$('sound-toggle').onclick = () => { audio.muted = !audio.muted; localStorage.setItem('skyline-muted', String(audio.muted)); if (!audio.muted) { unlockAudio(); tone(480,.08,'sine',.035,90); } $('sound-toggle').textContent = audio.muted ? '声音 关' : '声音 开'; };
$('haptic-toggle').textContent = haptics.enabled ? '触感 开' : '触感 关';
$('haptic-toggle').onclick = () => { haptics.enabled = !haptics.enabled; localStorage.setItem('skyline-haptics', String(haptics.enabled)); if (haptics.enabled) haptic(16); $('haptic-toggle').textContent = haptics.enabled ? '触感 开' : '触感 关'; };

function addEntity(kind, lane, z, y = .45) {
  const g = new THREE.Group(); g.userData = { kind, lane, radius: kind === 'obstacle' ? .75 : .44, alive: true, phase: Math.random() * 6 };
  if (kind === 'obstacle') { const m = box(1.45, 1.25, .7, '#b8553f'); m.position.y = .61; g.add(m); const band = box(1.55, .18, .76, '#d9b66c'); band.position.y = .78; g.add(band); }
  if (kind === 'barrier') { const m = box(1.5, .35, .52, '#b8553f'); m.position.y = 1.3; g.add(m); g.userData.radius = .68; }
  if (kind === 'drone') { const core = new THREE.Mesh(new THREE.IcosahedronGeometry(.43), material('#d8b368', .28)); core.castShadow = true; g.add(core); for (const x of [-.6,.6]) { const arm = box(.9,.06,.06,'#273b3d'); arm.position.x = x/2; g.add(arm); } g.userData.radius = .62; }
  if (kind === 'coin') { const m = new THREE.Mesh(new THREE.OctahedronGeometry(.24), material('#d8b368', .45)); m.rotation.z = .5; g.add(m); }
  if (kind === 'shield' || kind === 'magnet' || kind === 'boost') { const colors = { shield:'#61a59b', magnet:'#d8b368', boost:'#dc764e' }; const m = new THREE.Mesh(new THREE.IcosahedronGeometry(.3), material(colors[kind], .5)); g.add(m); }
  g.position.set(lanes[lane], y, z); dynamic.add(g); return g;
}

function spawnRow() {
  const z = -62; const r = Math.random();
  if (r < .16) { const lane = Math.floor(Math.random()*3); for (let i = 0; i < 5; i++) addEntity('coin', lane, z - i*1.35, .72 + Math.sin(i*.8)*.24); }
  else if (r < .28) addEntity(['shield','magnet','boost'][Math.floor(Math.random()*3)], Math.floor(Math.random()*3), z);
  else if (r < .41) { addEntity('drone', Math.floor(Math.random()*3), z); }
  else { const open = Math.floor(Math.random()*3); for (let l=0;l<3;l++) if (l !== open && Math.random() > .28) addEntity(Math.random() > .62 ? 'barrier' : 'obstacle', l, z); }
}

function reset() {
  unlockAudio();
  while (dynamic.children.length) dynamic.remove(dynamic.children[0]);
  Object.assign(state, { mode: 'RUNNING', lane: 1, y: 0, vy: 0, sliding: 0, speed: 14, distance: 0, coins: 0, combo: 0, multiplier: 1, comboTimer: 0, shield: false, magnet: 0, boost: 0, shake: 0, spawn: 1, wasAirborne: false, landPulse: 0, chapter: 0 });
  player.position.set(0, 0, 0); player.scale.set(1,1,1);
  $('start-screen').classList.add('is-hidden'); $('pause-screen').classList.add('is-hidden'); $('gameover-screen').classList.add('is-hidden'); $('hud').classList.remove('is-hidden');
}
function showToast(message) { const el = $('toast'); el.textContent = message; el.classList.add('is-visible'); clearTimeout(showToast.t); showToast.t = setTimeout(() => el.classList.remove('is-visible'), 1150); }
function end() { state.mode = 'OVER'; haptic([18,45,72]); sfx('hit'); const distance = Math.floor(state.distance); progress.best = Math.max(progress.best, distance); state.best = progress.best; progress.totalCrystals += state.coins; progress.history = [{ distance, coins: state.coins }, ...progress.history].slice(0, 5); if (distance >= dailyTarget && !progress.dailyDone) { progress.dailyDone = true; localStorage.setItem('skyline-daily', dailyKey); } localStorage.setItem('skyline-best', progress.best); localStorage.setItem('skyline-crystals', progress.totalCrystals); localStorage.setItem('skyline-history', JSON.stringify(progress.history)); $('final-distance').textContent = `${distance}m`; $('final-coins').textContent = state.coins; $('best-score').textContent = `最远记录 ${progress.best}m`; $('daily-result').textContent = progress.dailyDone ? '今日航线已完成' : `今日航线：抵达 ${dailyTarget}m`; $('history').innerHTML = progress.history.map((run, index) => `<span>${index + 1}. ${run.distance}m <b>${run.coins}</b></span>`).join(''); renderProgress(); $('gameover-screen').classList.remove('is-hidden'); }
function powerup(kind) { haptic(20); sfx('power'); if (kind === 'shield') { state.shield = true; showToast('防护层已激活'); } if (kind === 'magnet') { state.magnet = 7; showToast('晶体牵引已激活'); } if (kind === 'boost') { state.boost = 3.5; showToast('极速通行'); } }
function collectCrystal() { haptic(7); sfx('coin'); state.coins++; state.combo++; state.comboTimer = 2.35; state.multiplier = Math.min(5, 1 + Math.floor(state.combo / 8)); }
function breakCombo() { if (state.combo >= 8) showToast('连击中断'); state.combo = 0; state.multiplier = 1; state.comboTimer = 0; }

function update(dt, time) {
  if (state.mode === 'RUNNING') {
    const cruiseSpeed = Math.min(31, 14 + state.distance * .0085);
    state.speed = cruiseSpeed + (state.boost > 0 ? 8 : 0);
    state.distance += state.speed * dt * 1.55 * state.multiplier; state.spawn -= dt;
    if (state.spawn <= 0) { spawnRow(); state.spawn = Math.max(.52, 1.18 - state.distance / 1200); }
    const nextChapter = Math.min(chapterPalettes.length - 1, Math.floor(state.distance / 700));
    if (nextChapter !== state.chapter) { state.chapter = nextChapter; showToast(`进入 ${chapterPalettes[nextChapter].name}`); }
    state.magnet = Math.max(0, state.magnet-dt); state.boost = Math.max(0, state.boost-dt); state.sliding = Math.max(0, state.sliding-dt); state.comboTimer -= dt;
    if (state.comboTimer <= 0 && state.combo > 0) breakCombo();
    state.vy -= 26*dt; state.y = Math.max(0, state.y + state.vy*dt); if (!state.y && state.vy < 0) state.vy = 0;
    if (state.wasAirborne && !state.y) { state.landPulse = 1; state.shake = Math.max(state.shake, .22); sfx('land'); }
    state.wasAirborne = state.y > .02;
    player.position.x += (lanes[state.lane] - player.position.x) * Math.min(1, dt*15); player.position.y = state.y;
    const lateral = lanes[state.lane]-player.position.x;
    player.rotation.z += (lateral*.18 - player.rotation.z) * Math.min(1, dt*12);
    const stride = time*.019 * (state.speed / 14);
    const motion = player.userData;
    if (state.y > .02) { motion.armL.rotation.x = -.72; motion.armR.rotation.x = -.72; motion.legL.rotation.x = .38; motion.legR.rotation.x = .38; player.rotation.x += (-.17-player.rotation.x)*Math.min(1,dt*10); }
    else if (state.sliding > 0) { motion.armL.rotation.x = .82; motion.armR.rotation.x = .82; motion.legL.rotation.x = .92; motion.legR.rotation.x = .92; player.rotation.x += (.42-player.rotation.x)*Math.min(1,dt*13); }
    else { const swing = Math.sin(stride)*.72; motion.armL.rotation.x = swing; motion.armR.rotation.x = -swing; motion.legL.rotation.x = -swing; motion.legR.rotation.x = swing; player.rotation.x += (0-player.rotation.x)*Math.min(1,dt*12); motion.body.position.y = .76 + Math.abs(Math.sin(stride))* .045; motion.head.position.y = 1.52 + Math.abs(Math.sin(stride))* .045; motion.pack.position.y = .85 + Math.abs(Math.sin(stride))* .035; }
    player.scale.y += ((state.sliding ? .56 : 1) - player.scale.y) * Math.min(1, dt*16);
    for (const child of [...dynamic.children]) {
      child.position.z += state.speed*dt; child.rotation.y += dt*2;
      if (child.userData.kind === 'drone') child.position.x = lanes[child.userData.lane] + Math.sin(time*.0028 + child.userData.phase) * 1.15;
      if (child.userData.kind !== 'obstacle' && child.userData.kind !== 'barrier') child.position.y += Math.sin(time*.004 + child.userData.phase)*dt*.12;
      if (child.position.z > 7) { dynamic.remove(child); continue; }
      const dx = Math.abs(child.position.x-player.position.x), dz = Math.abs(child.position.z), dy = Math.abs(child.position.y-(state.y+.7));
      if (child.userData.kind === 'coin' && state.magnet && child.position.z < 6) child.position.x += (player.position.x-child.position.x)*dt*8;
      if (dx < child.userData.radius && dz < .7 && dy < 1.08) {
        const kind = child.userData.kind;
        if (kind === 'coin') { collectCrystal(); dynamic.remove(child); }
        else if (kind === 'shield' || kind === 'magnet' || kind === 'boost') { powerup(kind); dynamic.remove(child); }
        else if (state.boost > 0) { dynamic.remove(child); }
        else if (state.shield) { state.shield = false; state.shake = .55; dynamic.remove(child); showToast('防护层已消耗'); }
        else if ((kind === 'obstacle' && state.y < .63) || (kind === 'barrier' && state.sliding <= 0) || kind === 'drone') { state.shake = 1; breakCombo(); end(); }
      }
      if ((child.userData.kind === 'obstacle' || child.userData.kind === 'barrier' || child.userData.kind === 'drone') && !child.userData.nearMiss && child.position.z > -.25 && child.position.z < .9 && dx < child.userData.radius + .48 && dy < 1.15) {
        const safelyAvoided = (child.userData.kind === 'obstacle' && state.y > .64) || (child.userData.kind === 'barrier' && state.sliding > 0) || (child.userData.kind === 'drone' && dx > child.userData.radius);
        if (safelyAvoided) { child.userData.nearMiss = true; sfx('near'); state.distance += 18 * state.multiplier; state.shake = .12; showToast(`惊险闪避  +${18 * state.multiplier}m`); }
      }
    }
  }
  const palette = chapterPalettes[state.chapter];
  scene.background.lerp(palette.sky, Math.min(1, dt*.22));
  scene.fog.color.lerp(palette.fog, Math.min(1, dt*.22));
  sun.color.lerp(palette.sun, Math.min(1, dt*.22));
  cloudBank.forEach((cloud, index) => { cloud.position.x += Math.sin(time*.0002 + index)*dt*.05; cloud.rotation.y = Math.sin(time*.00016 + index)*.08; });
  skyTraffic.forEach((ship, index) => { ship.position.x += ship.userData.direction*ship.userData.speed*dt; ship.position.y += Math.sin(time*.0013 + ship.userData.drift)*dt*.18; ship.rotation.z = ship.userData.direction*.08; if (Math.abs(ship.position.x)>23) { ship.position.x = -ship.userData.direction*23; ship.position.z = -14-Math.random()*125; } });
  state.landPulse = Math.max(0, state.landPulse-dt*2.6);
  landingRing.position.x = player.position.x; landingRing.scale.setScalar(1 + (1-state.landPulse)*5.4); landingRing.material.opacity = state.landPulse*.58;
  boostTrail.forEach((streak, i) => { const visible = state.mode === 'RUNNING' && state.boost > 0; streak.visible = visible; streak.position.set(player.position.x + (Math.sin(i*7.1)*.4), .42 + (i%3)*.18, .8 + i*.48); streak.material.opacity = visible ? .36*(1-i/10) : 0; });
  track.children.forEach(s => { s.position.z += state.mode === 'RUNNING' ? state.speed*dt : 0; if (s.position.z > 10) s.position.z -= 150; });
  const intensity = state.shake * state.shake*.18; state.shake = Math.max(0, state.shake-dt*2.8);
  camera.position.x += (player.position.x*.46 - camera.position.x)*Math.min(1,dt*5); camera.position.y += (4.4 - Math.min(.55, state.speed/60) - camera.position.y)*Math.min(1,dt*4);
  camera.position.x += (Math.random()-.5)*intensity; camera.lookAt(player.position.x*.18, 1.05+state.y*.12, -5);
  $('distance').textContent = `${String(Math.floor(state.distance)).padStart(4,'0')}m`; $('coins').textContent = state.coins; $('combo').textContent = `x${state.multiplier}`; $('speed').textContent = Math.floor(state.speed);
  $('powerups').innerHTML = `${state.shield ? '<span>防护</span>' : ''}${state.magnet > 0 ? `<span>牵引 ${Math.ceil(state.magnet)}s</span>` : ''}${state.boost > 0 ? `<span>极速 ${Math.ceil(state.boost)}s</span>` : ''}`;
}

function move(dir) { if (state.mode === 'RUNNING') { const previous = state.lane; state.lane = THREE.MathUtils.clamp(state.lane+dir,0,2); if (previous !== state.lane) { haptic(8); sfx('lane'); } } }
function action(type) { if (state.mode !== 'RUNNING') return; if (type === 'jump' && !state.y) { haptic(13); state.vy = 9.6; sfx('jump'); } if (type === 'slide' && !state.y) { haptic(9); state.sliding = .7; sfx('slide'); } }
function cutJump() { if (state.vy > 3.6) state.vy = 3.6; }
addEventListener('keydown', (e) => { if (e.code === 'KeyP' || e.code === 'Escape') { if(state.mode==='RUNNING'){state.mode='PAUSED';$('pause-screen').classList.remove('is-hidden')}else if(state.mode==='PAUSED'){state.mode='RUNNING';$('pause-screen').classList.add('is-hidden')} return; } if(e.code==='ArrowLeft'||e.code==='KeyA')move(-1); if(e.code==='ArrowRight'||e.code==='KeyD')move(1); if(e.code==='ArrowUp'||e.code==='KeyW'||e.code==='Space'){e.preventDefault();action('jump')} if(e.code==='ArrowDown'||e.code==='KeyS')action('slide'); });
addEventListener('keyup', (e) => { if (e.code==='ArrowUp'||e.code==='KeyW'||e.code==='Space') cutJump(); });
let touch = null; addEventListener('touchstart', e => { touch = e.changedTouches[0]; }, {passive:true}); addEventListener('touchend', e => { if (!touch) return; const t=e.changedTouches[0], dx=t.clientX-touch.clientX, dy=t.clientY-touch.clientY; if(Math.max(Math.abs(dx),Math.abs(dy))>22){if(Math.abs(dx)>Math.abs(dy))move(dx>0?1:-1);else action(dy<0?'jump':'slide')} touch=null; }, {passive:true});
document.querySelectorAll('[data-control]').forEach(button => button.addEventListener('pointerdown', (event) => { event.preventDefault(); const control = button.dataset.control; if (control === 'left') move(-1); else if (control === 'right') move(1); else action(control); }));
$('start-button').onclick = reset; $('restart-button').onclick = reset; $('resume-button').onclick = () => { state.mode='RUNNING'; $('pause-screen').classList.add('is-hidden'); };
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.mode==='RUNNING'){state.mode='PAUSED';$('pause-screen').classList.remove('is-hidden')}});
function resizeRenderer() {
  const viewport = window.visualViewport || window;
  const width = Math.round(viewport.width || innerWidth); const height = Math.round(viewport.height || innerHeight);
  camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height, false);
}
function tuneMobileQuality(dt) {
  if (!touchDevice) return;
  frameQuality.elapsed += dt; frameQuality.frames++;
  if (frameQuality.elapsed < 2) return;
  const averageFrame = frameQuality.elapsed / frameQuality.frames;
  if (averageFrame > 1 / 42 && renderPixelRatio > .85) {
    renderPixelRatio = Math.max(.85, renderPixelRatio - .15); renderer.setPixelRatio(renderPixelRatio); resizeRenderer(); frameQuality.stableWindows = 0; showToast('已调整为流畅画质');
  } else if (averageFrame < 1 / 56 && renderPixelRatio < 1.15) {
    frameQuality.stableWindows++;
    if (frameQuality.stableWindows >= 3) { renderPixelRatio = Math.min(1.15, renderPixelRatio + .1); renderer.setPixelRatio(renderPixelRatio); resizeRenderer(); frameQuality.stableWindows = 0; }
  } else frameQuality.stableWindows = 0;
  frameQuality.elapsed = 0; frameQuality.frames = 0;
}
addEventListener('resize', resizeRenderer); window.visualViewport?.addEventListener('resize', resizeRenderer);
let lastFrame = performance.now();
function frame(time) { const dt = Math.min(.05, (time - lastFrame) / 1000); lastFrame = time; tuneMobileQuality(dt); update(dt, time); renderer.render(scene,camera); }
renderer.setAnimationLoop(frame);
