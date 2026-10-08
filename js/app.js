/* =========================================================
   js/app.js - Application Lifecycle & Global Event Listeners
   ========================================================= */

/* Global Keyboard Shortcuts */
window.addEventListener('keydown', e => {
  // If modal is currently displayed
  if($('#modalRoot')?.children.length > 0){
    if(e.key === 'Escape'){
      e.preventDefault();
      closeModal();
    }
    return;
  }

  // Active only when logged in and on the billing page
  if(state.user && state.page === 'billing'){
    if(e.key === 'F2'){
      e.preventDefault();
      focusSearch();
    } else if(e.key === 'F4'){
      e.preventDefault();
      if(state.cart.length) openCheckout();
      else toast('බිලට භාණ්ඩ එකතු කර නැත (Cart empty)', 'warn');
    } else if(e.key === 'F8'){
      e.preventDefault();
      clearCart();
    }
  }
});

/* Interval for topbar live clock */
setInterval(updateClock, 1000);

/* Application Bootstrapper Entry Point */
function initApp(){
  updateClock();
  if(typeof initLoginEnhancements === 'function'){
    initLoginEnhancements();
  } else {
    const uInp = $('#lUser');
    if(uInp) uInp.focus();
  }
}
