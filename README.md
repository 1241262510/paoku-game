# 丛林酷跑 3D

基于 Three.js 的神庙逃亡式 3D 跑酷网页游戏，零外部素材（程序化几何 + Web Audio 合成音效），纯静态文件无需构建。

🎮 **在线游玩**：https://conglin-kupao.netlify.app

## 玩法

- 角色自动前跑，速度随时间提升
- **← → / A D** 左右换道，**↑ / W / 空格** 跳跃，**↓ / S** 滑铲（手机滑动手势同理）
- 红色矮栏→跳，紫色悬空梁→滑铲，蓝色高墙→绕行
- 收集金币，捡道具：🧲 磁铁吸金币、🛡 护盾抵一次撞击、⚡ 冲刺加速无敌
- Esc / P 暂停；最高分本地保存

## 特性

- 无尽赛道：分段生成 + 对象池复用
- 难度曲线：障碍密度随距离 0.45 → 0.85
- 昼夜主题渐变（白天丛林 → 黄昏 → 夜晚）
- 角色动画：跑动摆臂、换道侧倾、跳跃挤压拉伸、空中收腿
- 死亡慢动作 + 相机震动、起跑无敌保护
- Three.js 已本地化（`vendor/`），完全离线可用

## 运行

```bash
# 任意静态服务器，例如：
python3 -m http.server 8765
# 打开 http://localhost:8765
```

## 结构

```
index.html        # 入口 + HUD + 面板
js/main.js        # 场景/灯光/相机/主循环/主题渐变
js/game.js        # 状态机、碰撞、道具、计分
js/player.js      # 角色与操作手感
js/track.js       # 无尽赛道
js/obstacles.js   # 障碍/金币/道具生成
js/audio.js       # Web Audio 合成音效
vendor/           # Three.js r160（本地化）
skyline-runner/   # 另一个 Vite 实验项目
```

## 部署

```bash
npx netlify-cli deploy --dir . --prod --site-name conglin-kupao
```
