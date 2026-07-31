const entryEffects = new Map()

entryEffects.set('fade', async ({ renderer, camera }) => {
  const canvas = renderer.domElement
  const originalY = camera.position.y
  canvas.style.opacity = '0'
  camera.position.y = originalY - 0.08
  await canvas
    .animate(
      [
        { opacity: 0, filter: 'blur(12px)' },
        { opacity: 1, filter: 'blur(0)' },
      ],
      {
        duration: 1100,
        easing: 'cubic-bezier(.2,.8,.2,1)',
        fill: 'forwards',
      },
    )
    .finished
  camera.position.y = originalY
  canvas.style.opacity = ''
  canvas.style.filter = ''
})

export function registerWorldEntryEffect(name, effect) {
  if (!name || typeof effect !== 'function') {
    throw new TypeError('World entry effect requires a name and function.')
  }
  entryEffects.set(name, effect)
}

export async function runWorldEntryEffect(name, context) {
  const effect = entryEffects.get(name) || entryEffects.get('fade')
  await effect(context)
}
