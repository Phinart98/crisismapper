import { isBlurry } from '~/utils/blurDetect'

export type PhotoResult = {
  file: File
  webpBlob: Blob
  previewUrl: string
  sizeBytes: number
  blurry: boolean
  peopleDetected: boolean
  hashHex: string
}

let faceDetectorInstance: { detect: (img: HTMLCanvasElement) => { detections: { categories: { score: number }[] }[] } } | null = null
let compressionModule: typeof import('browser-image-compression') | null = null

async function getFaceDetector() {
  if (faceDetectorInstance) return faceDetectorInstance
  const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision')
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
  )
  faceDetectorInstance = await FaceDetector.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
      delegate: 'CPU',
    },
    runningMode: 'IMAGE',
  })
  return faceDetectorInstance
}

export function usePhotoPipeline() {
  const processing = ref(false)
  const error = ref<string | null>(null)

  async function processPhoto(file: File): Promise<PhotoResult | null> {
    processing.value = true
    error.value = null

    // HEIC guard — Safari Files-app may deliver HEIC; camera path delivers JPEG
    if (file.type === 'image/heic' || file.type === 'image/heif') {
      error.value = 'heicError'
      processing.value = false
      return null
    }

    try {
      // Decode image into a canvas for checks (downsampled to 640px max)
      const bitmap = await createImageBitmap(file)
      const scale = Math.min(1, 640 / Math.max(bitmap.width, bitmap.height))
      const w = Math.round(bitmap.width * scale)
      const h = Math.round(bitmap.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
      bitmap.close()

      // Blur check
      const blurry = isBlurry(canvas)

      // Face check — lazy-load MediaPipe WASM only here
      let peopleDetected = false
      try {
        const detector = await getFaceDetector()
        const result = detector.detect(canvas)
        peopleDetected = result.detections.some(d =>
          d.categories.some(c => c.score > 0.5)
        )
      } catch {
        // Face detection failure is non-fatal — we warn only if it works
      }

      // Compress to WebP — lazy-load browser-image-compression (cached after first import)
      if (!compressionModule) compressionModule = await import('browser-image-compression')
      const compressed = await compressionModule.default(file, {
        maxSizeMB: 0.2,
        maxWidthOrHeight: 1024,
        useWebWorker: true,
        fileType: 'image/webp',
        initialQuality: 0.7,
      })

      // SHA-256 hash for dedup
      const arrayBuf = await compressed.arrayBuffer()
      const hashBuf = await crypto.subtle.digest('SHA-256', arrayBuf)
      const hashHex = Array.from(new Uint8Array(hashBuf))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')

      const previewUrl = URL.createObjectURL(compressed)

      return {
        file,
        webpBlob: compressed,
        previewUrl,
        sizeBytes: compressed.size,
        blurry,
        peopleDetected,
        hashHex,
      }
    } catch (e) {
      error.value = 'photoError'
      return null
    } finally {
      processing.value = false
    }
  }

  return { processing, error, processPhoto }
}
