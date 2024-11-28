import React, { useState } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = momentLocalizer(moment);

export default function CalendarComponent() {
  const [events, setEvents] = useState([
    {
      title: 'Meeting with Team',
      start: new Date(2024, 10, 27, 10, 0), // Example date: Nov 27, 2024, 10:00 AM
      end: new Date(2024, 10, 27, 11, 0),
    },
    {
      title: 'Lunch Break',
      start: new Date(2024, 10, 27, 12, 0),
      end: new Date(2024, 10, 27, 13, 0),
    },
  ]);

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
