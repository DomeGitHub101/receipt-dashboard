import { createWorker } from 'tesseract.js'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { mkdir, copyFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
const require = createRequire(import.meta.url)
const root = dirname(dirname(fileURLToPath(import.meta.url)))
const langPath = join(root, 'backend', '.ocr-data')
await mkdir(langPath, { recursive: true })
for (const lang of ['eng', 'tha']) {
  const pkg = require(`@tesseract.js-data/${lang}`)
  await copyFile(
    join(pkg.langPath, `${lang}.traineddata.gz`),
    join(langPath, `${lang}.traineddata.gz`),
  )
}
const worker = await createWorker(['eng', 'tha'], 1, {
  langPath,
  cachePath: langPath,
  logger: () => {},
})
try {
  const { data } = await worker.recognize(process.argv[2])
  process.stdout.write(data.text)
} finally {
  await worker.terminate()
}
