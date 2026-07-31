const BEDROOM_MANIFEST = {
  schemaVersion: 'echo-world-manifest.v1',
  id: 'flooded-bedroom',
  title: '被水淹没的旧卧室',
  assets: {
    splat: 'bedroom.spz',
    collider: 'bedroom-collider.glb',
  },
  transform: {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  },
  spawn: {
    position: [0, 1.2, -2.4],
    yaw: 0,
  },
  movementBounds: {
    minX: -5.35,
    maxX: 5.35,
    minZ: -5.8,
    maxZ: 7.8,
    floorY: 0,
  },
  collision: {
    mode: 'glb',
    asset: 'bedroom-collider.glb',
    boxes: [
      { name: 'floor', half: [5.8, 0.08, 7.4], position: [0, -0.08, 0.8] },
      { name: 'north-wall', half: [5.8, 2.5, 0.08], position: [0, 2.5, -6.15] },
      { name: 'south-wall', half: [5.8, 2.5, 0.08], position: [0, 2.5, 8.15] },
      { name: 'west-wall', half: [0.08, 2.5, 7.2], position: [-5.7, 2.5, 1] },
      { name: 'east-wall', half: [0.08, 2.5, 7.2], position: [5.7, 2.5, 1] },
    ],
  },
  environment: {
    background: 0x07090a,
    waterLevel: 0.4,
    waterActiveDepth: 0.42,
  },
  entry: {
    loadingKicker: 'ECHO / 2008',
    loadingTitle: '正在进入那年的房间……',
    loadingDetail: '正在唤醒记忆中的光线',
    readyTitle: '房间已经想起你了',
    readyDetail: '点击画面进入 · Esc 退出鼠标控制',
    effect: 'fade',
  },
  evidenceHotspots: [
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
  ],
  echo: {
    position: [0.55, 0.412, -5.25],
    hotspotOffset: [0, 0, 0],
    interactionRadius: 2.35,
    color: 0xcde4dc,
    lightColor: 0x8bd6ca,
    unlock: {
      type: 'all-evidence',
    },
    nearbyObject:
      '水面里出现了另一个自己的倒影。她只记得这条可能世界里已经发生的事，不自动知道现实中的用户后来怎样生活。',
  },
}

export const WORLD_MANIFESTS = Object.freeze({
  [BEDROOM_MANIFEST.id]: BEDROOM_MANIFEST,
})

export function resolveWorldManifest(worldId) {
  const requested =
    worldId ||
    readWorldIdFromLocation() ||
    readWorldIdFromState() ||
    BEDROOM_MANIFEST.id
  return freezeManifest(
    WORLD_MANIFESTS[requested] || WORLD_MANIFESTS[BEDROOM_MANIFEST.id],
  )
}

export function resolveWorldAssetUrl(assetPath) {
  if (!assetPath) return ''
  if (/^(https?:|data:|blob:|\/)/.test(assetPath)) return assetPath
  if (typeof window === 'undefined') return `/world/${assetPath}`
  return new URL(assetPath, window.location.href).toString()
}

function readWorldIdFromLocation() {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get('world') || ''
}

function readWorldIdFromState() {
  if (typeof window === 'undefined') return ''
  try {
    const state = JSON.parse(localStorage.getItem('echo.worldState') || '{}')
    return typeof state?.worldId === 'string' ? state.worldId : ''
  } catch {
    return ''
  }
}

function freezeManifest(manifest) {
  validateWorldManifest(manifest)
  return Object.freeze(structuredClone(manifest))
}

export function validateWorldManifest(manifest) {
  const requiredVectors = [
    manifest?.transform?.position,
    manifest?.transform?.rotation,
    manifest?.transform?.scale,
    manifest?.spawn?.position,
    manifest?.echo?.position,
  ]
  if (
    manifest?.schemaVersion !== 'echo-world-manifest.v1' ||
    !manifest?.id ||
    !manifest?.assets?.splat ||
    !['glb', 'boxes'].includes(manifest?.collision?.mode) ||
    requiredVectors.some(
      (vector) =>
        !Array.isArray(vector) ||
        vector.length !== 3 ||
        vector.some((item) => !Number.isFinite(item)),
    ) ||
    !Array.isArray(manifest?.evidenceHotspots) ||
    manifest.evidenceHotspots.length < 1
  ) {
    throw new Error(`Invalid Echo World Manifest: ${manifest?.id || 'unknown'}`)
  }
  if (manifest.collision.mode === 'glb' && !manifest.collision.asset) {
    throw new Error(`World ${manifest.id} requires collision.asset`)
  }
  return manifest
}

export { BEDROOM_MANIFEST }
