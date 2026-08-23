import * as THREE from 'three';
import { CONFIG } from './config.js';
import { Player } from './player.js';
import { Track } from './track.js';
import { aabbOverlap } from './collision.js';
import { populateSegment } from './obstacles.js';
import { Sfx } from './audio.js';

const $ = (id) => document.getElementById(id);

export class Game {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.player = new Player(scene);
    this.track = new Track(scene);
    this.state = 'READY';
    this.speed = CONFIG.startSpeed;
    this.score = 0;
    this.coins = 0;
    this.best = +(localStorage.getItem('paoku-best') || 0);
    this.pickupFx = [];
    this.sfx = new Sfx();
    this.grace = 0;        // 起跑无敌倒计时
    // 道具状态：magnet/sprint 为剩余秒数，shield 为布尔
    this.powerups = { magnet: 0, sprint: 0, shield: false };
    this.dieTimer = 0;     // 死亡慢动作剩余时间
    this.shake = 0;        // 相机震动强度 0~1
    this.bindInput();
    $('btn-start').addEventListener('click', () => this.start());
    $('btn-restart').addEventListener('click', () => this.start());
  }

  bindInput() {
    window.addEventListener('keydown', (e) => {
      // 暂停 / 恢复
      if (e.code === 'Escape' || e.code === 'KeyP') {
        this.togglePause();
        return;
      }
      if (this.state !== 'RUNNING') {
        if (e.code === 'Space' || e.code === 'Enter') this.start();
        return;
      }
      switch (e.code) {
        case 'ArrowLeft': case 'KeyA': this.player.moveLane(-1); break;
        case 'ArrowRight': case 'KeyD': this.player.moveLane(1); break;
        case 'ArrowUp': case 'KeyW': case 'Space': this.sfx.jump(); this.player.jump(); break;
        case 'ArrowDown': case 'KeyS': this.sfx.slide(); this.player.slide(); break;
      }
    });
    // 触屏滑动
    let sx = 0, sy = 0;
    window.addEventListener('touchstart', (e) => {
      sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    }, { passive: true });
    window.addEventListener('touchend', (e) => {
      if (this.state !== 'RUNNING') return;
      const dx = e.changedTouches[0].clientX - sx;
      const dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > Math.abs(dy)) {
        this.player.moveLane(dx > 0 ? 1 : -1);
      } else if (dy < 0) { this.sfx.jump(); this.player.jump(); }
      else { this.sfx.slide(); this.player.slide(); }
    }, { passive: true });

    // 切后台自动暂停
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'RUNNING') this.togglePause();
    });
    $('btn-resume').addEventListener('click', () => this.togglePause());
    $('btn-pause-restart').addEventListener('click', () => this.start());
  }

  togglePause() {
    if (this.state === 'RUNNING') {
      this.state = 'PAUSED';
      $('pause-panel').classList.remove('hidden');
    } else if (this.state === 'PAUSED') {
      this.state = 'RUNNING';
      $('pause-panel').classList.add('hidden');
    }
  }

  start() {
    if (this.state === 'RUNNING') return;
    this.sfx.ensure(); // 用户手势中解锁音频
    this.grace = 1.5;
    this.dieTimer = 0;
    this.shake = 0;
    // 清理残留特效
    for (const fx of this.pickupFx) this.scene.remove(fx.mesh);
    this.pickupFx.length = 0;
    // 清空场上障碍，重建赛道内容
    for (const seg of this.track.segments) {
      for (const c of [...seg.children]) {
        if (c.userData.obstacle || c.userData.coin || c.userData.powerup) seg.remove(c);
      }
    }
    for (let i = 2; i < this.track.segments.length; i++) {
      // 重新填充（通过 obstacles 接口）
      populateSegment(this.track.segments[i], 0.55);
    }
    this.player.lane = 1;
    this.player.y = 0; this.player.vy = 0; this.player.onGround = true; this.player.sliding = 0;
    this.speed = CONFIG.startSpeed;
    this.score = 0; this.coins = 0;
    this.powerups = { magnet: 0, sprint: 0, shield: false };
    this.updatePowerupBar();
    this.state = 'RUNNING';
    $('start-panel').classList.add('hidden');
    $('over-panel').classList.add('hidden');
    $('pause-panel').classList.add('hidden');
    this.updateHUD();
  }

  gameOver() {
    this.state = 'DYING';
    this.dieTimer = 0.9;
    this.shake = 1;
    this.sfx.crash();
  }

  showGameOver() {
    this.state = 'GAMEOVER';
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem('paoku-best', String(this.best));
    }
    $('over-score').textContent = Math.floor(this.score);
    $('over-coins').textContent = this.coins;
    $('over-best').textContent = Math.floor(this.best);
    $('over-panel').classList.remove('hidden');
  }

  updateHUD() {
    $('hud-score').textContent = Math.floor(this.score);
    $('hud-coins').textContent = this.coins;
    $('hud-speed').textContent = Math.floor(this.speed);
  }

  checkCollisions() {
    const p = this.player.collider;
    for (const seg of this.track.segments) {
      const segZ = seg.position.z;
      for (const c of seg.children) {
        const ud = c.userData;
        if (!ud.obstacle && !ud.coin && !ud.powerup) continue;
        const wz = segZ + c.position.z;
        if (Math.abs(wz) > 2.5) continue; // 快速剔除（磁铁吸附需要更大范围）
        const box = ud.obstacle ?? ud.coin ?? ud.powerup;
        const other = { x: c.position.x, y: c.position.y, z: wz, hx: box.hx, hy: box.hy, hz: box.hz };
        if (ud.powerup) {
          if (aabbOverlap(p, other)) this.applyPowerup(ud.powerup.type, seg, c);
          continue;
        }
        if (!aabbOverlap(p, other)) continue;
        if (ud.coin) {
          if (!ud.coin.collected) {
            ud.coin.collected = true;
            seg.remove(c);
            this.coins++;
            this.sfx.coin();
            this.spawnPickupFx(c.position.x, c.position.y, wz);
          }
        } else if (this.grace <= 0 && this.powerups.sprint <= 0) {
          // 冲刺中直接撞碎障碍；护盾抵消一次
          if (this.powerups.shield) {
            this.powerups.shield = false;
            this.grace = Math.max(this.grace, 1.0); // 短暂无敌
            this.shake = 0.5;
            this.sfx.shield();
            seg.remove(c);
            this.spawnPickupFx(c.position.x, c.position.y, wz, 0x35d07f);
          } else {
            this.gameOver();
            return;
          }
        }
      }
    }
  }

  // 磁铁：附近金币被吸向玩家（改其局部坐标）
  attractCoins(dt) {
    const px = this.player.mesh.position.x;
    for (const seg of this.track.segments) {
      const segZ = seg.position.z;
      for (const c of seg.children) {
        if (!c.userData.coin) continue;
        const wz = segZ + c.position.z;
        if (wz > 3 || wz < -14) continue; // 只吸前方近距离
        const k = Math.min(1, 8 * dt);
        c.position.x += (px - c.position.x) * k;
        c.position.y += (1 - c.position.y) * k;
        c.position.z += (0 - wz) * k * 0.8;
      }
    }
  }

  // 左下角道具状态栏
  updatePowerupBar() {
    const bar = $('powerup-bar');
    const items = [];
    if (this.powerups.magnet > 0) items.push(['🧲 磁铁', Math.ceil(this.powerups.magnet)]);
    if (this.powerups.shield) items.push(['🛡 护盾', '']);
    if (this.powerups.sprint > 0) items.push(['⚡ 冲刺', Math.ceil(this.powerups.sprint)]);
    const html = items.map(([t, s]) =>
      `<div class="pu${s === 1 || (s !== '' && s <= 2) ? ' weak' : ''}">${t}${s !== '' ? ' ' + s + 's' : ''}</div>`).join('');
    if (bar.innerHTML !== html) bar.innerHTML = html;
  }

  applyPowerup(type, seg, mesh) {
    seg.remove(mesh);
    this.sfx.powerup();
    if (type === 'magnet') this.powerups.magnet = 6;
    else if (type === 'sprint') this.powerups.sprint = 3;
    else this.powerups.shield = true;
    this.spawnPickupFx(mesh.position.x, mesh.position.y,
      seg.position.z + mesh.position.z,
      type === 'magnet' ? 0x3d8bff : type === 'sprint' ? 0xff5db1 : 0x35d07f);
  }

  // 收集特效：图形放大并淡出消散（默认金币色，可指定颜色）
  spawnPickupFx(x, y, z, color = 0xffe27a) {
    const fx = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 0.08, 12),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }));
    fx.rotation.x = Math.PI / 2;
    fx.position.set(x, y, z);
    this.scene.add(fx);
    this.pickupFx.push({ mesh: fx, life: 0.35, age: 0 });
  }

  update(dt) {
    if (this.state === 'PAUSED') return;
    if (this.state === 'DYING') {
      // 死亡慢动作：世界急停 + 相机震动 + 角色后仰倒地，随后弹结算面板
      this.dieTimer -= dt;
      this.shake = Math.max(0, this.shake - dt * 1.4);
      const slow = Math.max(0.08, this.dieTimer / 0.9) * 0.35;
      const sdt = dt * slow;
      this.track.update(this.speed * sdt);
      this.speed = Math.max(0, this.speed - 30 * sdt);
      this.player.update(sdt, 0);
      this.player.mesh.rotation.x += (-1.5 - this.player.mesh.rotation.x) * Math.min(1, 8 * dt);
      this.player.mesh.position.z += 4 * dt; // 被撞得向后弹
      if (this.dieTimer <= 0) {
        this.player.mesh.rotation.x = 0;
        this.player.mesh.position.z = 0;
        this.player.mesh.visible = true;
        this.showGameOver();
      }
      return;
    }
    if (this.state !== 'RUNNING') {
      this.player.update(dt, 0);
      return;
    }
    if (this.grace > 0) {
      this.grace -= dt;
      // 无敌期角色闪烁提示
      this.player.mesh.visible = Math.floor(this.grace * 10) % 2 === 0;
      if (this.grace <= 0) this.player.mesh.visible = true;
    }
    // 道具计时
    if (this.powerups.magnet > 0) this.powerups.magnet -= dt;
    if (this.powerups.sprint > 0) this.powerups.sprint -= dt;
    // 冲刺加速：超出常规速度上限的临时加成
    const sprintBonus = this.powerups.sprint > 0 ? 8 : 0;
    this.speed = Math.min(CONFIG.maxSpeed, this.speed + CONFIG.accel * dt);
    const dz = (this.speed + sprintBonus) * dt;
    this.score += dz;
    // 难度曲线：障碍密度随距离从 0.45 升至 0.85
    const diff = Math.min(1, this.score / 1500);
    this.track.update(dz, 0.45 + 0.4 * diff);
    this.player.update(dt, this.speed + sprintBonus);
    this.checkCollisions();
    this.updatePowerupBar();
    // 磁铁：把附近金币吸向玩家
    if (this.powerups.magnet > 0) this.attractCoins(dt);
    if (this.state === 'RUNNING') this.updateHUD();

    // 金币/道具旋转
    for (const seg of this.track.segments) {
      for (const c of seg.children) {
        if (c.userData.coin) c.rotation.z += dt * 4;
        else if (c.userData.powerup) { c.rotation.y += dt * 2.5; c.rotation.x += dt * 1.2; }
      }
    }

    // 收集特效更新：放大 + 上飘 + 淡出，并随世界前移
    for (let i = this.pickupFx.length - 1; i >= 0; i--) {
      const fx = this.pickupFx[i];
      fx.age += dt;
      const t = fx.age / fx.life;
      if (t >= 1) {
        this.scene.remove(fx.mesh);
        fx.mesh.geometry.dispose();
        fx.mesh.material.dispose();
        this.pickupFx.splice(i, 1);
        continue;
      }
      fx.mesh.position.z += this.speed * dt;
      fx.mesh.position.y += dt * 1.5;
      const s = 1 + t * 1.6;
      fx.mesh.scale.set(s, s, s);
      fx.mesh.material.opacity = 0.9 * (1 - t);
    }
  }
}
