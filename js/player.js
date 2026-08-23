import * as THREE from 'three';
import { CONFIG } from './config.js';

// 组合几何体小人（低多边形）
function buildCharacter() {
  const g = new THREE.Group();
  const skin  = new THREE.MeshLambertMaterial({ color: 0xf0b98a });
  const shirt = new THREE.MeshLambertMaterial({ color: 0xe05545 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x33507a });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.35), shirt);
  body.position.y = 0.95;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skin);
  head.position.y = 1.52;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.6, 0.25), pants);
  legL.position.set(-0.16, 0.3, 0);
  const legR = legL.clone(); legR.position.x = 0.16;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.55, 0.2), shirt);
  armL.position.set(-0.4, 1.0, 0);
  const armR = armL.clone(); armR.position.x = 0.4;
  g.add(body, head, legL, legR, armL, armR);
  g.userData.limbs = { legL, legR, armL, armR, body, head };
  return g;
}

export class Player {
  constructor(scene) {
    this.mesh = buildCharacter();
    this.mesh.position.set(0, 0, 0);
    scene.add(this.mesh);

    this.lane = 1;
    this.y = 0;
    this.vy = 0;
    this.onGround = true;
    this.sliding = 0;      // 剩余滑铲时间
    this.runPhase = 0;     // 跑动摆臂相位
    this.lateralV = 0;     // 横向速度（用于倾斜特效）
    this.landSquash = 0;   // 落地挤压计时
    this.jumpStretch = 0;  // 起跳拉伸计时
  }

  moveLane(dir) {
    const next = Math.min(2, Math.max(0, this.lane + dir));
    this.lane = next;
  }

  jump() {
    if (this.onGround) {
      this.vy = CONFIG.jumpVelocity;
      this.onGround = false;
      this.sliding = 0;
      this.jumpStretch = 0.18;   // 起跳瞬间拉伸
    }
  }

  slide() {
    if (this.onGround) this.sliding = CONFIG.slideTime;
  }

  get collider() {
    const sliding = this.sliding > 0;
    return {
      x: this.mesh.position.x,
      y: this.y + (sliding ? 0.4 : 0.9),
      z: 0,
      hx: 0.32,
      hy: sliding ? 0.4 : 0.9,
      hz: 0.25,
    };
  }

  update(dt, speed) {
    // 左右换道：先加速后减速的平滑追踪（critically-damped 风格）
    const targetX = CONFIG.laneX[this.lane];
    const prevX = this.mesh.position.x;
    const k = 1 - Math.exp(-CONFIG.moveLerp * dt); // 帧率无关的指数平滑
    this.mesh.position.x += (targetX - this.mesh.position.x) * k;
    this.lateralV = dt > 0 ? (this.mesh.position.x - prevX) / dt : 0;

    // 竖直运动
    if (!this.onGround) {
      this.vy -= CONFIG.gravity * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        this.y = 0; this.vy = 0; this.onGround = true;
        this.landSquash = 0.22;  // 落地瞬间挤压
      }
    }
    if (this.sliding > 0) this.sliding -= dt;
    if (this.jumpStretch > 0) this.jumpStretch -= dt;
    if (this.landSquash > 0) this.landSquash -= dt;

    this.mesh.position.y = this.y;

    const s = this.sliding > 0;
    const e = 1 - Math.exp(-14 * dt); // 姿势过渡的帧率无关平滑

    // 呼吸感跑动：身体轻微上下浮动
    this.runPhase += dt * speed * 0.9;
    const bob = (this.onGround && !s && speed > 0)
      ? Math.abs(Math.sin(this.runPhase * 0.5)) * 0.06 : 0;
    this.mesh.position.y = this.y + bob;

    // 挤压拉伸（跳跃起跳拉伸 / 落地挤压，快速衰减）
    let sy = 1, sxz = 1;
    if (this.jumpStretch > 0) {
      const t = this.jumpStretch / 0.18;
      sy = 1 + 0.25 * t; sxz = 1 - 0.15 * t;
    } else if (this.landSquash > 0) {
      const t = this.landSquash / 0.22;
      sy = 1 - 0.3 * t * t; sxz = 1 + 0.18 * t * t;
    }
    const targetSy = (s ? 0.5 : 1) * sy;
    const targetSxz = (s ? 1.25 : 1) * sxz;
    this.mesh.scale.y += (targetSy - this.mesh.scale.y) * e;
    this.mesh.scale.x += (targetSxz - this.mesh.scale.x) * e;
    this.mesh.scale.z += (targetSxz - this.mesh.scale.z) * e;

    // 姿态：滑铲前倾 + 换道侧倾（随横向速度）+ 换道朝向偏转
    const targetRotX = s ? -0.9 : 0;
    const targetRotZ = Math.max(-0.35, Math.min(0.35, -this.lateralV * 0.045));
    const targetRotY = Math.max(-0.4, Math.min(0.4, -this.lateralV * 0.05));
    this.mesh.rotation.x += (targetRotX - this.mesh.rotation.x) * e;
    this.mesh.rotation.z += (targetRotZ - this.mesh.rotation.z) * Math.min(1, 10 * dt);
    this.mesh.rotation.y += (targetRotY - this.mesh.rotation.y) * Math.min(1, 8 * dt);

    // 跑动摆臂摆腿；空中收腿举臂
    const { legL, legR, armL, armR } = this.mesh.userData.limbs;
    if (!this.onGround) {
      const t = 1 - Math.exp(-12 * dt);
      legL.rotation.x += (-0.9 - legL.rotation.x) * t;
      legR.rotation.x += ( 0.5 - legR.rotation.x) * t;
      armL.rotation.x += (-2.2 - armL.rotation.x) * t;
      armR.rotation.x += (-2.0 - armR.rotation.x) * t;
    } else if (!s && speed > 0) {
      const swing = Math.sin(this.runPhase) * 0.7;
      legL.rotation.x = swing;  legR.rotation.x = -swing;
      armL.rotation.x = -swing; armR.rotation.x = swing;
    } else {
      const t = 1 - Math.exp(-10 * dt);
      for (const l of [legL, legR, armL, armR]) l.rotation.x += (0 - l.rotation.x) * t;
    }
  }
}
