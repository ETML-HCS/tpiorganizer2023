window.addEventListener('DOMContentLoaded', function() {
    const rootElement = document.getElementById('root');
    const headerElement = document.getElementById('header');
    
    function updateRoomPaddingTop() {
      const headerHeight = headerElement.offsetHeight;
      const windowHeight = window.innerHeight;
      const roomPaddingTop = windowHeight - headerHeight;
      
      rootElement.style.setProperty('--room-padding-top', `${roomPaddingTop}px`);
    }
    
    window.addEventListener('resize', updateRoomPaddingTop);
    
    updateRoomPaddingTop();
  });
  