import React, { useState, useEffect } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = momentLocalizer(moment);

export default function CalendarComponent() {
  const [dealsEvents, setDealsEvents] = useState([]);
  const [seasonalEvents, setSeasonalEvents] = useState([]);
  const [calendarMode, setCalendarMode] = useState('dealsCalendar'); // 'dealsCalendar' or 'seasonalCalendar'

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        // Fetch deals calendar events
        const response1 = await fetch('http://localhost:5000/deal-dates');
        const data1 = await response1.json();
        const formattedDealsEvents = data1.map((event) => ({
          title: event.occasion,
          start: new Date(event.start_year, event.start_month - 1, event.start_day),
          end: new Date(event.end_year, event.end_month - 1, event.end_day),
        }));
        setDealsEvents(formattedDealsEvents);

        // Fetch seasonal calendar events
        const response2 = await fetch('http://localhost:5000/seasonal-dates');
        const data2 = await response2.json();
        const formattedSeasonalEvents = data2.map((event) => ({
          title: event.occasion,
          start: new Date(event.start_year, event.start_month - 1, event.start_day),
          end: new Date(event.end_year, event.end_month - 1, event.end_day),
          fruits: event.fruits_and_veg,  // Store fruits_and_veg in the event
        }));
        setSeasonalEvents(formattedSeasonalEvents);
      } catch (error) {
        console.error('Error fetching events:', error);
      }
    };

    fetchEvents();
  }, []);

  const eventsToDisplay = calendarMode === 'dealsCalendar' ? dealsEvents : seasonalEvents;

  return (
    <div style={{ height: '80vh', padding: '20px' }}>
      {/* Toggle Button */}
      <button
        onClick={() =>
          setCalendarMode(calendarMode === 'dealsCalendar' ? 'seasonalCalendar' : 'dealsCalendar')
        }
        style={{ marginBottom: '10px', padding: '10px 20px', cursor: 'pointer' }}
      >
        {calendarMode === 'dealsCalendar' ? 'Switch to Seasonal Calendar' : 'Switch to Deals Calendar'}
      </button>

      {/* Conditional Display for Seasonal Fruits and Vegetables */}
      {calendarMode === 'seasonalCalendar' && (
        <div style={{ marginBottom: '20px' }}>
          <h3>Fruits and Vegetables in Season:</h3>
          <ul>
            {seasonalEvents.map((event, index) => (
              <li key={index}>
                <strong>{event.title}</strong>: {event.fruits ? event.fruits.join(', ') : 'No data available'}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Calendar Display */}
      <div style={{ height: '80vh', width: '50vw' }}>
        <Calendar
          localizer={localizer}
          events={eventsToDisplay}
          views={['month']} // Show only the "month" view
          defaultView="month" // Start in "month" view
          style={{ height: '100%', width: '100%' }}
        />
      </div>
    </div>
  );
}
