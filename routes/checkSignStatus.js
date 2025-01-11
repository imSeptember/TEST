const express = require('express')
const axios = require('axios')

const router = express.Router()

// Обработка запроса на подпись
router.post('/', async (req, res) => {
  try {
    // Получение сессионного токена
    const tokenResponse = await axios.get(
      'https://api2.diia.gov.ua/api/v1/auth/acquirer/YfVkyQhSNcJM9rYcMGNqmN3wcUJCtpvSZ2sg6SFj2CZKZgrGvaYkabYFtpjUyVj9',
      {
        headers: {
          accept: 'application/json',
          Authorization: 'Basic' // Укажите ваш ключ для авторизации
        }
      }
    )

    const sessionToken = tokenResponse.data.token
    console.log('Получен сессионный токен:', sessionToken)

    if (!sessionToken) {
      return res
        .status(500)
        .json({ error: 'Не удалось получить сессионный токен' })
    }

    // Получение `requestId` из тела запроса
    const { requestId } = req.body

    if (!requestId) {
      return res.status(400).json({ error: 'Request ID отсутствует' })
    }

    // Проверка статуса подписания
    const statusResponse = await axios.get(
      `https://api2.diia.gov.ua/api/v1/acquirers/offer-request/status?requestId=${requestId}`,
      {
        headers: {
          accept: 'application/json',
          Authorization: `Bearer ${sessionToken}` // Используем полученный токен
        }
      }
    )

    const statusData = statusResponse.data
    console.log('Ответ от API (статус):', statusData)

    // Возвращаем статус во фронт
    res.json(statusData)
  } catch (error) {
    console.error('Ошибка при обработке запроса:', error.message)
    res.status(500).json({ error: 'Ошибка при обработке запроса' })
  }
})

module.exports = router
