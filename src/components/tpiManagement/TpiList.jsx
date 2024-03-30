import React, { useState } from 'react'
import TpiForm from './TpiForm'

const MAX_DISPLAY_TAGS = 1

const TpiList = ({ tpiList, onSave }) => {
  const [editingTpiId, setEditingTpiId] = useState(null)
  const [displayedTags, setDisplayedTags] = useState({})
  const [filterTag, setFilterTag] = useState(null)
  const [displayMode, setDisplayMode] = useState('cards')

  const handleEdit = tpiRef => {
    console.log(tpiRef)
    setEditingTpiId(tpiRef)
  }

  const handleFormClose = () => {
    setEditingTpiId(null)
    console.log('valeur editing: ', editingTpiId)
  }

  const handleTagHover = (tpiRef, tag) => {
    setDisplayedTags(prevDisplayedTags => ({
      ...prevDisplayedTags,
      [tpiRef]: tag
    }))
  }

  const handleTagHoverExit = tpiRef => {
    setDisplayedTags(prevDisplayedTags => ({
      ...prevDisplayedTags,
      [tpiRef]: null
    }))
  }

  const handleFilterTag = tag => {
    setFilterTag(tag === filterTag ? null : tag)
  }

  const toggleDisplayMode = () => {
    setDisplayMode(prevMode => (prevMode === 'cards' ? 'table' : 'cards'))
  }

  return (
    <>
      <h2>Liste des TPI :</h2>
      <div className='btnDisplay'>
        <button onClick={toggleDisplayMode}>
          {displayMode === 'cards' ? 'Mode tableau' : 'Mode cartes'}
        </button>
      </div>
      {/* Ajoute des boutons pour chaque tag unique */}
      <div>
        <span>Filtrer par tag :</span>
        {Array.from(new Set(tpiList.flatMap(tpi => tpi.tags))).map(
          (tag, index) => (
            <button key={index} onClick={() => handleFilterTag(tag)}>
              {tag}
            </button>
          )
        )}
        <button onClick={() => handleFilterTag(null)}>Effacer filtre</button>
      </div>
      {/* Affiche la liste des TPI en fonction du tag de filtre */}

      {tpiList.length === 0 ? (
        <p>Aucun TPI trouvé.</p>
      ) : (
        <div>
          {/* Affichage des TPI en fonction du mode d'affichage */}
          {displayMode === 'cards' ? (
            <div>
              <ul className='tpiList'>
                {tpiList.map(
                  tpi =>
                    // Vérifie si le TPI correspond au tag de filtre (ou si aucun tag de filtre n'est défini)
                    (!filterTag || tpi.tags.includes(filterTag)) && (
                      <li key={tpi.refTpi}>
                        {editingTpiId === tpi.refTpi ? (
                          <TpiForm
                            tpiToLoad={tpi}
                            onSave={onSave}
                            onClose={handleFormClose}
                          />
                        ) : (
                          <div>
                            <span>
                              <strong>ID : {tpi.refTpi} </strong>
                            </span>
                            <div className='displayTagsContainer'>
                              {tpi.tags
                                .slice(0, MAX_DISPLAY_TAGS)
                                .map((tag, index) => (
                                  <span
                                    key={index}
                                    className='displayTags'
                                    onMouseEnter={() =>
                                      handleTagHover(tpi.refTpi, tag)
                                    }
                                    onMouseLeave={() =>
                                      handleTagHoverExit(tpi.refTpi)
                                    }
                                  >
                                    {tag}
                                  </span>
                                ))}
                              {tpi.tags.length > MAX_DISPLAY_TAGS && (
                                <span
                                  className='hiddenTags'
                                  onMouseEnter={() =>
                                    handleTagHover(
                                      tpi.refTpi,
                                      tpi.tags
                                        .slice(MAX_DISPLAY_TAGS)
                                        .join(', ')
                                    )
                                  }
                                  onMouseLeave={() =>
                                    handleTagHoverExit(tpi.refTpi)
                                  }
                                >
                                  {displayedTags[tpi.refTpi] ||
                                    `+${tpi.tags.length - MAX_DISPLAY_TAGS}`}
                                </span>
                              )}
                            </div>

                            <div style={{ textAlign: 'center' }}>
                              <strong>{tpi.candidat} </strong>
                            </div>
                            <span style={{ color: '#1e82ff' }}>
                              {tpi.sujet}
                            </span>

                            <span>Exp1 : {tpi.expert1}</span>
                            <span>Exp2 : {tpi.expert2}</span>
                            <span> &raquo; {tpi.boss}</span>
                            <span>Lieu : {tpi.lieu}</span>
                            {displayedTags[tpi.refTpi] && (
                              <div className='hoveredTag'>
                                {displayedTags[tpi.refTpi]}
                              </div>
                            )}

                            <div
                              className='btEdit'
                              onClick={() => handleEdit(tpi.refTpi)}
                            >
                              Modifier
                            </div>
                          </div>
                        )}
                      </li>
                    )
                )}
              </ul>
            </div>
          ) : (
            // Affichage des TPI sous forme de tableau
            <table className='tpiTable'>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Candidat</th>
                  <th>Titre TPI</th>
                  <th>Domaines</th>
                  <th>Expert 1</th>
                  <th>Expert 2</th>
                  <th>Manager</th>
                  <th>Lieu</th>
                  {/* Autres en-têtes de colonnes */}
                </tr>
              </thead>
              <tbody>
                {tpiList.map(
                  tpi =>
                    // Vérifie si le TPI correspond au tag de filtre (ou si aucun tag de filtre n'est défini)
                    (!filterTag || tpi.tags.includes(filterTag)) && (
                      <tr key={tpi.refTpi}>
                        <td>{tpi.refTpi}</td>
                        <td>{tpi.candidat}</td>
                        <td>{tpi.sujet}</td>
                        <td>{tpi.tags.join(', ')}</td>
                        <td>{tpi.expert1}</td>
                        <td>{tpi.expert2}</td>
                        <td>{tpi.boss}</td>
                        <td>{tpi.lieu}</td>
                        {/* Autres colonnes */}
                      </tr>
                    )
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  )
}
export default TpiList
