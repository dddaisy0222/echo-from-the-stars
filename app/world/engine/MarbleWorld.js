import * as THREE from 'three'
import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { Capsule } from 'three/addons/math/Capsule.js'
import { Octree } from 'three/addons/math/Octree.js'
import { CharacterHotspot } from './CharacterHotspot.js'
import { runWorldEntryEffect } from './entry-effects.js'
import { MemoryHotspot } from './MemoryHotspot.js'
import {
  readEchoMemory,
  rememberWorldEvidence,
} from '../../lib/echo-memory.ts'
import {
  DEBUG_CONFIG,
  PHYSICS_CONFIG,
  PLAYER_CONFIG,
  SPARK_RENDER_CONFIG,
  WATER_CONFIG,
} from './config.js'
import {
  resolveWorldAssetUrl,
  resolveWorldManifest,
} from './world-manifest.js'

const UP = new THREE.Vector3(0, 1, 0)
const FORWARD = new THREE.Vector3(0, 0, -1)
const RIGHT = new THREE.Vector3(1, 0, 0)

export function mountMarbleWorld(container, options = {}) {
  const experience = new MarbleWorld(container, options)
  experience.start()
  return experience
}

class MarbleWorld {
  constructor(container, options = {}) {
    this.container = container
    this.manifest = options.manifest || resolveWorldManifest(options.worldId)
    this.entryEffect = options.entryEffect || runWorldEntryEffect
    this.worldOctree = new Octree()
    this.playerCollider = null
    this.keys = new Set()
    this.isPointerLocked = false
    this.usesFallbackControls = false
    this.isReady = false
    this.isInteractionPaused = false
    this.isGrounded = false
    this.isInWater = false
    this.verticalVelocity = 0
    this.horizontalVelocity = new THREE.Vector2()
    this.physicsAccumulator = 0
    this.lastTime = performance.now()
    this.fps = 0
    this.fpsFrames = 0
    this.fpsElapsed = 0
    this.headBobTime = 0
    this.stepTimer = 0
    this.colliderCount = 0
    this.colliderDebugVisible = DEBUG_CONFIG.COLLIDER_DEBUG
    this.panelVisible = DEBUG_CONFIG.PANEL_VISIBLE
    this.debugMeshes = []
    this.isDestroyed = false
    this.animationFrame = 0
    this.worldState = readWorldState()
    this.collectedMemories = new Set()

    this.renderShell()
    this.setupThree()
    this.setupInteractions()
    this.bindEvents()
  }

  async start() {
    try {
      await this.initializeWorld()
      this.animate()
      await this.entryEffect(this.manifest.entry.effect, {
        manifest: this.manifest,
        scene: this.scene,
        camera: this.camera,
        renderer: this.renderer,
        worldRoot: this.worldRoot,
      })
      this.isReady = true
      this.loadingStatus.textContent = this.manifest.entry.readyTitle
      this.loadingDetail.textContent = this.manifest.entry.readyDetail
      this.loadingOverlay.classList.add('is-ready', 'is-paused')
      this.enterButton.hidden = false
    } catch (error) {
      this.showFatalError(error)
      throw error
    }
  }

  renderShell() {
    this.container.innerHTML = `
      <main class="world-shell">
        <div class="world-canvas" data-world-canvas></div>
        <div class="loading-overlay" data-loading-overlay>
          <div class="loading-card">
            <p class="loading-kicker">${escapeHtml(this.manifest.entry.loadingKicker)}</p>
            <h1 data-loading-status>${escapeHtml(this.manifest.entry.loadingTitle)}</h1>
            <p data-loading-detail>${escapeHtml(this.manifest.entry.loadingDetail)}</p>
            <div class="loading-track"><span data-loading-progress></span></div>
            <button type="button" data-enter-world hidden>点击进入</button>
          </div>
        </div>
        <div class="crosshair" aria-hidden="true"></div>
        <aside class="debug-panel" data-debug-panel ${DEBUG_CONFIG.PANEL_VISIBLE ? '' : 'hidden'}>
          <div class="debug-heading">
            <span>WORLD DIAGNOSTICS</span><span>P 隐藏</span>
          </div>
          <dl>
            <div><dt>SPZ</dt><dd data-debug-spz>等待中</dd></div>
            <div><dt>COLLIDER</dt><dd data-debug-collider>等待中</dd></div>
            <div><dt>BOUNDARY</dt><dd data-debug-rapier>等待中</dd></div>
            <div><dt>POSITION</dt><dd data-debug-position>—</dd></div>
            <div><dt>GROUNDED</dt><dd data-debug-grounded>false</dd></div>
            <div><dt>SPEED</dt><dd data-debug-speed>0.00 m/s</dd></div>
            <div><dt>COLLIDERS</dt><dd data-debug-count>0</dd></div>
            <div><dt>FPS</dt><dd data-debug-fps>0</dd></div>
          </dl>
          <p>H 碰撞线框 · R 重置位置</p>
        </aside>
        <div class="echo-progress" data-echo-progress>
          <small>ROOM 01 · 人生证据</small>
          <strong><span data-echo-progress-count>0</span> / 3</strong>
          <p data-echo-progress-copy>找到这条人生得到、失去与未改变的东西</p>
        </div>
        <button class="world-return" type="button" data-return-now>
          <span>离开这条时间线</span>
          <small>带着证据回到现在 ↗</small>
        </button>
        <div class="echo-awakening" data-echo-awakening hidden>
          <small>THE ECHO IS HERE</small>
          <p>水面里的倒影，没有跟着你动。</p>
        </div>
        <div class="world-hint" data-world-hint>
          <span>WASD 行走</span><span>E 触碰回声</span><span>Esc 松开视角</span>
        </div>
        <div class="water-indicator" data-water-indicator>脚下传来很轻的水声</div>
      </main>
    `

    this.canvasHost = this.container.querySelector('[data-world-canvas]')
    this.worldShell = this.container.querySelector('.world-shell')
    this.loadingOverlay = this.container.querySelector('[data-loading-overlay]')
    this.loadingStatus = this.container.querySelector('[data-loading-status]')
    this.loadingDetail = this.container.querySelector('[data-loading-detail]')
    this.loadingProgress = this.container.querySelector('[data-loading-progress]')
    this.enterButton = this.container.querySelector('[data-enter-world]')
    this.debugPanel = this.container.querySelector('[data-debug-panel]')
    this.worldHint = this.container.querySelector('[data-world-hint]')
    this.waterIndicator = this.container.querySelector('[data-water-indicator]')
    this.progressCount = this.container.querySelector('[data-echo-progress-count]')
    this.progressCopy = this.container.querySelector('[data-echo-progress-copy]')
    this.awakeningNotice = this.container.querySelector('[data-echo-awakening]')
    this.returnButton = this.container.querySelector('[data-return-now]')
    this.debugFields = {
      spz: this.container.querySelector('[data-debug-spz]'),
      collider: this.container.querySelector('[data-debug-collider]'),
      rapier: this.container.querySelector('[data-debug-rapier]'),
      position: this.container.querySelector('[data-debug-position]'),
      grounded: this.container.querySelector('[data-debug-grounded]'),
      speed: this.container.querySelector('[data-debug-speed]'),
      count: this.container.querySelector('[data-debug-count]'),
      fps: this.container.querySelector('[data-debug-fps]'),
    }
  }

