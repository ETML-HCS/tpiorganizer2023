import apiService from './apiService'

export const gestionTpiService = {
  listByYear: (year) =>
    apiService.get(`/api/gestion-tpi/${year}/tpis`),

  save: (year, tpi, options = {}) =>
    apiService.post(`/api/gestion-tpi/${year}/tpis`, {
      ...tpi,
      validationMode: options.validationMode || 'manual'
    }),

  update: (year, id, tpi) =>
    apiService.put(`/api/gestion-tpi/${year}/tpis/${id}`, tpi),

  deleteYear: (year) =>
    apiService.post(`/api/gestion-tpi/${year}/delete`, { confirm: true }),

  findByCandidate: (year, candidateName) =>
    apiService.get(
      `/api/gestion-tpi/${year}/by-candidate/${encodeURIComponent(String(candidateName || '').trim())}`
    )
}

export default gestionTpiService
