export const loadPdfDocumentConstructor = async (
  importer = () => import("pdf-lib")
) => {
  const pdfLibModule = await importer()
  const PDFDocument =
    pdfLibModule.PDFDocument ||
    pdfLibModule.default?.PDFDocument ||
    pdfLibModule.default

  if (!PDFDocument) {
    throw new Error("Impossible de charger PDFDocument depuis pdf-lib")
  }

  return PDFDocument
}
