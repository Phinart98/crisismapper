// Laplacian variance blur detection — standard OpenCV approach ported to Canvas ImageData.
// High variance = sharp edges present = NOT blurry. Low variance = blur has smoothed edges away.
// Threshold 100 is calibrated for building damage photos: sharp wall ~800-3000, blurry ~20-80.
export function isBlurry(canvas: HTMLCanvasElement, threshold = 100): boolean {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return false

  const { width, height } = canvas
  const { data } = ctx.getImageData(0, 0, width, height)

  // Build grayscale plane (Rec.601 luma)
  const gray = new Float32Array(width * height)
  for (let i = 0; i < gray.length; i++) {
    const p = i * 4
    gray[i] = 0.299 * data[p]! + 0.587 * data[p + 1]! + 0.114 * data[p + 2]!
  }

  // Apply discrete 4-connected Laplacian kernel to interior pixels, stride 2 for speed.
  // L(x,y) = gray[top] + gray[bottom] + gray[left] + gray[right] − 4·gray[center]
  let sum = 0
  let sumSq = 0
  let n = 0
  for (let y = 1; y < height - 1; y += 2) {
    for (let x = 1; x < width - 1; x += 2) {
      const c = y * width + x
      const lap = gray[c - width]! + gray[c + width]! + gray[c - 1]! + gray[c + 1]! - 4 * gray[c]!
      sum += lap
      sumSq += lap * lap
      n++
    }
  }

  if (n === 0) return false
  const variance = sumSq / n - (sum / n) ** 2
  return variance < threshold
}
