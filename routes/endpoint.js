const express = require('express')
const multer = require('multer')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const router = express.Router()

// Настроим multer для обработки multipart данных
const upload = multer({ dest: 'uploads/' })

// Папка для хранения подписей
const SIGNATURES_DIR = path.join(__dirname, '..', 'uploads')

// Создаём папку для подписей, если её нет
if (!fs.existsSync(SIGNATURES_DIR)) {
  fs.mkdirSync(SIGNATURES_DIR, { recursive: true })
}

// Обработка запроса на подпись
router.post('/', upload.any(), (req, res) => {
  try {
    console.log('Тело запроса:', req.body)
    console.log('Файлы из запроса:', req.files)

    // Извлекаем заголовок X-Document-Request-Trace-Id
    const traceId = req.headers['x-document-request-trace-id']
    if (!traceId) {
      return res
        .status(400)
        .json({ error: 'Заголовок X-Document-Request-Trace-Id отсутствует' })
    }

    // Создаём папку для текущего traceId
    const traceDir = path.join(SIGNATURES_DIR, traceId)
    if (!fs.existsSync(traceDir)) {
      fs.mkdirSync(traceDir, { recursive: true })
      console.log(`Создана директория: ${traceDir}`)
    }

    if (!req.body.encodeData) {
      return res.status(400).json({ error: 'Поле encodeData отсутствует' })
    }

    // Раскодируем encodeData
    const base64Data = req.body.encodeData
    const decodedData = Buffer.from(base64Data, 'base64').toString('utf-8')
    console.log('Декодированные данные:', decodedData)

    const parsedData = JSON.parse(decodedData)
    console.log('Парсинг JSON завершён:', parsedData)

    // Проверяем наличие поля signedItems
    if (!Array.isArray(parsedData.signedItems)) {
      return res
        .status(400)
        .json({ error: 'Поле signedItems отсутствует или некорректно' })
    }

    // Сохраняем каждую подпись в формате .p7s и извлекаем сертификаты
    parsedData.signedItems.forEach((item) => {
      if (!item.name || !item.signature) {
        console.warn('Пропущена подпись из-за отсутствия данных:', item)
        return
      }

      const p7sFileName = 'dogovir.p7s' // Имя файла .p7s
      const pemFileName = 'dogovir_pem.p7s' // Имя файла .pem
      const signerCertFileName = 'signer_cert.pem' // Имя файла с сертификатом
      const p7sFilePath = path.join(traceDir, p7sFileName)
      const pemFilePath = path.join(traceDir, pemFileName)
      const signerCertFilePath = path.join(traceDir, signerCertFileName)

      // Сохраняем файл .p7s
      fs.writeFileSync(p7sFilePath, item.signature, 'base64')
      console.log(`Подпись сохранена: ${p7sFilePath}`)

      // Конвертируем .p7s в .pem через OpenSSL
      try {
        execSync(
          `openssl pkcs7 -inform DER -in ${p7sFilePath} -out ${pemFilePath}`
        )
        console.log(`Файл .p7s успешно конвертирован в .pem: ${pemFilePath}`)

        // Извлекаем сертификат из .pem
        execSync(
          `openssl pkcs7 -in ${pemFilePath} -print_certs -out ${signerCertFilePath}`
        )
        console.log(`Сертификат извлечен и сохранён: ${signerCertFilePath}`)
      } catch (error) {
        console.error(
          `Ошибка при обработке файла ${p7sFilePath}:`,
          error.message
        )
        return res
          .status(500)
          .json({ error: `Ошибка при обработке подписи: ${error.message}` })
      }
    })

    // Возвращаем успешный ответ
    res.status(200).json({ success: true })
  } catch (error) {
    console.error('Ошибка обработки запроса:', error)
    res
      .status(500)
      .json({ error: 'Ошибка обработки запроса', details: error.message })
  }
})

module.exports = router