  setupThree() {
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(
      this.manifest.environment.background,
    )

    this.camera = new THREE.PerspectiveCamera(
      66,
      window.innerWidth / window.innerHeight,
      0.025,
      120,
    )

    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, SPARK_RENDER_CONFIG.maxPixelRatio),
    )
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.canvasHost.appendChild(this.renderer.domElement)

    this.worldRoot = new THREE.Group()
    this.worldRoot.name = 'worldRoot'
    this.worldRoot.position.fromArray(this.manifest.transform.position)
    this.worldRoot.rotation.fromArray(this.manifest.transform.rotation)
    this.worldRoot.scale.fromArray(this.manifest.transform.scale)
    this.scene.add(this.worldRoot)

    this.playerRoot = new THREE.Object3D()
    this.playerRoot.name = 'playerBody'
    this.pitchRoot = new THREE.Object3D()
    this.pitchRoot.name = 'playerPitch'
    this.playerRoot.add(this.pitchRoot)
    this.pitchRoot.add(this.camera)
    this.camera.position.y =
      PLAYER_CONFIG.eyeHeight - PLAYER_CONFIG.totalHeight / 2
    this.scene.add(this.playerRoot)

    this.spark = new SparkRenderer({
      renderer: this.renderer,
      enableLod: true,
      enableLodFetching: true,
      lodSplatCount: SPARK_RENDER_CONFIG.lodSplatCount,
      lodSplatScale: SPARK_RENDER_CONFIG.lodSplatScale,
      lodRenderScale: SPARK_RENDER_CONFIG.lodRenderScale,
      blurAmount: SPARK_RENDER_CONFIG.blurAmount,
      focalAdjustment: SPARK_RENDER_CONFIG.focalAdjustment,
      maxStdDev: SPARK_RENDER_CONFIG.maxStdDev,
      sortRadial: SPARK_RENDER_CONFIG.sortRadial,
    })
    this.spark.name = 'sparkRenderer'
    this.scene.add(this.spark)
  }

  setupInteractions() {
    const memories = createMemoryObjects(this.worldState)
    this.memoryHotspots = this.manifest.evidenceHotspots.map((config, index) => {
      const hotspot = new MemoryHotspot({
        scene: this.scene,
        mount: this.worldShell,
        config,
        memory: memories[index],
        onDialogOpen: () => this.setInteractionPaused(true),
        onDialogClose: () => this.setInteractionPaused(false),
        onCollected: (item) => this.collectMemory(item),
      })
      if (hotspot.isCollected) this.collectedMemories.add(hotspot.memory.id)
      return hotspot
    })
    this.updateProgress()

    this.characterHotspot = new CharacterHotspot({
      scene: this.scene,
      mount: this.worldShell,
      config: this.manifest.echo,
      canOpen: () =>
        this.isReady &&
        !this.isInteractionPaused &&
        !this.memoryHotspots.some((hotspot) => hotspot.isDialogOpen),
      canReveal: () => this.collectedMemories.size >= this.memoryHotspots.length,
      getWorldContext: () => this.createChatWorldContext(),
      onDialogOpen: () => {
        this.worldShell.classList.add('has-world-chat')
        this.setInteractionPaused(true)
      },
      onDialogClose: () => {
        this.worldShell.classList.remove('has-world-chat')
        this.setInteractionPaused(false)
      },
    })
  }

  bindEvents() {
    this.handleResize = () => {
      this.camera.aspect = window.innerWidth / window.innerHeight
      this.camera.updateProjectionMatrix()
      this.renderer.setSize(window.innerWidth, window.innerHeight)
      this.renderer.setPixelRatio(
        Math.min(window.devicePixelRatio, SPARK_RENDER_CONFIG.maxPixelRatio),
      )
    }

    this.handlePointerLockChange = () => {
      if (this.usesFallbackControls) return
      this.isPointerLocked = document.pointerLockElement === this.renderer.domElement
      this.loadingOverlay.classList.toggle(
        'is-paused',
        this.isReady && !this.isPointerLocked && !this.isInteractionPaused,
      )
      this.worldHint.classList.toggle('is-visible', this.isPointerLocked)
      if (!this.isPointerLocked) {
        this.keys.clear()
      }
    }

    this.handleMouseMove = (event) => {
      if (!this.isPointerLocked || this.isInteractionPaused) return
      this.playerRoot.rotation.y -= event.movementX * PLAYER_CONFIG.mouseSensitivity
      this.pitchRoot.rotation.x = THREE.MathUtils.clamp(
        this.pitchRoot.rotation.x - event.movementY * PLAYER_CONFIG.mouseSensitivity,
        -PLAYER_CONFIG.maxPitch,
        PLAYER_CONFIG.maxPitch,
      )
      this.playerRoot.rotation.z = 0
      this.pitchRoot.rotation.y = 0
      this.pitchRoot.rotation.z = 0
    }

    this.handleKeyDown = (event) => {
      if (this.characterHotspot.handleKeyDown(event)) return
      if (this.memoryHotspots.some((hotspot) => hotspot.handleKeyDown(event))) return
      if (this.isInteractionPaused) return
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight'].includes(event.code)) {
        this.keys.add(event.code)
      }
      if (event.code === 'Space') {
        event.preventDefault()
        if (!event.repeat && this.isGrounded && this.isPointerLocked) {
          this.verticalVelocity = PLAYER_CONFIG.jumpSpeed
          this.isGrounded = false
        }
      }
      if (event.code === 'KeyR' && !event.repeat) this.resetPlayer()
      if (event.code === 'KeyH' && !event.repeat) this.toggleColliderDebug()
      if (event.code === 'KeyP' && !event.repeat) this.toggleDebugPanel()
    }

    this.handleKeyUp = (event) => this.keys.delete(event.code)

    this.requestPointerLock = async () => {
      if (!this.isReady || this.isInteractionPaused) return
      if (this.usesFallbackControls) {
        this.enterFallbackControls()
        return
      }
      try {
        await this.ensureAudio()
        await this.renderer.domElement.requestPointerLock()
      } catch (error) {
        console.warn('[Echo] 当前容器不支持锁定鼠标，已启用兼容操控')
        this.usesFallbackControls = true
        this.enterFallbackControls()
      }
    }

    window.addEventListener('resize', this.handleResize)
    document.addEventListener('pointerlockchange', this.handlePointerLockChange)
    document.addEventListener('mousemove', this.handleMouseMove)
    document.addEventListener('keydown', this.handleKeyDown)
    document.addEventListener('keyup', this.handleKeyUp)
    this.enterButton.addEventListener('click', this.requestPointerLock)
    this.returnButton.addEventListener('click', () => {
      window.location.href = new URL('../?returned=1', window.location.href).toString()
    })
    this.renderer.domElement.addEventListener('click', this.requestPointerLock)
    this.handleUnhandledRejection = (event) => {
      console.error('[Echo] 未处理的 Promise rejection', event.reason)
    }
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection)
  }

  enterFallbackControls() {
    this.isPointerLocked = true
    this.loadingOverlay.classList.remove('is-paused')
    this.worldHint.classList.add('is-visible')
    this.loadingStatus.textContent = '房间已经想起你了'
    this.loadingDetail.textContent = 'WASD 行走 · 移动鼠标观察 · E 触碰回声'
    this.keys.clear()
    this.renderer.domElement.focus?.()
  }

  async initializeWorld() {
    this.setLoadPhase('正在准备时间的物理规则', 0.08)
    this.debugFields.rapier.textContent = '轻量边界 · 就绪'
    this.createPlayerPhysics()

    this.setLoadPhase('正在唤醒记忆中的光线', 0.16)
    const splatPromise = this.loadSplat()

    this.setLoadPhase('正在辨认房间的边界', 0.2)
    const colliderPromise = this.loadColliderWorld()

    await Promise.all([splatPromise, colliderPromise])
    this.logSpawnFloorProbe()
    this.resetPlayer()
    this.updateDebugPanel()
    console.info('[Echo] 世界资源加载完成', {
      worldId: this.manifest.id,
      worldTransform: this.manifest.transform,
      spawnPoint: this.manifest.spawn,
      waterLevel: this.manifest.environment.waterLevel,
      colliders: this.colliderCount,
    })
  }

  createPlayerPhysics() {
    this.playerPosition = new THREE.Vector3(...this.manifest.spawn.position)
    this.playerPosition.y = PLAYER_CONFIG.totalHeight / 2
    const radius = PLAYER_CONFIG.radius
    const segmentHeight = Math.max(
      0.01,
      PLAYER_CONFIG.totalHeight - radius * 2,
    )
    this.playerCollider = new Capsule(
      new THREE.Vector3(0, radius, 0),
      new THREE.Vector3(0, radius + segmentHeight, 0),
      radius,
    )
    this.isGrounded = true
  }

  async loadSplat() {
    this.splat = new SplatMesh({
      url: resolveWorldAssetUrl(this.manifest.assets.splat),
      lod: true,
      enableLod: true,
      lodScale: SPARK_RENDER_CONFIG.meshLodScale,
      onProgress: (event) => {
        if (!event.total) return
        const ratio = event.loaded / event.total
        this.setLoadPhase(
          `正在唤醒记忆中的光线 · ${Math.round(ratio * 100)}%`,
          0.2 + ratio * 0.48,
        )
      },
    })
    this.splat.name = this.manifest.assets.splat
    this.worldRoot.add(this.splat)
    await this.splat.initialized
    const bounds = this.splat.getBoundingBox()
    this.debugFields.spz.textContent = '加载成功 · LoD 开启'
    console.info('[Echo] SPZ 加载成功', {
      bounds: serializeBox(bounds),
      enableLod: this.splat.enableLod,
      worldTransform: this.manifest.transform,
    })
  }

  async loadColliderWorld() {
    if (this.manifest.collision.mode === 'glb') {
      try {
        const gltf = await new GLTFLoader().loadAsync(
          resolveWorldAssetUrl(this.manifest.collision.asset),
        )
        gltf.scene.position.fromArray(this.manifest.transform.position)
        gltf.scene.rotation.fromArray(this.manifest.transform.rotation)
        gltf.scene.scale.fromArray(this.manifest.transform.scale)
        gltf.scene.updateMatrixWorld(true)
        gltf.scene.traverse((object) => {
          if (!object.isMesh) return
          object.visible = false
          this.colliderCount += 1
        })
        this.scene.add(gltf.scene)
        this.colliderRoot = gltf.scene
        this.worldOctree.fromGraphNode(gltf.scene)
        this.debugFields.collider.textContent =
          `GLB 边界 · ${this.colliderCount} 个网格`
        this.debugFields.count.textContent = String(this.colliderCount)
        this.setLoadPhase('GLB 房间边界已经稳定', 0.42)
        return
      } catch (error) {
        console.warn('[Echo] GLB 碰撞加载失败，使用 manifest 轻量边界', error)
      }
    }

    const boundaries = this.manifest.collision.boxes

    boundaries.forEach((boundary) => {
      this.colliderCount += 1

      const debugMesh = new THREE.Mesh(
        new THREE.BoxGeometry(
          boundary.half[0] * 2,
          boundary.half[1] * 2,
          boundary.half[2] * 2,
        ),
        new THREE.MeshBasicMaterial({
          color: DEBUG_CONFIG.debugColor,
          transparent: true,
          opacity: 0.16,
          wireframe: true,
          depthWrite: false,
        }),
      )
      debugMesh.name = `debug:${boundary.name}`
      debugMesh.position.fromArray(boundary.position)
      debugMesh.visible = this.colliderDebugVisible
      this.scene.add(debugMesh)
      this.debugMeshes.push(debugMesh)
    })

    this.debugFields.collider.textContent = `轻量边界 · ${this.colliderCount} 个`
    this.debugFields.count.textContent = String(this.colliderCount)
    this.setLoadPhase('房间边界已经稳定', 0.42)
  }

  animate = (time = performance.now()) => {
    if (this.isDestroyed) return
    this.animationFrame = requestAnimationFrame(this.animate)
    const frameDelta = Math.min((time - this.lastTime) / 1000, 0.1)
    this.lastTime = time

    if (this.isReady) {
      this.physicsAccumulator += frameDelta
      let steps = 0
      while (
        this.physicsAccumulator >= PHYSICS_CONFIG.fixedTimeStep &&
        steps < PHYSICS_CONFIG.maxSubSteps
      ) {
        this.updatePlayer(PHYSICS_CONFIG.fixedTimeStep)
        this.physicsAccumulator -= PHYSICS_CONFIG.fixedTimeStep
        steps += 1
      }
      if (steps === PHYSICS_CONFIG.maxSubSteps) this.physicsAccumulator = 0
    }

    this.updateFps(frameDelta)
    this.updateDebugPanel()
    this.memoryHotspots.forEach((hotspot) => {
      hotspot.update(this.playerRoot.position, time / 1000)
    })
    this.characterHotspot.update(this.playerRoot.position, time / 1000, {
      worldReady: this.isReady,
      interactionBlocked: this.isInteractionPaused,
    })
    this.renderer.render(this.scene, this.camera)
  }

  updatePlayer(deltaTime) {
    const input = this.getMovementInput()
    const bodyPosition = this.playerPosition
    const capsuleBottom =
      bodyPosition.y - PLAYER_CONFIG.totalHeight / 2
    this.isInWater =
      capsuleBottom <=
        this.manifest.environment.waterLevel +
          this.manifest.environment.waterActiveDepth &&
      capsuleBottom >=
        this.manifest.environment.waterLevel -
          this.manifest.environment.waterActiveDepth * 2

    const speedMultiplier = this.isInWater
      ? PLAYER_CONFIG.waterSpeedMultiplier
      : 1
    const targetSpeed =
      (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')
        ? PLAYER_CONFIG.briskSpeed
        : PLAYER_CONFIG.walkSpeed) * speedMultiplier

    const targetVelocity = input.multiplyScalar(targetSpeed)
    const control = this.isGrounded ? 1 : PLAYER_CONFIG.airControl
    const rate =
      targetVelocity.lengthSq() > 0
        ? PLAYER_CONFIG.acceleration * control
        : PLAYER_CONFIG.deceleration
    this.horizontalVelocity.x = moveTowards(
      this.horizontalVelocity.x,
      targetVelocity.x,
      rate * deltaTime,
    )
    this.horizontalVelocity.y = moveTowards(
      this.horizontalVelocity.y,
      targetVelocity.z,
      rate * deltaTime,
    )

    const current = this.playerPosition
    const bounds = this.manifest.movementBounds
    current.x = THREE.MathUtils.clamp(
      current.x + this.horizontalVelocity.x * deltaTime,
      bounds.minX,
      bounds.maxX,
    )
    current.z = THREE.MathUtils.clamp(
      current.z + this.horizontalVelocity.y * deltaTime,
      bounds.minZ,
      bounds.maxZ,
    )
    current.y =
      bounds.floorY + PLAYER_CONFIG.totalHeight / 2
    this.isGrounded = true

    if (this.colliderRoot && this.playerCollider) {
      const capsule = this.playerCollider
      const currentCenter = capsule.start
        .clone()
        .add(capsule.end)
        .multiplyScalar(0.5)
      const desiredCenter = new THREE.Vector3(
        current.x,
        current.y,
        current.z,
      )
      capsule.translate(desiredCenter.sub(currentCenter))
      for (let iteration = 0; iteration < 4; iteration += 1) {
        const collision = this.worldOctree.capsuleIntersect(capsule)
        if (!collision) break
        capsule.translate(collision.normal.multiplyScalar(collision.depth))
      }
      const resolvedCenter = capsule.start
        .clone()
        .add(capsule.end)
        .multiplyScalar(0.5)
      current.copy(resolvedCenter)
    }

    this.playerRoot.position.set(current.x, current.y, current.z)
    this.updateHeadBob(deltaTime)
    this.updateFootsteps(deltaTime)
    this.waterIndicator.classList.toggle('is-visible', this.isInWater)

    if (current.y < PHYSICS_CONFIG.safetyHeight) {
      console.warn('[Echo] 玩家低于安全高度，自动重置', current)
      this.resetPlayer()
    }
  }

  getMovementInput() {
    if (!this.isPointerLocked || this.isInteractionPaused) {
      return new THREE.Vector3()
    }

    const localX =
      (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0)
    const localZ =
      (this.keys.has('KeyS') ? 1 : 0) - (this.keys.has('KeyW') ? 1 : 0)
    if (localX === 0 && localZ === 0) return new THREE.Vector3()

    const direction = new THREE.Vector3()
      .addScaledVector(RIGHT, localX)
      .addScaledVector(FORWARD, -localZ)
      .normalize()
    direction.applyAxisAngle(UP, this.playerRoot.rotation.y)
    return direction
  }

  updateHeadBob(deltaTime) {
    const horizontalSpeed = this.horizontalVelocity.length()
    const moving = this.isGrounded && horizontalSpeed > 0.12 && this.isPointerLocked
    const baseEyeOffset =
      PLAYER_CONFIG.eyeHeight - PLAYER_CONFIG.totalHeight / 2

    if (moving) {
      this.headBobTime +=
        deltaTime *
        PLAYER_CONFIG.headBobFrequency *
        THREE.MathUtils.clamp(horizontalSpeed / PLAYER_CONFIG.walkSpeed, 0.65, 1.2)
      const bob = Math.sin(this.headBobTime) * PLAYER_CONFIG.headBobAmplitude
      this.camera.position.y = THREE.MathUtils.lerp(
        this.camera.position.y,
        baseEyeOffset + bob,
        0.22,
      )
    } else {
      this.camera.position.y = THREE.MathUtils.lerp(
        this.camera.position.y,
        baseEyeOffset,
        0.18,
      )
    }
    this.camera.position.x = 0
    this.camera.position.z = 0
    this.camera.rotation.z = 0
  }

  updateFootsteps(deltaTime) {
    const speed = this.horizontalVelocity.length()
    if (!this.isGrounded || !this.isPointerLocked || speed < 0.35) {
      this.stepTimer = 0
      return
    }

    this.stepTimer -= deltaTime
    if (this.stepTimer <= 0) {
      this.playFootstep(this.isInWater)
      this.stepTimer = THREE.MathUtils.lerp(0.58, 0.4, speed / PLAYER_CONFIG.briskSpeed)
    }
  }

  async ensureAudio() {
    if (!this.audioContext) {
      this.audioContext = new AudioContext()
    }
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
    }
  }

  playFootstep(inWater) {
    if (!this.audioContext || this.audioContext.state !== 'running') return
    const context = this.audioContext
    const duration = inWater ? 0.13 : 0.07
    const sampleCount = Math.floor(context.sampleRate * duration)
    const buffer = context.createBuffer(1, sampleCount, context.sampleRate)
    const data = buffer.getChannelData(0)
    for (let index = 0; index < sampleCount; index += 1) {
      const envelope = 1 - index / sampleCount
      data[index] = (Math.random() * 2 - 1) * envelope
    }

    const source = context.createBufferSource()
    source.buffer = buffer
    const filter = context.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = inWater ? 760 : 260
    filter.Q.value = inWater ? 0.8 : 1.3
    const gain = context.createGain()
    gain.gain.value = inWater ? 0.028 : 0.016
    source.connect(filter).connect(gain).connect(context.destination)
    source.start()
  }

  resetPlayer() {
    if (!this.playerPosition) return
    const [x, , z] = this.manifest.spawn.position
    const floorY =
      this.manifest.movementBounds.floorY + PLAYER_CONFIG.totalHeight / 2
    this.playerPosition.set(x, floorY, z)
    if (this.playerCollider) {
      const center = this.playerCollider.start
        .clone()
        .add(this.playerCollider.end)
        .multiplyScalar(0.5)
      this.playerCollider.translate(
        new THREE.Vector3(x, floorY, z).sub(center),
      )
    }
    this.playerRoot.position.set(x, floorY, z)
    this.playerRoot.rotation.set(0, this.manifest.spawn.yaw, 0)
    this.pitchRoot.rotation.set(0, 0, 0)
    this.verticalVelocity = 0
    this.horizontalVelocity.set(0, 0)
    this.isGrounded = true
  }

  setInteractionPaused(paused) {
    this.isInteractionPaused = paused
    this.keys.clear()
    this.horizontalVelocity.set(0, 0)
    this.worldShell.classList.toggle('has-memory-dialog', paused)

    if (paused) {
      if (document.pointerLockElement === this.renderer.domElement) {
        document.exitPointerLock()
      }
      this.loadingOverlay.classList.remove('is-paused')
    } else if (!this.isPointerLocked && this.isReady) {
      this.loadingStatus.textContent = '点击画面继续行走'
      this.loadingDetail.textContent = '房间仍在原处，视角也没有改变'
      this.loadingOverlay.classList.add('is-paused')
    }
  }

  collectMemory(item) {
    this.collectedMemories.add(item.id)
    rememberWorldEvidence(item)
    rememberTimelineChoice(this.worldState, item)
    this.updateProgress()

    if (this.collectedMemories.size === this.memoryHotspots.length) {
      this.progressCopy.textContent = '三件证据已经完整。去看房间深处的水面。'
      this.awakeningNotice.hidden = false
      requestAnimationFrame(() => {
        this.awakeningNotice.classList.add('is-visible')
      })
      window.clearTimeout(this.awakeningTimer)
      this.awakeningTimer = window.setTimeout(() => {
        this.awakeningNotice.classList.remove('is-visible')
        window.setTimeout(() => {
          this.awakeningNotice.hidden = true
        }, 500)
      }, 5200)
    }
  }

  updateProgress() {
    if (!this.progressCount) return
    this.progressCount.textContent = String(this.collectedMemories.size)
    if (this.collectedMemories.size === 0) {
      this.progressCopy.textContent = '找到这条人生得到、失去与未改变的东西'
    } else if (this.collectedMemories.size < this.memoryHotspots.length) {
      this.progressCopy.textContent =
        `还差 ${this.memoryHotspots.length - this.collectedMemories.size} 件人生证据`
    } else {
      this.progressCopy.textContent = '去看房间深处的水面'
    }
  }

  createChatWorldContext() {
    const playerPosition = this.playerRoot.position
    const collectedItems = this.memoryHotspots
      .filter((hotspot) => hotspot.isCollected)
      .map(
        (hotspot) =>
          `${hotspot.memory.name}：${hotspot.memory.reveal}`,
      )

    const memory = readEchoMemory()
    const sharedOrigin = memory.coreMemory
      .filter(
        (item) =>
          item.truthStatus === 'user-stated' &&
          ['decision', 'motivation', 'attachment'].includes(item.kind),
      )
      .map((item) => item.content)
    const parallelMemories = memory.archiveMemory
      .filter((item) =>
        ['world', 'evidence', 'dialogue'].includes(item.kind),
      )
      .slice(-16)
      .map((item) => item.content)
    const answers = Array.isArray(this.worldState.answers)
      ? this.worldState.answers
      : []
    const timeline = readPersistentTimeline(this.worldState)
    const experiencedChoices = Array.isArray(timeline.experiencedNodes)
      ? timeline.experiencedNodes.map(
          (node) =>
            `${node.choiceLabel || '继续经历'}：${node.consequence || '结果仍在展开'}`,
        )
      : []
    return {
      sceneId: this.manifest.id,
      sceneDescription:
        `${this.manifest.title}。当前可能世界是：${this.worldState.seed || '另一条没有走过的人生'}。` +
        `这里已经出现的核心矛盾是：${this.worldState.centralTension || this.worldState.cost || '这条路同时带来得到与代价'}。`,
      nearbyObject: this.manifest.echo.nearbyObject,
      playerPosition: {
        x: playerPosition.x,
        y: playerPosition.y,
        z: playerPosition.z,
      },
      collectedItems,
      previousChoices: [
        ...readPreviousChoices(),
        ...experiencedChoices,
      ],
      sharedOrigin,
      parallelMemories: [
        ...parallelMemories,
        ...experiencedChoices.map((item) => `这条时间线已经发生：${item}`),
      ],
      otherPath: {
        knownAtFork: [
          timeline.sharedOrigin
            ? `共同起点：${timeline.sharedOrigin}`
            : '',
          timeline.realPath
            ? `用户在现实中选择：${timeline.realPath}`
            : answers[1]
              ? `用户在现实中记录的选择是：${answers[1]}`
              : '',
          timeline.counterfactualPath
            ? `我在这个世界选择：${timeline.counterfactualPath}`
            : '',
        ].filter(Boolean),
        userDisclosures: [],
        knownUnknowns: [
          '岔路之后，现实中的用户具体经历了什么，除非用户亲口披露，否则未知。',
          '平行自我对现实路径的想象不是事实，只能作为反事实投射表达。',
          `当前只生活到：${timeline.currentHorizon || timeline.observationTarget || '本次观察节点'}；之后仍未发生。`,
        ],
      },
    }
  }

  destroy() {
    if (this.isDestroyed) return
    this.isDestroyed = true
    cancelAnimationFrame(this.animationFrame)
    window.clearTimeout(this.awakeningTimer)
    this.characterHotspot?.destroy()
    this.memoryHotspots?.forEach((hotspot) => hotspot.destroy())
    window.removeEventListener('resize', this.handleResize)
    document.removeEventListener(
      'pointerlockchange',
      this.handlePointerLockChange,
    )
    document.removeEventListener('mousemove', this.handleMouseMove)
    document.removeEventListener('keydown', this.handleKeyDown)
    document.removeEventListener('keyup', this.handleKeyUp)
    this.enterButton.removeEventListener('click', this.requestPointerLock)
    this.renderer.domElement.removeEventListener(
      'click',
      this.requestPointerLock,
    )
    window.removeEventListener(
      'unhandledrejection',
      this.handleUnhandledRejection,
    )
    this.renderer.dispose()
  }

  logSpawnFloorProbe() {
    console.info('[Echo] 轻量房间边界就绪', {
      floorY: this.manifest.movementBounds.floorY,
      spawnPoint: this.manifest.spawn.position,
    })
  }

  toggleColliderDebug() {
    this.colliderDebugVisible = !this.colliderDebugVisible
    this.debugMeshes.forEach((mesh) => {
      mesh.visible = this.colliderDebugVisible
    })
    console.info(
      `[Echo] collider debug ${this.colliderDebugVisible ? '开启' : '关闭'}`,
    )
  }

  toggleDebugPanel() {
    this.panelVisible = !this.panelVisible
    this.debugPanel.hidden = !this.panelVisible
  }

  updateFps(deltaTime) {
    this.fpsFrames += 1
    this.fpsElapsed += deltaTime
    if (this.fpsElapsed >= 0.5) {
      this.fps = Math.round(this.fpsFrames / this.fpsElapsed)
      this.fpsFrames = 0
      this.fpsElapsed = 0
    }
  }

  updateDebugPanel() {
    if (!this.playerPosition || !this.panelVisible) return
    const position = this.playerPosition
    this.debugFields.position.textContent =
      `${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}`
    this.debugFields.grounded.textContent = String(this.isGrounded)
    this.debugFields.speed.textContent =
      `${this.horizontalVelocity.length().toFixed(2)} m/s`
    this.debugFields.fps.textContent = String(this.fps)
  }

  setLoadPhase(label, progress) {
    this.loadingDetail.textContent = label
    this.loadingProgress.style.transform = `scaleX(${THREE.MathUtils.clamp(progress, 0, 1)})`
  }

  showFatalError(error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[Echo] 世界加载失败', error)
    this.loadingOverlay.classList.add('has-error')
    this.loadingStatus.textContent = '房间没有成功打开'
    this.loadingDetail.textContent = message
    this.loadingProgress.style.transform = 'scaleX(1)'
    this.loadingProgress.style.background = '#ff735e'
    this.enterButton.hidden = true
  }
}

