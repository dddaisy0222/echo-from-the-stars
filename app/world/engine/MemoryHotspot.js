import * as THREE from 'three'

export class MemoryHotspot {
  constructor({
    scene,
    mount,
    config,
    memory,
    onDialogOpen,
    onDialogClose,
    onCollected,
  }) {
    this.scene = scene
    this.mount = mount
    this.config = config
    this.memory = memory
    this.onDialogOpen = onDialogOpen
    this.onDialogClose = onDialogClose
    this.onCollected = onCollected
    this.isInRange = false
    this.isDialogOpen = false
    this.isCollected = this.readCollectedState()

    this.createMarker()
    this.createInterface()
    this.syncCollectedState()
  }

  get storageKey() {
    return `echo.inventory.${this.memory.id}`
  }

  createMarker() {
    const geometry = new THREE.RingGeometry(0.08, 0.12, 32)
    const material = new THREE.MeshBasicMaterial({
      color: this.config.color,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    this.marker = new THREE.Mesh(geometry, material)
    this.marker.name = `memory:${this.memory.id}`
    this.marker.position.fromArray(this.config.position)
    this.marker.rotation.x = -Math.PI / 2
    this.marker.renderOrder = 8_000
    this.scene.add(this.marker)

    this.interactionCenter = new THREE.Vector3().fromArray(this.config.position)
  }

  createInterface() {
    this.prompt = document.createElement('div')
    this.prompt.className = 'interaction-prompt'
    this.prompt.dataset.hotspotPrompt = this.memory.id
    this.prompt.textContent = `按 E 触碰${this.memory.shortName}`
    this.prompt.hidden = true

    this.dialog = document.createElement('section')
    this.dialog.className = `memory-dialog memory-dialog--${this.memory.role}`
    this.dialog.dataset.memoryDialog = this.memory.id
    this.dialog.setAttribute('role', 'dialog')
    this.dialog.setAttribute('aria-modal', 'true')
    this.dialog.setAttribute('aria-label', this.memory.name)
    this.dialog.hidden = true

    this.inventoryNotice = document.createElement('div')
    this.inventoryNotice.className = 'inventory-notice'
    this.inventoryNotice.textContent = `已记住：${this.memory.name}`
    this.inventoryNotice.hidden = true

    this.mount.append(this.prompt, this.dialog, this.inventoryNotice)
    this.handleDialogClick = (event) => {
      const action = event.target.closest('button[data-memory-action]')
        ?.dataset.memoryAction
      if (action === 'take') this.collect()
      if (action === 'leave') this.closeDialog()
    }
    this.dialog.addEventListener('click', this.handleDialogClick)
  }

  update(playerPosition, elapsedTime) {
    const pulse = 0.5 + Math.sin(elapsedTime * 1.2 + this.config.phase) * 0.5
    this.marker.material.opacity = this.isCollected ? 0.08 : 0.24 + pulse * 0.24
    this.marker.scale.setScalar(0.92 + pulse * 0.14)

    if (this.isCollected || this.isDialogOpen) {
      this.isInRange = false
      this.prompt.hidden = true
      return
    }

    this.isInRange =
      playerPosition.distanceTo(this.interactionCenter) <= this.config.radius
    this.prompt.hidden = !this.isInRange
  }

  handleKeyDown(event) {
    if (
      event.code === 'KeyE' &&
      !event.repeat &&
      this.isInRange &&
      !this.isCollected &&
      !this.isDialogOpen
    ) {
      event.preventDefault()
      this.openDialog()
      return true
    }
    return this.isDialogOpen
  }

  openDialog() {
    this.isDialogOpen = true
    this.prompt.hidden = true
    this.dialog.innerHTML = `
      <div class="memory-dialog__card">
        <p class="memory-dialog__eyebrow">${escapeHtml(this.memory.chapter)}</p>
        <p class="memory-dialog__narration">${escapeHtml(this.memory.name)}</p>
        <p class="memory-dialog__body">“${escapeHtml(this.memory.reveal)}”</p>
        <p class="memory-dialog__consequence">${escapeHtml(this.memory.consequence)}</p>
        <div class="memory-dialog__choices memory-dialog__choices--final">
          <button type="button" data-memory-action="take">记住这件事</button>
          <button type="button" data-memory-action="leave">暂时放回原处</button>
        </div>
      </div>
    `
    this.dialog.hidden = false
    this.onDialogOpen?.()
  }

  closeDialog() {
    this.isDialogOpen = false
    this.dialog.hidden = true
    this.dialog.innerHTML = ''
    this.onDialogClose?.()
  }

  collect() {
    const item = {
      id: this.memory.id,
      name: this.memory.name,
      role: this.memory.role,
      collectedAt: new Date().toISOString(),
    }
    try {
      sessionStorage.setItem(this.storageKey, JSON.stringify(item))
    } catch (error) {
      console.warn('[Echo] 记忆碎片未能保存', error)
    }

    this.isCollected = true
    this.syncCollectedState()
    this.closeDialog()
    this.onCollected?.(item)
  }

  syncCollectedState() {
    this.marker.visible = !this.isCollected
    if (!this.isCollected) return

    this.isInRange = false
    this.prompt.hidden = true
    this.inventoryNotice.hidden = false
    window.clearTimeout(this.noticeTimer)
    this.noticeTimer = window.setTimeout(() => {
      this.inventoryNotice.hidden = true
    }, 2400)
  }

  readCollectedState() {
    try {
      return Boolean(sessionStorage.getItem(this.storageKey))
    } catch {
      return false
    }
  }

  destroy() {
    window.clearTimeout(this.noticeTimer)
    this.dialog.removeEventListener('click', this.handleDialogClick)
    this.scene.remove(this.marker)
    this.marker.geometry.dispose()
    this.marker.material.dispose()
    this.prompt.remove()
    this.dialog.remove()
    this.inventoryNotice.remove()
  }
}

function escapeHtml(value) {
  const element = document.createElement('div')
  element.textContent = value
  return element.innerHTML
}
