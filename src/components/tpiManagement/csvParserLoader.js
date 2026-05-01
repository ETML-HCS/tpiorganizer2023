export const loadCsvParser = async (
  importer = () => import("papaparse")
) => {
  const csvParserModule = await importer()
  const parser = csvParserModule.default || csvParserModule

  if (!parser?.parse) {
    throw new Error("Impossible de charger le parseur CSV")
  }

  return parser
}
