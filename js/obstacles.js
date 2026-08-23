import * as THREE from 'three';
import { CONFIG } from './config.js';

// 共享几何与材质
const matLow   = new THREE.MeshLambertMaterial({ color: 0xc0563b });
const matHigh  = new THREE.MeshLambertMaterial({ color: 0x8a5fbd });
const matWall  = new THREE.MeshLambertMaterial({ color: 0x4a6b8a });
const matCoin  = new THREE.MeshLambertMaterial({ color: 0xffc93c, emissive: 0x664400 });

const geoLow   = new THREE.BoxGeometry(2.1, 0.7, 0.5);
const geoHigh  = new THREE.BoxGeometry(2.1, 0.9, 0.5);   // 悬空横梁，下方可滑过
const geoWall  = new THREE.BoxGeometry(2.1, 2.2, 0.5);
const geoCoin  = new THREE.CylinderGeometry(0.35, 0.35, 0.08, 12);
const geoPu    = new THREE.OctahedronGeometry(0.42, 0);
const matPu = {
  magnet: new THREE.MeshLambertMaterial({ color: 0x3d8bff, emissive: 0x102a55 }),
  shield: new THREE.MeshLambertMaterial({ color: 0x35d07f, emissive: 0x0a3a20 }),
  sprint: new THREE.MeshLambertMaterial({ color: 0xff5db1, emissive: 0x4a0f30 }),
};

// 每种类型的碰撞半尺寸 {hx, hy, hz} 与中心高度
const TYPES = {
  low:  { geo: geoLow,  mat: matLow,  hy: 0.35, y: 0.35, boxY: 0.35 },  // 需跳
  high: { geo: geoHigh, mat: matHigh, hy: 0.45, y: 1.45, boxY: 1.45 },  // 需滑铲
  wall: { geo: geoWall, mat: matWall, hy: 1.1,  y: 1.1,  boxY: 1.1 },   // 需绕行
};

function addObstacle(seg, type, lane, z) {
  const t = TYPES[type];
  const m = new THREE.Mesh(t.geo, t.mat);
  m.position.set(CONFIG.laneX[lane], t.y, z);
  m.userData.obstacle = { hx: 1.05, hy: t.hy, hz: 0.25 };
  seg.add(m);
}

function addCoin(seg, lane, z, y = 1) {
  const m = new THREE.Mesh(geoCoin, matCoin);
  m.rotation.x = Math.PI / 2;
  m.position.set(CONFIG.laneX[lane], y, z);
  m.userData.coin = { collected: false, hx: 0.55, hy: 0.55, hz: 0.55 };
  seg.add(m);
}

function addPowerup(seg, z) {
  const type = ['magnet', 'shield', 'sprint'][(Math.random() * 3) | 0];
  const m = new THREE.Mesh(geoPu, matPu[type]);
  m.position.set(CONFIG.laneX[(Math.random() * 3) | 0], 1.1, z);
  m.userData.powerup = { type, hx: 0.6, hy: 0.6, hz: 0.6 };
  seg.add(m);
}

function addCoinLine(seg, lane, zStart) {
  for (let i = 0; i < CONFIG.coinRows; i++) addCoin(seg, lane, zStart - i * 1.4);
}

// 在一个赛道段内生成障碍与金币；difficulty 0~1 提升障碍密度
export function populateSegment(seg, baseChance = 0.55) {
  const rows = [0.55, -0.45]; // 段内两行可能的生成位（局部 z）
  // 概率刷一个道具
  if (Math.random() < 0.18) addPowerup(seg, rows[(Math.random() * 2) | 0]);
  for (const rz of rows) {
    if (Math.random() > baseChance) {
      // 无障碍行 → 概率放金币串
      if (Math.random() < 0.5) addCoinLine(seg, (Math.random() * 3) | 0, rz);
      continue;
    }
    const lanes = [0, 1, 2];
    const type = ['low', 'high', 'wall'][(Math.random() * 3) | 0];
    if (type === 'wall') {
      // 墙堵 1~2 条道，其余道可通行；偶尔伴随金币提示路线
      const blocked = Math.random() < 0.5 ? 1 : 2;
      lanes.sort(() => Math.random() - 0.5);
      for (let i = 0; i < blocked; i++) addObstacle(seg, 'wall', lanes[i], rz);
      const free = lanes[blocked];
      if (Math.random() < 0.5) addCoinLine(seg, free, rz);
    } else {
      // low/high 横杆可放多道
      const n = 1 + ((Math.random() * 2) | 0) + (Math.random() < 0.3 ? 1 : 0);
      lanes.sort(() => Math.random() - 0.5);
      for (let i = 0; i < Math.min(n, 2); i++) addObstacle(seg, type, lanes[i], rz);
      if (n <= 2 && Math.random() < 0.4) addCoin(seg, lanes[2], rz, type === 'low' ? 2.2 : 0.6);
    }
  }
}

export function clearSegment(seg) {
  for (let i = seg.children.length - 1; i >= 0; i--) {
    const c = seg.children[i];
    if (c.userData.obstacle || c.userData.coin || c.userData.powerup) seg.remove(c);
  }
}
