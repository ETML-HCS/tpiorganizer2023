import { loadPdfDocumentConstructor } from "./pdfDocumentLoader"

test("loadPdfDocumentConstructor resolves the named pdf-lib export", async () => {
  const PDFDocument = { load: jest.fn() }
  const importer = jest.fn(() => Promise.resolve({ PDFDocument }))

  await expect(loadPdfDocumentConstructor(importer)).resolves.toBe(PDFDocument)
  expect(importer).toHaveBeenCalledTimes(1)
})

test("loadPdfDocumentConstructor supports default export shapes", async () => {
  const defaultDocument = { load: jest.fn() }

  await expect(
    loadPdfDocumentConstructor(() => Promise.resolve({ default: defaultDocument }))
  ).resolves.toBe(defaultDocument)

  await expect(
    loadPdfDocumentConstructor(() =>
      Promise.resolve({ default: { PDFDocument: defaultDocument } })
    )
  ).resolves.toBe(defaultDocument)
})

test("loadPdfDocumentConstructor fails clearly when PDFDocument is unavailable", async () => {
  await expect(
    loadPdfDocumentConstructor(() => Promise.resolve({ default: null }))
  ).rejects.toThrow("Impossible de charger PDFDocument depuis pdf-lib")
})
