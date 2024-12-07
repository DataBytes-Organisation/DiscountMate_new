import React, { useState, useEffect } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = momentLocalizer(moment);

export default function CalendarComponent() {
  const [events, setEvents] = useState([]);

  // Fetch events from the backend API
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await fetch('http://localhost:5000/calender-dates'); // API coming from running the backend folder
        const data = await response.json();

        // Transform the data into the format required by react-big-calendar
        const formattedEvents = data.map((event) => ({
          title: event.occasion, // Occasion contains the event title
          start: new Date(event.start_year, event.start_month - 1, event.start_day), // Convert to Date object
          end: new Date(event.end_year, event.end_month - 1, event.end_day), // Convert to Date object
        }));

        setEvents(formattedEvents);
      } catch (error) {
        console.error('Error fetching events:', error);
      }
    };

    fetchEvents();
  }, []); // Empty dependency array ensures this runs once when the component mounts

  return (
    <div style={{ height: '80vh', padding: '20px', display: 'flex', justifyContent: 'flex-start' }}>
      <div style={{ height: '80vh', width: '50vw' }}>
        <Calendar
          localizer={localizer}
          events={events}
          views={['month']} // Show only the "month" view
          defaultView="month" // Start in "month" view
          style={{ height: '100%', width: '100%' }}
        />
      </div>
    </div>
  );
}