function readPreviousChoices() {
  try {
    const records = JSON.parse(localStorage.getItem('echo.choiceRecords') || '[]')
    if (!Array.isArray(records)) return []
    return records
      .slice(0, 12)
      .map((record) => record?.label)
      .filter((label) => typeof label === 'string' && label.trim())
  } catch {
    return []
  }
}

function readPersistentTimeline(worldState) {
  try {
    const stored = JSON.parse(
      localStorage.getItem('echo.persistentTimeline.v1') || 'null',
    )
    if (stored && typeof stored === 'object') return stored
  } catch {
    // Fall through to the world snapshot.
  }
  return worldState.persistentTimeline || {}
}

function escapeHtml(value) {
  const element = document.createElement('div')
  element.textContent = String(value ?? '')
  return element.innerHTML
}

function analyzeAndFilterTriangles(vertices, sourceIndices) {
  const kept = []
  let suspiciousArea = 0
  let removedTriangles = 0
  const filter = WATER_CONFIG.waterSurfaceFilter

  for (let index = 0; index < sourceIndices.length; index += 3) {
    const a = sourceIndices[index] * 3
    const b = sourceIndices[index + 1] * 3
    const c = sourceIndices[index + 2] * 3

    const abx = vertices[b] - vertices[a]
    const aby = vertices[b + 1] - vertices[a + 1]
    const abz = vertices[b + 2] - vertices[a + 2]
    const acx = vertices[c] - vertices[a]
    const acy = vertices[c + 1] - vertices[a + 1]
    const acz = vertices[c + 2] - vertices[a + 2]
    const nx = aby * acz - abz * acy
    const ny = abz * acx - abx * acz
    const nz = abx * acy - aby * acx
    const doubleArea = Math.hypot(nx, ny, nz)
    const meanY =
      (vertices[a + 1] + vertices[b + 1] + vertices[c + 1]) / 3
    const isHorizontal =
      doubleArea > 1e-8 &&
      Math.abs(ny / doubleArea) >= filter.horizontalNormalThreshold
    const isAtWaterLevel =
      meanY >= filter.minY && meanY <= filter.maxY

    if (isHorizontal && isAtWaterLevel) {
      suspiciousArea += doubleArea / 2
      if (filter.enabled) {
        removedTriangles += 1
        continue
      }
    }

    kept.push(
      sourceIndices[index],
      sourceIndices[index + 1],
      sourceIndices[index + 2],
    )
  }

  return {
    indices: Uint32Array.from(kept),
    suspiciousArea,
    removedTriangles,
  }
}

