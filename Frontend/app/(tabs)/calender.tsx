import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Calendar from 'react-calendar';
import './calendar.css'; // Ensure custom CSS is imported

export default function CalendarComponent() {
    const [value, onChange] = useState(new Date());

    // Define the start and end dates for the range
    const startDate = new Date(2024, 10, 29); // 29 November 2024
    const endDate = new Date(2025, 0, 1); // 1 January 2025

    // Function to determine if a date falls within the range
    const isWithinRange = (date) => date >= startDate && date <= endDate;

    // Style the tiles in the range
    const tileContent = ({ date, view }) => {
        if (view === 'month' && isWithinRange(date)) {
            return (
                <div
                    style={{
                        backgroundColor: '#ADD8E6', // Light blue
                        borderRadius: '50%',
                        width: '80%',
                        height: '80%',
                        margin: 'auto',
                    }}
                />
            );
        }
        return null;
    };

    return (
        <View style={styles.container}>
            <Calendar 
                onChange={onChange} 
                value={value} 
                tileContent={tileContent}
                className="styled-calendar"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        backgroundColor: '#f0f8ff', // Light blue background
    },
});
