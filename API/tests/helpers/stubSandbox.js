function replaceProperty(target, key, value) {
  const original = target[key]
  target[key] = value

  return () => {
    target[key] = original
  }
}

function createStubSandbox() {
  const restoreStack = []

  return {
    replace(target, key, value) {
      const restore = replaceProperty(target, key, value)
      restoreStack.push(restore)
      return value
    },

    restore() {
      while (restoreStack.length > 0) {
        restoreStack.pop()()
      }
    }
  }
}

async function withStubSandbox(callback) {
  const sandbox = createStubSandbox()

  try {
    return await callback(sandbox)
  } finally {
    sandbox.restore()
  }
}

function makeQueryResult(value) {
  const promise = () => Promise.resolve(value)

  return {
    populate() {
      return this
    },
    select() {
      return this
    },
    sort() {
      return this
    },
    lean() {
      return promise()
    },
    exec() {
      return promise()
    },
    then(resolve, reject) {
      return promise().then(resolve, reject)
    },
    catch(reject) {
      return promise().catch(reject)
    },
    finally(onFinally) {
      return promise().finally(onFinally)
    }
  }
}

module.exports = {
  createStubSandbox,
  makeQueryResult,
  replaceProperty,
  withStubSandbox
}
