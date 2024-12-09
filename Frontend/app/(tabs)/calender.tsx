import React, { useState, useEffect } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = momentLocalizer(moment);

export default function CalendarComponent() {
  const [dealsEvents, setDealsEvents] = useState([]); // State for deal events
  const [seasonalEvents, setSeasonalEvents] = useState([]); // State for seasonal events
  const [fruitsAndVeg, setFruitsAndVeg] = useState([]); // State for seasonal fruits/vegetables
  const [calendarMode, setCalendarMode] = useState('dealsCalendar'); // Calendar mode toggle ('dealsCalendar' or 'seasonalCalendar')

  // Fetch events when the component mounts
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
          fruits_and_veg: event.fruits_and_veg,  // Store fruits_and_veg in the event
        }));
        setSeasonalEvents(formattedSeasonalEvents);
      } catch (error) {
        console.error('Error fetching events:', error);
      }
    };

    fetchEvents();
  }, []);

  // Handle month navigation and set fruits data based on the month
  const handleNavigate = (date: Date) => {
    const month = moment(date).format('MMMM'); // Get the month name
    let seasonalEvent = null;

    // Find the corresponding seasonal event based on the month
    if (['December', 'January', 'February'].includes(month)) {
      seasonalEvent = seasonalEvents.find(event => event.title === 'Summer');
    } else if (['March', 'April', 'May'].includes(month)) {
      seasonalEvent = seasonalEvents.find(event => event.title === 'Autumn');
    } else if (['June', 'July', 'August'].includes(month)) {
      seasonalEvent = seasonalEvents.find(event => event.title === 'Winter');
    } else if (['September', 'October', 'November'].includes(month)) {
      seasonalEvent = seasonalEvents.find(event => event.title === 'Spring');
    }

    // Set the fruits and vegetables based on the seasonal event found
    if (seasonalEvent) {
      setFruitsAndVeg(seasonalEvent.fruits_and_veg || []);
    }
  };

  // Determine which events to display based on the selected calendar mode
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
          <p>
            {fruitsAndVeg.length > 0 ? fruitsAndVeg.join(', ') : 'No seasonal data available'}
          </p>
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
          onNavigate={handleNavigate} // Attach the onNavigate handler
        />
      </div>
    </div>
  );
}
