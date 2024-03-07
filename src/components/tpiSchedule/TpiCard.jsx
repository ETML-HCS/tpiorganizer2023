import React, { useState, useEffect, useRef } from 'react'
import { useDrag } from 'react-dnd'
import { ItemTypes } from './Constants'
import { getTpiModels } from '../tpiControllers/TpiController'

const TpiCard = ({ tpi, isEditingTpiCard, onUpdateTpi }) => {
  const [editedTpi, setEditedTpi] = useState(tpi)
  const [tpiList, setTpiList] = useState([])
  const [selectedCandidate, setSelectedCandidate] = useState('')
  const [assignedRefTpis, setAssignedRefTpis] = useState([])
  const [location, setLocation] = useState(null)
  const selectRef = useRef(null)
  const refTpiContainerRef = useRef(null)
  const [isSelectOpen, setIsSelectOpen] = useState(false)

  const handleToggleSelect = () => {
    setIsSelectOpen(prevState => !prevState)
  }

  const findParentWithClass = (element, className) => {
    if (!element) return null
    let currentElement = element
    while (currentElement !== null) {
      if (
        currentElement.classList &&
        currentElement.classList.contains(className)
      ) {
        return currentElement
      }
      currentElement = currentElement.parentElement
    }
    return null
  }

  useEffect(() => {

    // attention l'objet ne possède pas la propriété name et offres 
    // il s'agit d'un tpi à sa plus simple expression 
    const fetchTpiModels = async () => {

      const tpiData = await getTpiModels()
      const refTpiElements = document.getElementsByClassName('refTpi')

      const assignedRefTpis = Array.from(refTpiElements).map(element =>
        element.textContent.trim()
      )
      setTpiList(tpiData);
      setAssignedRefTpis(assignedRefTpis)

      // Recherche le parent avec la classe "date-room site_cfpv" ou "date-room site_etml"
      if (findParentWithClass(selectRef.current, 'site_etml')) {
        setLocation('ETML-Sébeillon')
      } else if (findParentWithClass(selectRef.current, 'site_cfpv')) {
        setLocation('ETML-Vennes')
      }
    }

    fetchTpiModels()

  }, [isSelectOpen])

  useEffect(() => {
    // Filtrer les options déjà attribuées
    const filteredTpiList = tpiList.filter(
      tpiItem => !assignedRefTpis.includes(tpiItem.refTpi)
    )
    setTpiList(filteredTpiList)
  }, [assignedRefTpis])

  useEffect(() => {
    if (selectedCandidate && tpiList && tpiList.length > 0) {
      const selectedTpi = tpiList.find(
        item => item.refTpi === selectedCandidate
      )

      if (selectedTpi) {
        setEditedTpi(prevEditedTpi => ({
          ...prevEditedTpi,
          refTpi: selectedTpi.refTpi,
          candidat: selectedTpi.candidat,
          expert1: { name: selectedTpi.expert1 },
          expert2: { name: selectedTpi.expert2 },
          boss: { name: selectedTpi.boss }
        }))
      }
    }
  }, [selectedCandidate, tpiList])

  useEffect(() => {
    setEditedTpi(tpi)
  }, [tpi])

  useEffect(() => {
    if (isEditingTpiCard) {
      onUpdateTpi(editedTpi)
    }
  }, [isEditingTpiCard])

  // Utilisez useEffect pour gérer la fermeture de la liste 
  // lorsque l'utilisateur clique à l'extérieur du composant
  useEffect(() => {
    const handleClickOutside = event => {
      if (selectRef.current && !selectRef.current.contains(event.target)) {
        setIsSelectOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleChangeCandidat = (e, field) => {
    const updatedTpi = {
      ...editedTpi,
      [field]: e.target.value
    }
    setEditedTpi(updatedTpi)
    onUpdateTpi(updatedTpi)
  }

  const handleChange = (e, field) => {
    const updatedTpi = {
      ...editedTpi,
      [field]: {
        ...editedTpi[field], // Copie des propriétés actuelles de l'objet imbriqué
        name: e.target.value // Mise à jour de la propriété 'name' de l'objet imbriqué
      }
    };
    setEditedTpi(updatedTpi);
    onUpdateTpi(updatedTpi);
  };
  

  const handleSelectChange = e => {
    setSelectedCandidate(e.target.value)
  }

  const [{ isDragging }, dragRef] = useDrag({
    type: ItemTypes.TPI_CARD,
    item: { tpi },
    collect: monitor => ({
      isDragging: monitor.isDragging()
    })
  })

  const formatDate = (date) => {
    const options = { year: '2-digit', month: '2-digit', day: '2-digit' };
    return new Date(date).toLocaleDateString('fr-CH', options);
  };

  const isExpert1Proposal = (tpi.expert1.offres?.submit?.length ?? 0) > 0 ? "🗓️" : '';
  const isExpert2Proposal = (tpi.expert2.offres?.submit?.length ?? 0) > 0 ? "🗓️" : '';
  const isBossProposal = (tpi.boss.offres?.submit?.length ?? 0) > 0 ? "🗓️" : '';

  const expert1Title = tpi.expert1.offres?.submit?.map((item) =>
    `${formatDate(item.date)}/${item.creneau}`
  ).join('\n') ?? '';

  const expert2Title = tpi.expert2.offres?.submit?.map((item) =>
    `${formatDate(item.date)}/${item.creneau}`
  ).join('\n') ?? '';

  const bossTitle = tpi.boss.offres?.submit?.map((item) =>
    `${formatDate(item.date)}/${item.creneau}`
  ).join('\n') ?? '';

  return (
    <div ref={dragRef} className={`tpiCard ${isDragging ? 'dragging' : ''}`}>
      {isEditingTpiCard ? (
        <>
          <div className='eidtCandidat'>
            <input
              type='text'
              className='edit'
              value={editedTpi.candidat || ''}
              onChange={e => handleChangeCandidat(e, 'candidat')}
            />
            <div
              ref={refTpiContainerRef}
              style={{ display: 'none' }}
              className='refTpi'
            >
              {editedTpi.refTpi}{' '}
            </div>

            <div className='btTpiListSite' onClick={handleToggleSelect}>
              {' '}
              ▼{' '}
            </div>

            {isSelectOpen && tpiList.length > 0 && (
              <select
                ref={selectRef}
                className='edit'
                value={selectedCandidate}
                onChange={handleSelectChange}
              >
                {tpiList.map(item => {
                  const isMatchingLocation = item.lieu === location
                  const isAssigned = assignedRefTpis.includes(item.refTpi)

                  if (!isAssigned && isMatchingLocation) {
                    return (
                      <option key={item.refTpi} value={item.refTpi}>
                        {item.refTpi + ' ' + item.candidat + ' ' + item.lieu}
                      </option>
                    )
                  }
                  return null
                })}
              </select>
            )}
          </div>

          <input
            type='text'
            className='edit'
            value={editedTpi.expert1.name || ''}
            onChange={e => handleChange(e, 'expert1')}
          />
          <input
            type='text'
            className='edit'
            value={editedTpi.expert2.name || ''}
            onChange={e => handleChange(e, 'expert2')}
          />
          <input
            type='text'
            className='edit'
            value={editedTpi.boss.name || ''}
            onChange={e => handleChange(e, 'boss')}
          />
        </>
      ) : (
        <>
          <div className='debug'>{editedTpi.id}</div>

          <div className='candidat'>
            <span role='img' aria-label='star' className='star-icon'>
              🎓
            </span>
            {editedTpi.candidat}
          </div>

          <div className='expert custom-popup' data-popup-text={expert1Title}>
            <span role='img' aria-label='checkmark' className='boss-icon'>
              🛠️
            </span>
            {editedTpi.expert1.name}
            <span className='icon-proposal'>{isExpert1Proposal}</span>
          </div>

          <div className='expert custom-popup' data-popup-text={expert2Title}>
            <span role='img' aria-label='checkmark'>
              🛠️
            </span>
            {editedTpi.expert2.name}
            <span className='icon-proposal'>{isExpert2Proposal}</span>
          </div>

          <div className='boss custom-popup' data-popup-text={bossTitle} >
            <span role='img' aria-label='boss'>
              💼
            </span>
            {editedTpi.boss.name}
            <span className='icon-proposal'>{isBossProposal}</span>
          </div>

        </>
      )}
    </div>
  )
}

export default TpiCard
