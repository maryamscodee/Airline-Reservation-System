/**
 * Common Frontend Utilities & Navigation Controller
 */

// Highlight active link in navbar
document.addEventListener('DOMContentLoaded', () => {
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  const navLinks = document.querySelectorAll('.nav-links a');
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPath || (currentPath === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });

  // Populate city dropdowns if present on page
  populateCityDropdowns();
});

/**
 * Format currency in Pakistani Rupees (PKR)
 */
function formatCurrency(amount) {
  if (amount === undefined || amount === null) return 'Rs. 0';
  return 'Rs. ' + Number(amount).toLocaleString();
}

/**
 * Display floating or inline alert message
 */
function showAlert(message, type = 'info', containerId = null) {
  const alertHtml = `
    <div class="alert alert-${type}">
      <span>${message}</span>
      <button type="button" class="modal-close" onclick="this.parentElement.remove()" style="font-size: 1.1rem;">&times;</button>
    </div>
  `;

  if (containerId) {
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = alertHtml;
      return;
    }
  }

  // Fallback to top of main container
  const mainContainer = document.querySelector('.container');
  if (mainContainer) {
    const div = document.createElement('div');
    div.innerHTML = alertHtml;
    mainContainer.insertBefore(div.firstElementChild, mainContainer.firstChild);
    setTimeout(() => {
      const alert = mainContainer.querySelector('.alert');
      if (alert) alert.remove();
    }, 6000);
  }
}

/**
 * Auto-populate departure and destination city dropdowns from backend API
 */
async function populateCityDropdowns() {
  const depSelect = document.getElementById('departure_city');
  const destSelect = document.getElementById('destination_city');

  if (!depSelect && !destSelect) return;

  try {
    const res = await fetch('/api/flights/meta/cities');
    const json = await res.json();

    if (json.success && json.data) {
      const { departureCities, destinationCities } = json.data;

      if (depSelect) {
        const currentVal = depSelect.value;
        let options = '<option value="">All Departure Cities</option>';
        departureCities.forEach(city => {
          options += `<option value="${city}">${city}</option>`;
        });
        depSelect.innerHTML = options;
        if (currentVal) depSelect.value = currentVal;
      }

      if (destSelect) {
        const currentVal = destSelect.value;
        let options = '<option value="">All Destination Cities</option>';
        destinationCities.forEach(city => {
          options += `<option value="${city}">${city}</option>`;
        });
        destSelect.innerHTML = options;
        if (currentVal) destSelect.value = currentVal;
      }
    }
  } catch (err) {
    console.error('Failed to load cities:', err);
  }
}