function moveTowards(current, target, maxDelta) {
  if (Math.abs(target - current) <= maxDelta) return target
  return current + Math.sign(target - current) * maxDelta
}

function serializeBox(box) {
  return {
    min: box.min.toArray().map((value) => Number(value.toFixed(3))),
    max: box.max.toArray().map((value) => Number(value.toFixed(3))),
  }
}

function readWorldState() {
  const fallback = {
    seed: '如果当年我离开杭州，去了伦敦工作，我会不会更快乐？',
    context: '我一直把那条没走的路想得更自由。',
    truth: '换一条路，仍然会反复寻找被理解、也仍然不愿失去重要的人。',
    action: '不是替现实做判决，而是把向往缩小成今天可以行动的一步。',
    events: [
      {
        title: '她真的去了远方',
        detail: '新的城市给了她重新定义自己的自由，也让生活第一次完全由自己承担。',
        polarity: 'gain',
      },
      {
        title: '她错过了一些普通的晚上',
        detail: '获得自由的代价，是熟悉的人生继续发生时，她常常只能隔着屏幕看见。',
        polarity: 'cost',
      },
      {
        title: '她还是会在深夜问同一个问题',
        detail: '地点变了，真正放不下的东西没有变：她依然希望被理解，也希望自己没有辜负谁。',
        polarity: 'turn',
      },
    ],
  }

  try {
    const stored = localStorage.getItem('echo.worldState')
    if (!stored) return fallback
    return { ...fallback, ...JSON.parse(stored) }
  } catch (error) {
    console.warn('[Echo] 无法读取世界状态，进入预置世界', error)
    return fallback
  }
}

