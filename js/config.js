// 全局配置常量
export const CONFIG = {
  // 赛道
  laneWidth: 2.4,          // 单车道宽
  laneX: [-2.4, 0, 2.4],   // 三车道 x 坐标
  segmentLength: 24,       // 每段赛道长度
  segmentCount: 10,        // 场上赛道段数
  recycleZ: -12,           // 玩家身后该值即回收

  // 速度
  startSpeed: 12,          // 初始前跑速度 m/s
  maxSpeed: 34,
  accel: 0.25,             // 每秒加速度

  // 玩家
  moveLerp: 12,            // 换道插值速度
  jumpVelocity: 9.5,
  gravity: 26,
  slideTime: 0.65,         // 滑铲持续秒数

  // 生成
  obstacleChance: 0.55,    // 每行有障碍的概率（随难度上升）
  coinRows: 5,             // 金币串长度
};
