// middleware/loggingMiddleware.js
const loggingMiddleware = (req, res, next) => {
  console.log('Request Details:')
  console.log(`Method: ${req.method}`)
  console.log(`URL: ${req.url}`)
  console.log(`Body: ${JSON.stringify(req.body)}`)
  console.log(`Headers: ${JSON.stringify(req.headers)}`)

  // Record the start time
  const start = Date.now()

  // Intercept the response
  res.on('finish', () => {
    const duration = Date.now() - start
    console.log(`Response Status: ${res.statusCode}`)
    console.log(`Response Time: ${duration}ms`)
  })

  next()
}

module.exports = loggingMiddleware
