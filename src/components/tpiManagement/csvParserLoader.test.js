import { loadCsvParser } from './csvParserLoader.js'

test('loadCsvParser resolves the default papaparse export', async () => {
  const parser = { parse: jest.fn() }
  const importer = jest.fn(() => Promise.resolve({ default: parser }))

  await expect(loadCsvParser(importer)).resolves.toBe(parser)
  expect(importer).toHaveBeenCalledTimes(1)
})

test('loadCsvParser supports module-shaped parser exports', async () => {
  const parser = { parse: jest.fn() }

  await expect(
    loadCsvParser(() => Promise.resolve(parser))
  ).resolves.toBe(parser)
})

test('loadCsvParser fails clearly when parse is unavailable', async () => {
  await expect(
    loadCsvParser(() => Promise.resolve({ default: {} }))
  ).rejects.toThrow('Impossible de charger le parseur CSV')
})
