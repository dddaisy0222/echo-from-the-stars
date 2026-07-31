# Echo World 接入说明｜给场景与动效同学

## 你只需要交付什么

每个 World 是一组资产和一个 Manifest：

```text
public/world/
├── your-world.spz
└── your-world-collider.glb

app/world/engine/world-manifest.js
└── YOUR_WORLD_MANIFEST
```

- `SPZ`：Marble 导出的视觉世界，由 Spark 渲染。
- `GLB`：同一坐标系下的低模碰撞世界，由 Three.js Octree 读取。
- `Manifest`：告诉运行时出生点、边界、证据热点、Echo 位置和入场动效。

不要修改 Echo Prompt、聊天接口或记忆代码。

## 复制这份 Manifest

```js
const YOUR_WORLD_MANIFEST = {
  schemaVersion: 'echo-world-manifest.v1',
  id: 'your-world-id',
  title: '这个世界的中文名称',

  assets: {
    splat: 'your-world.spz',
    collider: 'your-world-collider.glb',
  },

  // SPZ 和 GLB 共用一套变换。两份资产必须在导出时对齐。
  transform: {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  },

  spawn: {
    position: [0, 1.2, 0],
    yaw: 0,
  },

  // 这是性能和安全兜底范围，不代替 GLB 碰撞。
  movementBounds: {
    minX: -10,
    maxX: 10,
    minZ: -10,
    maxZ: 10,
    floorY: 0,
  },

  collision: {
    mode: 'glb',
    asset: 'your-world-collider.glb',
    // GLB 失效时才使用 boxes，至少保留地板和四面边界。
    boxes: [
      { name: 'floor', half: [10, 0.1, 10], position: [0, -0.1, 0] },
    ],
  },

  environment: {
    background: 0x07090a,
    waterLevel: -100,       // 没有水就放到地面以下
    waterActiveDepth: 0,
  },

  entry: {
    loadingKicker: 'ECHO / WORLD 02',
    loadingTitle: '正在进入……',
    loadingDetail: '正在加载这个世界',
    readyTitle: '世界已经准备好了',
    readyDetail: '点击画面进入 · Esc 退出鼠标控制',
    effect: 'your-entry-effect',
  },

  // id 要与 Oracle 事件 polarity 对应：gain / cost / truth。
  evidenceHotspots: [
    { id: 'gain', position: [1, 0.05, -2], radius: 1.2, color: 0xe6c588, phase: 0 },
    { id: 'cost', position: [-1, 0.05, -3], radius: 1.2, color: 0xd89b8b, phase: 2.1 },
    { id: 'truth', position: [0, 0.05, -5], radius: 1.3, color: 0x9bc9ba, phase: 4.2 },
  ],

  echo: {
    position: [0, 0.05, -6],
    hotspotOffset: [0, 0, 0],
    interactionRadius: 2.35,
    color: 0xcde4dc,
    lightColor: 0x8bd6ca,
    unlock: { type: 'all-evidence' },
    nearbyObject: '描述 Echo 此刻所在的物体或位置；这会进入对话证据。',
  },
}
```

把它加进同文件的 `WORLD_MANIFESTS`：

```js
export const WORLD_MANIFESTS = Object.freeze({
  'flooded-bedroom': BEDROOM_MANIFEST,
  'your-world-id': YOUR_WORLD_MANIFEST,
})
```

访问 `/world?world=your-world-id` 即可测试。

## 如何接你做的入场动效

在 `app/world/engine/entry-effects.js` 注册一个名字：

```js
registerWorldEntryEffect(
  'your-entry-effect',
  async ({ manifest, scene, camera, renderer, worldRoot }) => {
    // 这里写 GSAP、Web Animations 或 Three.js 动画。
    // Promise 完成后，用户才会进入正常交互。
  },
)
```

然后把 Manifest 的 `entry.effect` 写成同一个名字。

动效函数能够拿到：

- `manifest`：当前世界的全部配置
- `scene`：Three.js Scene
- `camera`：第一人称 Camera
- `renderer`：WebGLRenderer
- `worldRoot`：SPZ 所在的共同根节点

## 资产导出约束

1. SPZ 和 GLB 必须共享原点、朝向、单位和缩放。
2. GLB 只保留低模碰撞，不需要材质和贴图。
3. 出生点不能落在墙、桌面或封闭网格内。
4. 三个热点和 Echo 坐标必须在可行走区域。
5. GLB 建议只保留地面、墙、台阶和真正阻挡玩家的物体。
6. `transform` 是最后校准入口；不要分别给 SPZ、GLB 两套变换。

## Echo 与画面之间的边界

Manifest 只负责“世界中客观存在什么”。Oracle 负责生成这个世界的得到、代价和矛盾，Echo 只基于已发生的世界证据说话。

你不需要接这些文件：

- `agent-system/`：Prompt、Schema 和评测
- `lib/echo-runtime.ts`：Echo 事实门禁
- `worker/index.ts`：模型 API
- `app/lib/echo-memory.ts`：对话与世界记忆

## 联调验收

- `/world?world=your-world-id` 能加载 SPZ。
- 控制台显示 `GLB 边界`，而不是兜底边界。
- 出生后不会掉出世界或卡进墙。
- 三个热点都能靠近并按 E 收集。
- 收齐后 Echo 出现，按 E 能打开对话。
- Echo 的对话上下文中 `sceneId` 等于 Manifest 的 `id`。
- 入场动效结束后才能正常行走。
