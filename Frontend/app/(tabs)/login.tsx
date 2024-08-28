import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const windowWidth = Dimensions.get('window').width;

export default function Login() {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verifyPassword, setVerifyPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);

  const handleSubmit = async () => {
    try {
      const url = isLogin ? 'http://localhost:5000/signin' : 'http://localhost:5000/signup';
      const body = isLogin
        ? JSON.stringify({ useremail: email, password: password })
        : JSON.stringify({ useremail: email, password: password, verifyPassword: verifyPassword });
  
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: body,
      });
  
      const data = await response.json();
  
      if (response.ok) {
        // Handle successful login or signup
        console.log(`${isLogin ? 'Signin' : 'Signup'} successful:`, data.message);
        // Navigate to a different screen if login/signup is successful
        // navigation.navigate('Home');
      } else {
        // Handle error
        console.error(`${isLogin ? 'Signin' : 'Signup'} failed:`, data.message);
        alert(data.message);
      }
    } catch (error) {
      console.error(`Error during ${isLogin ? 'signin' : 'signup'}:`, error);
      alert('An error occurred. Please try again.');
    }
  };
  

    // const handleSubmit = async () => {
    //   if (isLogin) {
    //     try {
    //       console.log("request started")
    //       // Prepare the data to send in the request
    //       const response = await fetch('http://localhost:5000/signin', {
    //         method: 'POST',
    //         headers: {
    //           'Content-Type': 'application/json',
    //         },
    //         body: JSON.stringify({
    //           useremail: email,
    //           password: password,
    //         }),
    //       });
    
    //       const data = await response.json();
    
    //       if (response.ok) {
    //         // Handle successful login
    //         console.log('Signin successful:', data.message);
    //         // Navigate to a different screen if login is successful
    //         // navigation.navigate('Home');
    //       } else {
    //         // Handle error
    //         console.error('Signin failed:', data.message);
    //         alert(data.message);
    //       }
    //     } catch (error) {
    //       console.error('Error during signin:', error);
    //       alert('An error occurred. Please try again.');
    //     }
    //   } else {
    //     // Handle signup logic if required
    //     console.log('Signup logic to be implemented');
      
    // };
    
  // };

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
          <TextInput
            style={styles.input}
            placeholder="Verify Password"
            value={verifyPassword}
            onChangeText={setVerifyPassword}
            secureTextEntry
          />
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