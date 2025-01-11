const express = require('express')
const axios = require('axios')
const cors = require('cors')
const fs = require('fs') // Добавляем модуль для работы с файлами
const crypto = require('crypto') // Модуль для хеширования
const path = require('path') // Импорт модуля path
const endpointRoutes = require('./routes/endpoint')
const checkSignStatusRoutes = require('./routes/checkSignStatus')
const uploadRouter = require('./routes/uploadDocs')

const { exec } = require('child_process')

exec('openssl version', (error, stdout, stderr) => {
  if (error) {
    console.error('OpenSSL не установлен или недоступен:', error.message)
    return
  }
  console.log('OpenSSL установлен. Версия:', stdout)
})

// Custom middleware
const loggingMiddleware = require('./middleware/loggingMiddleware.js')

function generateRequestId() {
  return Date.now().toString() // Генерируем уникальный ID на основе времени
}

async function getToken() {
  try {
    const response = await axios.get(
      'https://api2s.diia.gov.ua/api/v1/auth/acquirer/kalenskiy_test_token_inx827',
      {
        headers: {
          accept: 'application/json',
          Authorization:
            'Basic YWNxdWlyZXJfOTcwOmthbGVuc2tpeV90ZXN0X3Rva2VuX2lueDgyNw=='
        }
      }
    )
    console.log('Ответ от сервера (токен):', response.data)
    return response.data.token // Возвращаем токен
  } catch (error) {
    console.error(
      'Ошибка при отправке запроса для получения токена:',
      error.message
    )
  }
}

// async function makeBranch(token) {
//   try {
//     const response = await axios.post(
//       'https://api2s.diia.gov.ua/api/v2/acquirers/branch',
//       {
//         name: 'Головний офіс',
//         email: 'office@kalenskiy.com.ua',
//         region: 'Київська обл.',
//         district: 'Дніпровський р-н',
//         location: 'м. Київ',
//         street: 'вул. Будівельників',
//         house: '38/14',
//         deliveryTypes: ['api'],
//         offerRequestType: 'dynamic',
//         scopes: {
//           diiaId: ['hashedFilesSigning']
//         }
//       },
//       {
//         headers: {
//           accept: 'application/json',
//           Authorization: `Bearer ${token}`, // Вставляем токен в заголовок
//           'Content-Type': 'application/json'
//         }
//       }
//     )
//     console.log('Ответ от второго запроса:', response.data)
//     return response.data._id
//   } catch (error) {
//     console.error('Ошибка при отправке второго запроса:', error.message)
//   }
// }

async function sendOffer(token, branchId) {
  try {
    const response = await axios.post(
      `https://api2s.diia.gov.ua/api/v1/acquirers/branch/${branchId}/offer`,
      {
        name: 'Укладення договору про надання правової допомоги',
        scopes: {
          diiaId: ['hashedFilesSigning']
        },
        returnLink: 'https://kalenskiy.com.ua/dyakuemo?diia=diia'
      },
      {
        headers: {
          accept: 'application/json',
          Authorization: `Bearer ${token}`, // Вставляем токен в заголовок
          'Content-Type': 'application/json'
        }
      }
    )
    console.log('Ответ от третьего запроса:', response.data)
    return response.data._id
  } catch (error) {
    console.error('Ошибка при отправке третьего запроса:', error.message)
  }
}

async function sendSign(token, branchId, offerId) {
  try {
    const requestId = generateRequestId() // Генерируем уникальный requestId
    console.log(requestId)

    // Путь к файлу договора
    const filePath = path.join(__dirname, 'uploads', 'dogovir.pdf') // Корректный путь
    const fileBuffer = fs.readFileSync(filePath) // Читаем файл
    const fileHash = crypto
      .createHash('sha256')
      .update(fileBuffer)
      .digest('base64') // Генерируем хеш в формате Base64

    // Путь к файлу для хранения логов хэшей
    const logFilePath = path.join(__dirname, 'uploads', 'hashes.log')

    // Формируем строку для лога с requestId, хешем и меткой времени
    const logEntry = `Request ID: ${requestId}, File: dogovir.pdf, Hash: ${fileHash}, Timestamp: ${new Date().toISOString()}\n`

    // Записываем лог в файл (если файл не существует, он будет создан)
    fs.appendFileSync(logFilePath, logEntry, 'utf8')
    console.log('Хеш и Request ID сохранены в логи:', logEntry)

    // Отправка запроса с использованием вычисленного хэша
    const response = await axios.post(
      `https://api2s.diia.gov.ua/api/v2/acquirers/branch/${branchId}/offer-request/dynamic`,
      {
        offerId: offerId,
        requestId: requestId,
        signAlgo: 'ECDSA',
        data: {
          hashedFilesSigning: {
            hashedFiles: [
              {
                fileName: 'Договір про надання правової допомоги',
                fileHash: fileHash // Используем вычисленный хеш
              }
            ]
          }
        }
      },
      {
        headers: {
          accept: 'application/json',
          Authorization: `Bearer ${token}`, // Вставляем токен в заголовок
          'Content-Type': 'application/json'
        }
      }
    )

    console.log('Ответ от последнего запроса:', response.data)
    return { deeplink: response.data.deeplink, requestId } // Возвращаем deeplink
  } catch (error) {
    console.error('Ошибка при отправке последнего запроса:', error.message)
  }
}

