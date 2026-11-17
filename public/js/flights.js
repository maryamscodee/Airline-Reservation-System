/**
 * Flights Listing & Search Page Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('flightFilterForm');
  const resetBtn = document.getElementById('resetBtn');

  // Read URL search params
  const urlParams = new URLSearchParams(window.location.search);
  const depParam = urlParams.get('departure_city');
  const destParam = urlParams.get('destination_city');

  // Wait briefly for city dropdown options to populate, then set values
  setTimeout(() => {
    if (depParam && document.getElementById('departure_city')) {
      document.getElementById('departure_city').value = depParam;
    }
    if (destParam && document.getElementById('destination_city')) {
      document.getElementById('destination_city').value = destParam;
    }
    fetchAndRenderFlights();
  }, 200);

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      fetchAndRenderFlights();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      form.reset();
      fetchAndRenderFlights();
    });
  }
});

async function fetchAndRenderFlights() {
  const container = document.getElementById('flightsContainer');
  const resultsCount = document.getElementById('resultsCount');

  container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem;">Loading matching flights from MongoDB...</div>';

  const depCity = document.getElementById('departure_city')?.value || '';
  const destCity = document.getElementById('destination_city')?.value || '';
  const status = document.getElementById('status')?.value || '';
  const minPrice = document.getElementById('min_price')?.value || '';
  const maxPrice = document.getElementById('max_price')?.value || '';
  const sortCombined = document.getElementById('sort_by')?.value || 'departure_time-asc';

  const [sort_by, order] = sortCombined.split('-');

  const params = new URLSearchParams();
  if (depCity) params.append('departure_city', depCity);
  if (destCity) params.append('destination_city', destCity);
  if (status && status !== 'All') params.append('status', status);
  if (minPrice) params.append('min_price', minPrice);
  if (maxPrice) params.append('max_price', maxPrice);
  if (sort_by) params.append('sort_by', sort_by);
  if (order) params.append('order', order);

  try {
    const res = await fetch(`/api/flights?${params.toString()}`);
    const data = await res.json();

    if (!data.success) {
      container.innerHTML = `<div class="alert alert-danger" style="grid-column: 1/-1;">Error: ${data.message}</div>`;
      return;
    }

    const flights = data.data;
    resultsCount.textContent = `Found ${flights.length} flight(s) matching your criteria.`;

    if (flights.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 3rem; background: #fff; border-radius: 8px;">
          <h3>No flights found matching your search.</h3>
          <p style="color: var(--text-muted); margin-top: 0.5rem;">Try broadening your departure or destination filters.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = flights.map(flight => {
      const isBookable = flight.status === 'Scheduled' && flight.available_seats > 0;
      let seatClass = 'seats-available';
      if (flight.available_seats === 0) seatClass = 'seats-full';
      else if (flight.available_seats < 10) seatClass = 'seats-low';

      const statusClass = `status-${flight.status.toLowerCase()}`;

      return `
        <div class="flight-card">
          <div>
            <div class="flight-header">
              <div>
                <div class="flight-number">${flight.flight_number}</div>
                <div class="airline-name">${flight.airline}</div>
              </div>
              <span class="status-badge ${statusClass}">${flight.status}</span>
            </div>

            <div class="flight-route-display">
              <div class="route-stop">
                <div class="route-city">${flight.departure_city}</div>
                <div class="route-time">${flight.departure_time}</div>
              </div>
              <div class="route-plane">✈️ &rarr;</div>
              <div class="route-stop">
                <div class="route-city">${flight.destination_city}</div>
                <div class="route-time">${flight.arrival_time}</div>
              </div>
            </div>

            <div class="flight-details-list">
              <div>
                <div style="font-size: 0.8rem; color: var(--text-muted);">Ticket Price</div>
                <div class="flight-price">${formatCurrency(flight.ticket_price)}</div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 0.8rem; color: var(--text-muted);">Available Seats</div>
                <div class="flight-seats ${seatClass}">
                  ${flight.available_seats} / ${flight.total_seats}
                </div>
              </div>
            </div>
          </div>

          <div style="display: flex; gap: 0.75rem; margin-top: 1rem;">
            <a href="flight-details.html?id=${flight._id}" class="btn btn-outline btn-sm" style="flex: 1;">
              View Details
            </a>
            ${
              isBookable
                ? `<a href="booking.html?flight_id=${flight._id}" class="btn btn-accent btn-sm" style="flex: 1;">Book Now</a>`
                : `<button class="btn btn-sm" disabled style="flex: 1; background: #e2e8f0; color: #94a3b8; cursor: not-allowed;">Unavailable</button>`
            }
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Error fetching flights:', err);
    container.innerHTML = `<div class="alert alert-danger" style="grid-column: 1/-1;">Failed to connect to the flight service API.</div>`;
  }
}
