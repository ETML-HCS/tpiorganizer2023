// fonction avant le grand néttoyage :-) 


const fetchData = async () => {
    try {
      // Charger les données depuis la base de données uniquement si elles n'ont pas encore été chargées
      if (!isDbDataLoaded) {
        const dbData = await getTpiRooms();

        // Vérifier si des données sont sauvegardées dans localStorage
        const savedData = localStorage.getItem("organizerData");

        // Vérifier si localStorage et la base de données sont vides
        const isLocalStorageEmpty = !savedData;
        const isDbDataEmpty = !Array.isArray(dbData) || dbData.length === 0;

        if (isLocalStorageEmpty && isDbDataEmpty) {
          console.log("Il n'y a pas de données à charger.");
          // Si à la fois localStorage et la base de données sont vides, il n'y a pas de données à charger
          // Vous pouvez éventuellement initialiser un état vide ici si nécessaire
        } else if (isDbDataEmpty && savedData) {
          // Si la base de données est vide mais qu'il y a des données sauvegardées dans localStorage
          const savedRooms = JSON.parse(savedData);
          setNewRooms(savedRooms);
          console.log("Données chargées depuis le stockage local:", savedRooms);
          if (!setIsDbDataLoaded) {
            showNotification(
              "Les données actuellement chargées proviennent d'une sauvegarde locale. " +
              "Nous vous recommandons de faire une sauvegarde pour éviter toute perte de données.",
              4000
            );
          }
        } else {
          // Si dbData n'est pas vide, procéder comme précédemment
          if (savedData) {
            const savedRooms = JSON.parse(savedData);

            if (!Array.isArray(savedRooms) && Array.isArray(dbData)) {
              setNewRooms(dbData);
              return;
            }

            const lastSaveDate = new Date(
              savedRooms[savedRooms.length - 1].lastUpdate
            );
            const dbDataDate = new Date(dbData[dbData.length - 1].lastUpdate);

            if (dbDataDate > lastSaveDate) {
              setNewRooms(dbData);
              localStorage.setItem("organizerData", JSON.stringify(dbData));
              showNotification(
                "Les données actuellement chargées proviennent d'une sauvegarde locale. " +
                "Nous vous recommandons de faire une sauvegarde pour éviter toute perte de données.",
                4000
              );
            } else {
              setNewRooms(savedRooms);
            }
          } else {
            setNewRooms(dbData);
          }
        }
        setIsDbDataLoaded(true);
      }
    } catch (error) {
      console.error(
        "Erreur lors du chargement des données depuis la base de données :",
        error
      );
    }
  };