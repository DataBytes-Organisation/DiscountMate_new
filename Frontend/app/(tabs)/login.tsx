import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from './AuthContext';  // Import the useAuth hook

const windowWidth = Dimensions.get('window').width;

export default function Login() {
  const navigation = useNavigation();
  const { login } = useAuth();  // Use the login function from AuthContext
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verifyPassword, setVerifyPassword] = useState('');
  const [userFname, setUserFname] = useState('');
  const [userLname, setUserLname] = useState('');
  const [address, setAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLogin, setIsLogin] = useState(true);

  const handleSubmit = async () => {
    try {
      console.log('handleSubmit called');  // Debug statement

      const url = isLogin ? 'http://localhost:5000/signin' : 'http://localhost:5000/signup';
      console.log('API URL:', url);  // Debug statement

      const body = isLogin
        ? JSON.stringify({ useremail: email, password: password })
        : JSON.stringify({
            useremail: email,
            password: password,
            verifyPassword: verifyPassword,
            user_fname: userFname,
            user_lname: userLname,
            address: address,
            phone_number: phoneNumber
          });

      console.log('Request Body:', body);  // Debug statement

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: body,
      });

      console.log('Response received:', response);  // Debug statement

      const data = await response.json();
      console.log('Response JSON:', data);  // Debug statement

      if (response.ok && isLogin) {
        console.log('Signin successful:', data.message);

        // Use the login function to update the auth context and navigate to profile
        login(data.token);

      } else if (!response.ok) {
        console.error('Signin failed:', data.message);
        alert(data.message);
      }
    } catch (error) {
      console.error('Error during signin:', error);
      alert('An error occurred. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>
      <View style={styles.formContainer}>
        <Text style={styles.title}>{isLogin ? 'Login' : 'Sign Up'}</Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        {!isLogin && (
          <>
            <TextInput
              style={styles.input}
              placeholder="Verify Password"
              value={verifyPassword}
              onChangeText={setVerifyPassword}
              secureTextEntry
            />
            <TextInput
              style={styles.input}
              placeholder="First Name"
              value={userFname}
              onChangeText={setUserFname}
            />
            <TextInput
              style={styles.input}
              placeholder="Last Name"
              value={userLname}
              onChangeText={setUserLname}
            />
            <TextInput
              style={styles.input}
              placeholder="Address"
              value={address}
              onChangeText={setAddress}
            />
            <TextInput
              style={styles.input}
              placeholder="Phone Number"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
            />
          </>
        )}
        <TouchableOpacity onPress={handleSubmit} style={styles.submitButton}>
          <Text style={styles.submitButtonText}>{isLogin ? 'Login' : 'Sign Up'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={styles.switchButton}>
          <Text style={styles.switchButtonText}>
            {isLogin ? 'Need an account? Sign Up' : 'Already have an account? Login'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  backButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    zIndex: 1,
  },
  backButtonText: {
    fontSize: 16,
    color: '#4CAF50',
  },
  formContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#ffffff',
    margin: windowWidth > 600 ? 100 : 20,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10,
    marginBottom: 15,
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
    marginTop: 10,
    width: '100%',
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  switchButton: {
    marginTop: 20,
  },
  switchButtonText: {
    color: '#4CAF50',
  },
});
