export const ASSET_URLS = Object.freeze({
  splat:
    typeof window !== 'undefined'
      ? new URL('bedroom.spz', window.location.href).toString()
      : '/world/bedroom.spz',
})

// SPZ 和 collider 都挂在同一个 worldRoot 下。方向、比例或位置需要校准时，
// 只修改这一处；物理网格会在创建前应用包含该变换在内的 matrixWorld。
export const WORLD_TRANSFORM = Object.freeze({
  position: [0, 0, 0],
  // 配套 collider GLB 的根矩阵已经包含 Marble → Three.js 的 X 轴翻转。
  // SPZ 与它在导出坐标中已经对齐，不要在共同根节点上再次翻转。
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
})

export const SPARK_RENDER_CONFIG = Object.freeze({
  maxPixelRatio: 2.25,
  lodSplatCount: 4_000_000,
  lodSplatScale: 2,
  lodRenderScale: 0.6,
  meshLodScale: 1.75,
  blurAmount: 0.08,
  focalAdjustment: 1.5,
  maxStdDev: 2.45,
  sortRadial: false,
})

export const PLAYER_CONFIG = Object.freeze({
  totalHeight: 1.76,
  radius: 0.3,
  eyeHeight: 1.62,
  walkSpeed: 2.0,
  briskSpeed: 2.45,
  acceleration: 7.5,
  deceleration: 10.5,
  airControl: 0.28,
  jumpSpeed: 3.8,
  mouseSensitivity: 0.0018,
  maxPitch: Math.PI / 2 - 0.06,
  headBobAmplitude: 0.014,
  headBobFrequency: 8.5,
  waterSpeedMultiplier: 0.85,
})

export const PHYSICS_CONFIG = Object.freeze({
  gravity: -9.81,
  maxFallSpeed: -18,
  fixedTimeStep: 1 / 60,
  maxSubSteps: 4,
  controllerOffset: 0.025,
  snapToGround: 0.18,
  autostepHeight: 0.2,
  autostepMinWidth: 0.24,
  maxSlopeClimbAngle: Math.PI * (44 / 180),
  minSlopeSlideAngle: Math.PI * (50 / 180),
  colliderFriction: 0.75,
  safetyHeight: -4,
})

// 应用 GLB 自带 matrixWorld 后，真实地板约在 Y=0，水面约在 Y=0.4。
// waterSurfaceFilter 会从单个 geometry_0 trimesh 的索引中剔除水面薄层，
// 仍然只为整个 mesh 创建一个 Rapier collider。
export const WATER_LEVEL = 0.4

export const WATER_CONFIG = Object.freeze({
  activeDepth: 0.42,
  waterSurfaceFilter: {
    enabled: true,
    minY: 0.18,
    maxY: 0.58,
    horizontalNormalThreshold: 0.96,
  },
})

// Rapier capsule 的原点在胶囊中心。这个出生点位于房间较开阔的中部，
// 会在启动后受重力落到真实地板上。
export const SPAWN_POINT = Object.freeze({
  position: [0, 1.2, -2.4],
  yaw: 0,
})

// 出生点前方偏右约 2 米。按 J 显示 1.2 米调试球后，可只改 position
// 将中心移动到 SPZ 画面中的蓝绿色圆片位置。
export const MEMORY_HOTSPOT_CONFIGS = Object.freeze([
  {
    id: 'gain',
    position: [1.2, 0.43, -4.0],
    radius: 1.18,
    color: 0xe6c588,
    phase: 0,
  },
  {
    id: 'cost',
    position: [-1.25, 0.43, -3.55],
    radius: 1.18,
    color: 0xd89b8b,
    phase: 2.1,
  },
  {
    id: 'truth',
    position: [0.05, 0.43, -5.55],
    radius: 1.3,
    color: 0x9bc9ba,
    phase: 4.2,
  },
])

// “另一个自己”不是实体 NPC。三件证据被看见后，她只作为水面里不随你移动的倒影出现。
export const CHARACTER_CONFIG = Object.freeze({
  position: [0.55, 0.412, -5.25],
  hotspotOffset: [0, 0, 0],
  interactionRadius: 2.35,
  color: 0xcde4dc,
  lightColor: 0x8bd6ca,
})

export const DEBUG_CONFIG = Object.freeze({
  COLLIDER_DEBUG: false,
  PANEL_VISIBLE: false,
  suspiciousHorizontalArea: 0.35,
  debugColor: 0x56e0ff,
})
