// 简单 AABB 碰撞：以中心坐标 + 半尺寸判断
export function aabbOverlap(a, b) {
  return Math.abs(a.x - b.x) < a.hx + b.hx &&
         Math.abs(a.y - b.y) < a.hy + b.hy &&
         Math.abs(a.z - b.z) < a.hz + b.hz;
}
