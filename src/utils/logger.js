/* eslint-disable no-console */
const write = (level, message, context = {}) => {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context
  })

  if (level === 'error') console.error(entry)
  else console.log(entry)
}

export const logger = {
  info: (message, context) => write('info', message, context),
  error: (message, context) => write('error', message, context)
}
