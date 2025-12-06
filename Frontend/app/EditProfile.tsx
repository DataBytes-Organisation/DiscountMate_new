import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Picker } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useToast } from 'react-native-toast-notifications';
import { useNavigation } from '@react-navigation/native';

export default function EditProfile() {
  const navigation = useNavigation();
  const toast = useToast();

  const [user, setUser] = useState({
    email: '',
    password: '',
    verifyPassword: '',
    user_fname: '',
    user_lname: '',
    address: '',
    phone_number: '',
    persona: '',
  });

  const PERSONAS = ["Budget-conscious shopper 💸",
  "Health enthusiast 🥗",
  "Family planner 👨‍👩‍👧‍👦",
  "Convenience seeker ⚡",
  "Premium shopper 💎"];

  useEffect(() => {
    const loadProfile = async () => {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

      try {
        const res = await axios.get('http://localhost:3000/profile', {
          headers: { Authorization: `Bearer ${token}` },
        });

        setUser({
          ...user,
          email: res.data.email,
          user_fname: res.data.user_fname,
          user_lname: res.data.user_lname,
          address: res.data.address,
          phone_number: res.data.phone_number,
          persona: res.data.persona || '',
        });
      } catch (err) {
        console.log('Error loading profile:', err);
      }
    };

    loadProfile();
  }, []);

  const handleSave = async () => {
    if (user.password !== user.verifyPassword) {
      toast.show('Passwords do not match', { type: 'danger', placement: 'top' });
      return;
    }

    const token = await AsyncStorage.getItem('authToken');
    if (!token) return;

    try {
      await axios.put(
        'http://localhost:3000/api/users/update-profile',
        user,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.show('Profile updated successfully!', { type: 'success', placement: 'top' });

      navigation.navigate('Profile', { updatedProfile: user });
    } catch (error) {
      console.log('Error updating profile:', error);
      toast.show('Failed to update profile', { type: 'danger', placement: 'top' });
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Edit Profile</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={user.email}
        keyboardType="email-address"
        onChangeText={(text) => setUser({ ...user, email: text })}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={user.password}
        onChangeText={(text) => setUser({ ...user, password: text })}
      />

      <TextInput
        style={styles.input}
        placeholder="Verify Password"
        secureTextEntry
        value={user.verifyPassword}
        onChangeText={(text) => setUser({ ...user, verifyPassword: text })}
      />

      <TextInput
        style={styles.input}
        placeholder="First Name"
        value={user.user_fname}
        onChangeText={(text) => setUser({ ...user, user_fname: text })}
      />

      <TextInput
        style={styles.input}
        placeholder="Last Name"
        value={user.user_lname}
        onChangeText={(text) => setUser({ ...user, user_lname: text })}
      />

      <TextInput
        style={styles.input}
        placeholder="Address"
        value={user.address}
        onChangeText={(text) => setUser({ ...user, address: text })}
      />

      <TextInput
        style={styles.input}
        placeholder="Phone Number"
        keyboardType="phone-pad"
        value={user.phone_number}
        onChangeText={(text) => setUser({ ...user, phone_number: text })}
      />

      <View style={styles.pickerWrapper}>
        <Picker
          selectedValue={user.persona}
          onValueChange={(value) => setUser({ ...user, persona: value })}
          style={styles.picker}
        >
          <Picker.Item label=" Select Persona" value="" />
          {PERSONAS.map((p, i) => (
            <Picker.Item key={i} label={p} value={p} />
          ))}
        </Picker>
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Save Changes</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#f2f2f2', flex: 1 },
  header: { fontSize: 24, fontWeight: '700', marginBottom: 20 },
  input: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 10,
    fontSize: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  pickerWrapper: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fff',
    marginBottom: 15,
    height: 48,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  picker: {
    height: 48,
    width: '100%',
    borderColor: '#fff',
    marginLeft: -8,
    paddingLeft: 0,
    color: '#000',
  },
  saveButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 10,
  },
  saveButtonText: { color: '#fff', textAlign: 'center', fontSize: 18 },
});
