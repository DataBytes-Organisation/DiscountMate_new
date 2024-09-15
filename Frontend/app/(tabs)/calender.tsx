import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Calendar from 'react-calendar';
import './calendar.css'; // Make sure to import the default styles

export default function Calender() {
    const [value, onChange] = useState(new Date());

    return (
        <View style={styles.container}>
            <Calendar 
                onChange={onChange} 
                value={value} 
                onClickDay={() => {}}
                className="styled-calendar" // Custom class
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
