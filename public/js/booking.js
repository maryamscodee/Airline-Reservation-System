/**
 * Flight Booking Controller
 * Handles flight selection, real-time fare calculation, and transactional booking submission
 */

let availableFlightsMap = new Map();
let currentSelectedFlight = null;

document.addEventListener('DOMContentLoaded', async () => {
  const flightSelect = document.getElementById('flight_select');
  const seatsInput = document.getElementById('number_of_seats');
  const bookingForm = document.getElementById('bookingForm');

  const params = new URLSearchParams(window.location.search);
  const targetFlightId = params.get('flight_id');
  const seatsParam = params.get('seats') || params.get('passengers');
  if (seatsParam && seatsInput) {
    seatsInput.value = seatsParam;
  }

  await loadFlightOptions(targetFlightId);

  flightSelect.addEventListener('change', () => {
    const flightId = flightSelect.value;
    currentSelectedFlight = availableFlightsMap.get(flightId) || null;
    updateFlightSummaryAndPrice();
  });

  seatsInput.addEventListener('input', () => {
    updateFlightSummaryAndPrice();
  });

  bookingForm.addEventListener('submit', handleBookingSubmit);
});

async function loadFlightOptions(preselectedId = null) {
  const flightSelect = document.getElementById('flight_select');

  try {
    const res = await fetch('/api/flights?status=Scheduled');
    const json = await res.json();

    if (!json.success || !json.data) {
      flightSelect.innerHTML = '<option value="">Failed to load flights</option>';
      return;
    }

    const flights = json.data.filter(f => f.available_seats > 0);
    availableFlightsMap.clear();

    let options = '<option value="">-- Choose an available flight --</option>';
    flights.forEach(f => {
      availableFlightsMap.set(f._id, f);
      const isSelected = preselectedId && f._id === preselectedId ? 'selected' : '';
      options += `<option value="${f._id}" ${isSelected}>
        ${f.flight_number} - ${f.airline} (${f.departure_city} &rarr; ${f.destination_city}) - ${formatCurrency(f.ticket_price)} (${f.available_seats} seats left)
      </option>`;
    });

    flightSelect.innerHTML = options;

    if (preselectedId && availableFlightsMap.has(preselectedId)) {
      currentSelectedFlight = availableFlightsMap.get(preselectedId);
      updateFlightSummaryAndPrice();
    }
  } catch (err) {
    console.error('Error loading flights for dropdown:', err);
  }
}

function updateFlightSummaryAndPrice() {
  const summaryBox = document.getElementById('flightSummaryBox');
  const totalPriceDisplay = document.getElementById('totalPriceDisplay');
  const seatsInput = document.getElementById('number_of_seats');

  const seats = parseInt(seatsInput.value, 10) || 1;

  if (!currentSelectedFlight) {
    summaryBox.style.display = 'none';
    totalPriceDisplay.textContent = 'Rs. 0';
    return;
  }

  summaryBox.style.display = 'block';
  document.getElementById('sumFlightNum').textContent = `${currentSelectedFlight.flight_number} (${currentSelectedFlight.airline})`;
  document.getElementById('sumRoute').textContent = `${currentSelectedFlight.departure_city} &rarr; ${currentSelectedFlight.destination_city} | Dep: ${currentSelectedFlight.departure_time}`;
  document.getElementById('sumPrice').textContent = `${formatCurrency(currentSelectedFlight.ticket_price)} / seat`;
  document.getElementById('sumSeats').textContent = `${currentSelectedFlight.available_seats} seats remaining`;

  // Max seats allowed on form capped by available
  seatsInput.max = currentSelectedFlight.available_seats;

  const total = currentSelectedFlight.ticket_price * seats;
  totalPriceDisplay.textContent = formatCurrency(total);
}

async function handleBookingSubmit(e) {
  e.preventDefault();

  const flightId = document.getElementById('flight_select').value;
  const name = document.getElementById('passenger_name').value.trim();
  const email = document.getElementById('passenger_email').value.trim();
  const phone = document.getElementById('passenger_phone').value.trim();
  const seats = parseInt(document.getElementById('number_of_seats').value, 10);
  const submitBtn = document.getElementById('submitBookingBtn');

  if (!flightId) {
    showAlert('Please select a flight to book.', 'danger', 'bookingAlertArea');
    return;
  }

  if (seats <= 0) {
    showAlert('Please select at least 1 seat.', 'danger', 'bookingAlertArea');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Processing MongoDB Transaction...';

  try {
    const response = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        flight_id: flightId,
        name,
        email,
        phone,
        number_of_seats: seats
      })
    });

    const result = await response.json();

    if (!result.success) {
      showAlert(result.message || 'Failed to complete booking transaction.', 'danger', 'bookingAlertArea');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Confirm & Book Flight';
      return;
    }

    // Success: render confirmation card
    const booking = result.data;
    document.getElementById('bookingFormCard').style.display = 'none';
    const confCard = document.getElementById('confirmationCard');
    confCard.style.display = 'block';

    document.getElementById('confRefCode').textContent = booking.booking_reference;
    document.getElementById('confDetails').innerHTML = `
      <strong>Passenger:</strong> ${name} (${email}, ${phone})<br>
      <strong>Flight:</strong> ${currentSelectedFlight ? currentSelectedFlight.flight_number + ' - ' + currentSelectedFlight.airline : 'Flight #' + flightId}<br>
      <strong>Route:</strong> ${currentSelectedFlight ? currentSelectedFlight.departure_city + ' &rarr; ' + currentSelectedFlight.destination_city : '-'}<br>
      <strong>Number of Seats:</strong> ${booking.number_of_seats}<br>
      <strong>Total Paid:</strong> ${formatCurrency(booking.total_amount)}<br>
      <strong>Booking Date:</strong> ${new Date(booking.booking_date).toLocaleString()}<br>
      <strong>Status:</strong> <span class="status-badge status-confirmed">Confirmed</span><br>
      <small style="color: var(--text-muted); margin-top: 0.5rem; display: block;">
        Transaction Mode: <strong>${result.transactionMode || 'MongoDB Transaction'}</strong>
      </small>
    `;

    showAlert('Reservation completed successfully!', 'success', 'bookingAlertArea');
    window.scrollTo({ top: 0, behavior: 'smooth' });

  } catch (err) {
    console.error('Error submitting booking:', err);
    showAlert('A network error occurred while communicating with the backend.', 'danger', 'bookingAlertArea');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Confirm & Book Flight';
  }
}

function resetBookingForm() {
  document.getElementById('bookingForm').reset();
  document.getElementById('confirmationCard').style.display = 'none';
  document.getElementById('bookingFormCard').style.display = 'block';
  document.getElementById('bookingAlertArea').innerHTML = '';
  currentSelectedFlight = null;
  updateFlightSummaryAndPrice();
}
