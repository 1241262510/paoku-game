import * as THREE from 'three';
import { CONFIG } from './config.js';
import { populateSegment, clearSegment } from './obstacles.js';

const SEG_LEN = CONFIG.segmentLength;
const TOTAL_LEN = SEG_LEN * CONFIG.segmentCount;

// 侧边装饰：低多边形树 / 石头
function makeTree() {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.26, 1.4, 5),
    new THREE.MeshLambertMaterial({ color: 0x7a4a2b }));
  trunk.position.y = 0.7;
  const crown = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 2.6, 6),
    new THREE.MeshLambertMaterial({ color: 0x2e7d4f }));
  crown.position.y = 2.5;
  g.add(trunk, crown);
  return g;
}

function makeRock() {
  const m = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.7, 0),
    new THREE.MeshLambertMaterial({ color: 0x8d9498, flatShading: true }));
  m.position.y = 0.4;
  m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
  return m;
}

export class Track {
  constructor(scene) {
    this.scene = scene;
    this.segments = [];
    this.nextSpawnZ = 20; // 下一行障碍的 z 位置（世界坐标，段内换算）

    const groundMat = this.groundMat = new THREE.MeshLambertMaterial({ color: 0x4c8a54 });
    const edgeMat = this.edgeMat = new THREE.MeshLambertMaterial({ color: 0x3c6a44 });

    for (let i = 0; i < CONFIG.segmentCount; i++) {
      const seg = new THREE.Group();

      // 地面（略宽于三车道）+ 两侧路缘
      const ground = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.5, SEG_LEN), groundMat);
      ground.position.y = -0.25;
      seg.add(ground);
      for (const side of [-1, 1]) {
        const edge = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, SEG_LEN), edgeMat);
        edge.position.set(side * 4.3, 0.05, 0);
        seg.add(edge);
        // 每段两侧随机 2~3 个装饰
        for (let d = 0; d < 3; d++) {
          const deco = Math.random() < 0.7 ? makeTree() : makeRock();
          deco.position.set(side * (5.5 + Math.random() * 4), 0,
            -SEG_LEN / 2 + Math.random() * SEG_LEN);
          seg.add(deco);
        }
      }

      seg.position.z = 8 - i * SEG_LEN; // 从玩家前方往后排
      scene.add(seg);
      this.segments.push(seg);
    }
    // 前两段留空作为起跑缓冲
    populateSegment(this.segments[2], 0.35);
    for (let i = 3; i < this.segments.length; i++) {
      populateSegment(this.segments[i], 0.55);
    }
  }

  // 世界前移 dz；越过后回收到最远端并重新生成内容（chance 为障碍概率）
  update(dz, chance = 0.55) {
    for (const seg of this.segments) {
      seg.position.z += dz;
      if (seg.position.z - SEG_LEN / 2 > CONFIG.recycleZ + SEG_LEN) {
        seg.position.z -= TOTAL_LEN;
        clearSegment(seg);
        populateSegment(seg, chance);
      }
    }
  }
}
