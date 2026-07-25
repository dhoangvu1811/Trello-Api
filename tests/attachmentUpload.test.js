const test = require('node:test')
const assert = require('node:assert/strict')
const {
  createFileFilter
} = require('../build/src/middlewares/multerUploadMiddleware')

const runFilter = (allowedTypes, mimetype) =>
  new Promise((resolve, reject) => {
    createFileFilter(allowedTypes, 'Rejected attachment')(
      {},
      { mimetype },
      (error, accepted) => error ? reject(error) : resolve(accepted)
    )
  })

test('accepts an allowed attachment MIME type', async () => {
  assert.equal(
    await runFilter(['application/pdf'], 'application/pdf'),
    true
  )
})

test('rejects a disallowed attachment MIME type', async () => {
  await assert.rejects(
    runFilter(['application/pdf'], 'application/x-msdownload'),
    /Rejected attachment/
  )
})