function createMemoryObjects(worldState) {
  const events = Array.isArray(worldState.events) ? worldState.events : []
  const gain = events.find((event) => event.polarity === 'gain') || events[0]
  const cost = events.find((event) => event.polarity === 'cost') || events[1]
  const turn = events.find((event) => event.polarity === 'turn') || events[2]

  const scenes = Array.isArray(worldState.scenes) ? worldState.scenes : []
  return [
    {
      id: 'gain',
      role: 'gain',
      shortName: '那张登机牌',
      chapter: '01 / 她得到了什么',
      name: gain?.title || '一张没用过的登机牌',
      reveal:
        gain?.detail ||
        '她得到了你一直想象的自由，也第一次可以不向任何人解释自己。',
      consequence: '这不是奖品。它只证明：那条路确实有你向往的东西。',
      choicePrompt: scenes[0]?.choicePrompt,
      choices: scenes[0]?.choices || [],
    },
    {
      id: 'cost',
      role: 'cost',
      shortName: '没有接通的语音',
      chapter: '02 / 她为此失去了什么',
      name: cost?.title || '一段没有接通的语音',
      reveal:
        cost?.detail ||
        '在她获得另一种生活时，现在这条路上的一些人和普通日子也没有等她。',
      consequence: '平行世界不是更好的版本，只是一组不同的交换。',
      choicePrompt: scenes[1]?.choicePrompt,
      choices: scenes[1]?.choices || [],
    },
    {
      id: 'truth',
      role: 'truth',
      shortName: '水里的那句话',
      chapter: '03 / 什么始终没有改变',
      name: turn?.title || '一张写到一半的便签',
      reveal:
        worldState.truth ||
        turn?.detail ||
        '不论走到哪里，你还是会反复寻找同一种被理解，也还是舍不得同一类人。',
      consequence: '路径改变了生活的外形，却没有替你解决这一生真正的问题。',
      choicePrompt: scenes[2]?.choicePrompt,
      choices: scenes[2]?.choices || [],
    },
  ]
}

function rememberTimelineChoice(worldState, item) {
  try {
    const timeline = {
      ...(worldState.persistentTimeline || {}),
      currentHorizon:
        worldState.scenes?.find((scene) => scene.evidence?.polarity === item.role)
          ?.time || item.name,
      status: 'active',
      experiencedNodes: [
        ...(worldState.persistentTimeline?.experiencedNodes || []),
        {
          nodeId: item.id,
          choiceId: item.choiceId,
          choiceLabel: item.choiceLabel,
          consequence: item.consequence,
          experiencedAt: item.collectedAt,
        },
      ],
    }
    const next = {
      ...worldState,
      persistentTimeline: timeline,
    }
    localStorage.setItem('echo.worldState', JSON.stringify(next))
    localStorage.setItem('echo.persistentTimeline.v1', JSON.stringify(timeline))
  } catch (error) {
    console.warn('[Echo] 时间线选择未能保存', error)
  }
}