// Функция для получения всех ресурсов
async function getAllBranches(token) {
  try {
    const response = await axios.get(
      'https://api2s.diia.gov.ua/api/v2/acquirers/branches',
      {
        headers: {
          accept: 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
    )
    console.log('Список всех ресурсов:', response.data)
    return response.data
  } catch (error) {
    console.error('Ошибка при получении всех ресурсов:', error.message)
  }
}

// Функция для получения конкретного ресурса
async function getBranchById(token, branchId) {
  try {
    const response = await axios.get(
      `https://api2s.diia.gov.ua/api/v2/acquirers/branch/${branchId}`,
      {
        headers: {
          accept: 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
    )
    console.log('Детали ресурса:', response.data)
    return response.data
  } catch (error) {
    console.error(`Ошибка при получении ресурса ${branchId}:`, error.message)
  }
}

// Функция для удаления ресурса
async function deleteBranch(token, branchId) {
  try {
    await axios.delete(
      `https://api2s.diia.gov.ua/api/v2/acquirers/branch/${branchId}`,
      {
        headers: {
          accept: '*/*',
          Authorization: `Bearer ${token}`
        }
      }
    )
    console.log(`Ресурс с ID ${branchId} успешно удален.`)
  } catch (error) {
    console.error(`Ошибка при удалении ресурса ${branchId}:`, error.message)
  }
}

// Запрос ввода от пользователя
const readline = require('readline')
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

// Основная функция для работы с меню
async function startMenu() {
  try {
    const token = await getToken()
    if (!token) {
      console.error('Не удалось получить токен. Завершаю работу.')
      process.exit(1)
    }

    rl.question(
      'Выберите действие:\n1. Получить все ресурсы\n2. Получить ресурс по ID\n3. Удалить ресурс по ID\nВаш выбор: ',
      async (choice) => {
        switch (choice) {
          case '1':
            await getAllBranches(token)
            break
          case '2':
            rl.question('Введите ID ресурса: ', async (branchId) => {
              await getBranchById(token, branchId)
              rl.close()
            })
            return
          case '3':
            rl.question(
              'Введите ID ресурса для удаления: ',
              async (branchId) => {
                await deleteBranch(token, branchId)
                rl.close()
              }
            )
            return
          default:
            console.log('Неверный выбор. Попробуйте снова.')
        }
        rl.close()
      }
    )
  } catch (error) {
    console.error('Ошибка в процессе выполнения:', error.message)
  }
}

// Запуск меню
startMenu()

// Создаем приложение Express
const app = express()
app.set('trust proxy', 1) // Добавьте эту строку

// Подключаем middleware для парсинга JSON
app.use(express.json())

// Настройка CORS
app.use(
  cors({
    origin: [
      'https://kalenskiy.com.ua',
      'http://localhost:3000',
      'https://api.kalenskiy.com.ua'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  })
)
app.options('*', cors())
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' https://api.kalenskiy.com.ua data:;"
  )
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
  next()
})

// Use routes
app.use('/endpoint', endpointRoutes)
app.use('/api/check-sign-status', loggingMiddleware, checkSignStatusRoutes)
app.use('/api/upload-documents', loggingMiddleware, uploadRouter)
app.post('/api/sign-online', loggingMiddleware, async (req, res) => {
  const { device } = req.body // Получаем тип устройства из тела запроса

  if (!device) {
    return res.status(400).json({ error: 'Нет данных о типе устройства' })
  }

  console.log('Информация о девайсе:', device)

  try {
    const token = await getToken()
    if (token) {
      // const branchId = await makeBranch(token)
      const branchId =
        'a6f412374da61909dcf76f162bada6f416b173a81f8680d6424ae3a7a784316c47550274bc2bd7acf20f13f90f11f17e5f164a7a56532749e8dd923721e0f111'
      if (branchId) {
        const offerId = await sendOffer(token, branchId)
        if (offerId) {
          const { deeplink, requestId } = await sendSign(
            token,
            branchId,
            offerId
          ) // Получаем deeplink

          if (device === 'desktop') {
            // Для десктопа не генерируем QR, просто передаем deeplink
            res.status(200).json({
              message: 'desktop',
              deeplink: deeplink, // Отправляем deeplink для десктопа
              requestId: requestId
            })
          } else if (device === 'mobile') {
            // Мобильное устройство — генерируем динамический deeplink

            const dynamicDeeplink = `https://diia.page.link?link=${encodeURIComponent(
              deeplink
            )}&apn=ua.gov.diia.app&isi=1489717872&ibi=ua.gov.diia.app`

            res.status(200).json({
              message: 'mobile',
              deeplink: dynamicDeeplink, // Отправляем динамический deeplink
              requestId: requestId
            })
          } else {
            res.status(200).json({
              message: 'desktop',
              deeplink: deeplink, // Отправляем deeplink для десктопа
              requestId: requestId
            })
          }
        }
      }
    }
  } catch (error) {
    console.error('Ошибка в процессе выполнения:', error.message)
    res.status(500).json({ error: 'Внутренняя ошибка сервера' })
  }
})

// Маршрут для главной страницы
app.get('/', (req, res) => {
  res.send('Сервер работает')
})

// Запускаем сервер на порту 443
app.listen(8443, () => {
  console.log('Сервер работает на порту 8443')
})
