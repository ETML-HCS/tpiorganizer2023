const { TextDecoder, TextEncoder } = require('util')

if (!globalThis.TextEncoder) {
  globalThis.TextEncoder = TextEncoder
}

if (!globalThis.TextDecoder) {
  globalThis.TextDecoder = TextDecoder
}
