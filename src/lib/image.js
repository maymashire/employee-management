/**
 * Turn an uploaded image into a small square JPEG data URL (center-cropped),
 * small enough to store directly on the user's Firestore document.
 */
export const MAX_UPLOAD_MB = 5

export function fileToAvatar(file, size = 256, quality = 0.85) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith('image/')) { reject(new Error('Please choose an image file (JPG, PNG, WebP).')); return }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) { reject(new Error(`Image is larger than ${MAX_UPLOAD_MB} MB.`)); return }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight)
      const sx   = (img.naturalWidth - side) / 2
      const sy   = (img.naturalHeight - side) / 2
      const canvas = Object.assign(document.createElement('canvas'), { width: size, height: size })
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, size, size)
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That image could not be read.')) }
    img.src = url
  })
}
