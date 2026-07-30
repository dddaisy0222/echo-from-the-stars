import * as THREE from 'three'
import { echoChildhoodSelf } from './data/echoChildhoodSelf.js'
import { WorldChatPanel } from './components/WorldChatPanel.js'

export class CharacterHotspot {
  constructor({
    scene,
    mount,
    config,
    canOpen,
    canReveal,
    getWorldContext,
    onDialogOpen,
    onDialogClose,
  }) {
    this.scene = scene
    this.mount = mount
    this.config = config
    this.canOpen = canOpen
    this.canReveal = canReveal
    this.getWorldContext = getWorldContext
    this.onDialogOpen = onDialogOpen
    this.onDialogClose = onDialogClose
    this.character = createCharacterFromWorld(echoChildhoodSelf)
    this.isInRange = false
    this.revealAmount = 0

    this.createReflection()
    this.createPrompt()
    this.chat = new WorldChatPanel({
      mount,
      character: this.character,
      onOpen: () => this.onDialogOpen?.(),
      onClose: () => this.onDialogClose?.(),
    })
  }

  createReflection() {
    this.characterRoot = new THREE.Group()
    this.characterRoot.name = 'reflection:another-self'
    this.characterRoot.position.fromArray(this.config.position)

    const texture = createReflectionTexture()
    const reflectionMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      color: this.config.color,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
    })
    const reflection = new THREE.Mesh(
      new THREE.PlaneGeometry(0.92, 1.86),
      reflectionMaterial,
    )
    reflection.name = 'another-self-on-water'
    reflection.rotation.x = -Math.PI / 2
    reflection.rotation.z = 0.08
    reflection.position.y = 0.008
    reflection.renderOrder = 7_999
    this.characterRoot.add(reflection)
    this.reflection = reflection

    const rippleMaterial = new THREE.MeshBasicMaterial({
      color: this.config.lightColor,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    this.ripples = [0.32, 0.51, 0.72].map((radius, index) => {
      const ripple = new THREE.Mesh(
        new THREE.RingGeometry(radius, radius + 0.012, 64),
        rippleMaterial.clone(),
      )
      ripple.name = `reflection-ripple-${index + 1}`
      ripple.rotation.x = -Math.PI / 2
      ripple.position.y = 0.012 + index * 0.002
      ripple.renderOrder = 8_000
      this.characterRoot.add(ripple)
      return ripple
    })

    this.characterLight = new THREE.PointLight(
      this.config.lightColor,
      0,
      2.8,
      2,
    )
    this.characterLight.position.y = 0.16
    this.characterRoot.add(this.characterLight)

    this.scene.add(this.characterRoot)
    this.interactionCenter = new THREE.Vector3()
      .fromArray(this.config.position)
      .add(new THREE.Vector3().fromArray(this.config.hotspotOffset))
  }

  createPrompt() {
    this.prompt = document.createElement('div')
    this.prompt.className = 'interaction-prompt character-interaction-prompt'
    this.prompt.dataset.characterPrompt = this.character.id
    this.prompt.textContent = '按 E 看向水里的她'
    this.prompt.hidden = true
    this.mount.append(this.prompt)
  }

  update(playerPosition, elapsedTime, { worldReady, interactionBlocked }) {
    const revealed = Boolean(this.canReveal?.())
    const target = revealed ? 1 : 0
    this.revealAmount = THREE.MathUtils.lerp(this.revealAmount, target, 0.035)
    const pulse = 0.5 + Math.sin(elapsedTime * 1.15) * 0.5

    this.reflection.material.opacity = this.revealAmount * (0.25 + pulse * 0.08)
    this.reflection.scale.set(
      1 + Math.sin(elapsedTime * 0.42) * 0.018,
      1 + Math.sin(elapsedTime * 0.53) * 0.028,
      1,
    )
    this.ripples.forEach((ripple, index) => {
      const cycle = (elapsedTime * 0.14 + index / this.ripples.length) % 1
      ripple.scale.setScalar(0.74 + cycle * 0.56)
      ripple.material.opacity =
        this.revealAmount * (1 - cycle) * (0.12 - index * 0.018)
    })
    this.characterLight.intensity = this.revealAmount * (0.18 + pulse * 0.08)

    this.isInRange =
      revealed &&
      worldReady &&
      playerPosition.distanceTo(this.interactionCenter) <=
        this.config.interactionRadius

    this.prompt.hidden =
      !this.isInRange ||
      this.chat.isOpen ||
      (interactionBlocked && !this.chat.isOpen)
  }

  handleKeyDown(event) {
    if (this.chat.isOpen) {
      if (event.code === 'Escape' && !event.repeat) {
        event.preventDefault()
        event.stopPropagation()
        this.chat.close()
      }
      return true
    }

    if (
      event.code === 'KeyE' &&
      !event.repeat &&
      this.isInRange &&
      this.canOpen?.()
    ) {
      event.preventDefault()
      this.prompt.hidden = true
      this.chat.open(this.getWorldContext())
      return true
    }

    return false
  }

  destroy() {
    this.chat.destroy()
    this.prompt.remove()
    this.scene.remove(this.characterRoot)
    this.characterRoot.traverse((object) => {
      object.geometry?.dispose()
      if (Array.isArray(object.material)) {
        object.material.forEach((material) => {
          material.map?.dispose()
          material.dispose()
        })
      } else {
        object.material?.map?.dispose()
        object.material?.dispose()
      }
    })
  }
}

function createCharacterFromWorld(baseCharacter) {
  try {
    const state = JSON.parse(localStorage.getItem('echo.worldState') || '{}')
    const name = state?.profile?.name
    const firstQuestion = state?.answers?.[4]
    return {
      ...baseCharacter,
      displayName: name ? `五年后的${name}` : '沿另一条路生活的你',
      openingNarration:
        '你找到三件证据后，水里的倒影终于抬起头。她没有比你更正确，只是比你多活过了这条路的五年。',
      openingLine: firstQuestion
        ? `你终于来了。我知道你想问：“${firstQuestion}” 你可以亲口问我。`
        : '你终于来了。这里和你想象的一样吗？',
    }
  } catch {
    return { ...baseCharacter }
  }
}

function createReflectionTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 512
  const context = canvas.getContext('2d')
  const gradient = context.createRadialGradient(128, 250, 20, 128, 250, 190)
  gradient.addColorStop(0, 'rgba(236,255,247,.92)')
  gradient.addColorStop(0.48, 'rgba(174,222,207,.52)')
  gradient.addColorStop(1, 'rgba(128,191,177,0)')

  context.filter = 'blur(13px)'
  context.fillStyle = gradient
  context.beginPath()
  context.ellipse(128, 106, 44, 55, 0, 0, Math.PI * 2)
  context.fill()
  context.beginPath()
  context.moveTo(79, 170)
  context.quadraticCurveTo(128, 136, 177, 170)
  context.quadraticCurveTo(194, 315, 166, 454)
  context.quadraticCurveTo(128, 486, 90, 454)
  context.quadraticCurveTo(62, 315, 79, 170)
  context.fill()

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}
