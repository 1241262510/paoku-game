import * as THREE from 'three';
import { Game } from './game.js';

// 渲染器
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.prepend(renderer.domElement);

// 场景与雾
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fd4e8);
scene.fog = new THREE.Fog(0x9fd4e8, 40, 110);

// 灯光
const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x4a7a4a, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d0, 1.2);
sun.position.set(8, 14, 6);
scene.add(sun);

// 第三人称跟随相机
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 200);
camera.position.set(0, 4.2, 7);
camera.lookAt(0, 1.2, -6);

const game = new Game(scene, camera);
const player = game.player.mesh;

// 场景主题：随跑动距离从白天丛林 → 黄昏 → 夜晚渐变
const THEMES = [
  { at: 0,    bg: 0x9fd4e8, sun: 0xfff2d0, sunI: 1.2, ground: 0x4c8a54, edge: 0x3c6a44 },
  { at: 600,  bg: 0xe8927a, sun: 0xffb37a, sunI: 1.0, ground: 0x8a7040, edge: 0x6e5836 },
  { at: 1200, bg: 0x1c2a4a, sun: 0x8aa6ff, sunI: 0.5, ground: 0x2e4a52, edge: 0x243c44 },
];
const cA = new THREE.Color(), cB = new THREE.Color();
function applyTheme(score) {
  let i = 0;
  while (i < THEMES.length - 2 && score > THEMES[i + 1].at) i++;
  const a = THEMES[i], b = THEMES[i + 1];
  const t = Math.max(0, Math.min(1, (score - a.at) / (b.at - a.at)));
  const mix = (key, target) => {
    cA.setHex(a[key]); cB.setHex(b[key]);
    target.copy(cA).lerp(cB, t);
  };
  mix('bg', scene.background); scene.fog.color.copy(scene.background);
  mix('sun', sun.color);
  sun.intensity = a.sunI + (b.sunI - a.sunI) * t;
  mix('ground', game.track.groundMat.color);
  mix('edge', game.track.edgeMat.color);
}

// 主循环
const clock = new THREE.Clock();
const camLook = new THREE.Vector3(0, 1.3, -6);
const camBase = { x: 0, y: 4.2 };
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05); // 防大步长穿模
  game.update(dt);
  applyTheme(game.score);

  // 相机跟随：帧率无关的指数平滑，x 半程跟随玩家制造甩尾感
  const e = 1 - Math.exp(-5 * dt);
  camBase.x += (player.position.x * 0.55 - camBase.x) * e;
  // 速度感：随速度轻微拉低视角 + 动态 FOV
  const speedT = Math.max(0, Math.min(1, (game.speed - 12) / 22)); // 0~1
  camBase.y += (4.2 - speedT * 0.5 - camBase.y) * e;
  const targetFov = 60 + speedT * 10;
  camera.fov += (targetFov - camera.fov) * e;
  camera.updateProjectionMatrix();

  // 撞击震动：叠加在平滑基准位置之上（不污染基准值）
  let shx = 0, shy = 0;
  if (game.shake > 0.01) {
    const s = game.shake * game.shake * 0.35;
    shx = (Math.random() - 0.5) * 2 * s;
    shy = (Math.random() - 0.5) * 2 * s;
  }
  camera.position.set(camBase.x + shx, camBase.y + shy, 7);

  // 注视点也平滑跟随，避免 lookAt 突变
  camLook.x += (player.position.x * 0.4 - camLook.x) * (1 - Math.exp(-7 * dt));
  camera.lookAt(camLook.x, 1.3, -6);

  renderer.render(scene, camera);
}
tick();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
