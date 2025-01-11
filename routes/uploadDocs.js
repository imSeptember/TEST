const express = require('express')
const multer = require('multer')
const fs = require('fs')
const path = require('path')

const router = express.Router()

// Настройка multer для загрузки файлов
const upload = multer({ dest: 'uploads/' })

// Папка для хранения загруженных файлов
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads')

// Создаем папку uploads, если она не существует
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
}

// Обработка запроса на загрузку документов
router.post('/', upload.any(), (req, res) => {
  try {
    console.log('Тело запроса:', req.body)
    console.log('Файлы из запроса:', req.files)

    const { requestId } = req.body // Извлекаем requestId из тела запроса
    if (!requestId) {
      return res.status(400).json({ error: 'requestId отсутствует в запросе' })
    }

    // Создаем папку для данного requestId
    const requestDir = path.join(UPLOADS_DIR, requestId)
    if (!fs.existsSync(requestDir)) {
      fs.mkdirSync(requestDir, { recursive: true })
      console.log(`Создана директория для requestId: ${requestDir}`)
    }

    // Перемещаем файлы в папку requestId
    req.files.forEach((file) => {
      const destPath = path.join(requestDir, file.originalname) // Используем оригинальное имя файла
      fs.renameSync(file.path, destPath)
      console.log(`Файл сохранен: ${destPath}`)
    })

    // Успешный ответ
    res.status(200).json({ success: true, message: 'Файлы успешно сохранены' })
  } catch (error) {
    console.error('Ошибка обработки запроса:', error)
    res
      .status(500)
      .json({ error: 'Ошибка обработки запроса', details: error.message })
  }
})

module.exports = router
