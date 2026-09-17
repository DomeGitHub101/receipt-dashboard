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
const languages = process.argv[3]?.split('+') || ['eng', 'tha']
const worker = await createWorker(languages, 1, {
  langPath,
  cachePath: langPath,
  logger: () => {},
})
try {
  if (process.argv[4]) await worker.setParameters({ tessedit_pageseg_mode: process.argv[4] })
  const { data } = await worker.recognize(process.argv[2], {}, { text: true, tsv: true })
  process.stdout.write(JSON.stringify({ text: data.text, tsv: data.tsv }))
} finally {
  await worker.terminate()
}
