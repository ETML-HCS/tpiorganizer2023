import apiService from './apiService'

export const tpiDossierService = {
  getByRef: async (year, ref) => {
    const normalizedRef = encodeURIComponent(String(ref || '').trim())
    return await apiService.get(`/api/tpi-dossier/${year}/${normalizedRef}`)
  }
}

export default tpiDossierService
