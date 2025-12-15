import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Dimensions, Switch, ScrollView, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from './AuthContext';
import { Picker } from '@react-native-picker/picker';
import { API_URL } from '../../constants/Api';


const windowWidth = Dimensions.get('window').width;

const PERSONAS = [
   "Budget-conscious shopper 💸",
   "Health enthusiast 🥗",
   "Family planner 👨‍👩‍👧‍👦",
   "Convenience seeker ⚡",
   "Premium shopper 💎"
];

const PASSWORD_REQUIREMENTS = [
   { id: 1, text: 'At least 8 characters long' },
   { id: 2, text: 'At least one uppercase letter' },
   { id: 3, text: 'At least one number' },
   { id: 4, text: 'At least one special character (!@#$%^&*)' }
];

export default function Login() {
   const navigation = useNavigation();
   const { login } = useAuth();
   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
   const [verifyPassword, setVerifyPassword] = useState('');
   const [userFname, setUserFname] = useState('');
   const [userLname, setUserLname] = useState('');
   const [address, setAddress] = useState('');
   const [phoneNumber, setPhoneNumber] = useState('');
   const [isLogin, setIsLogin] = useState(true);
   const [isAdmin, setIsAdmin] = useState(false);
   const [errors, setErrors] = useState<{ [key: string]: string }>({});
   const [showPasswordRequirements, setShowPasswordRequirements] = useState(false);
   const [verificationCode, setVerificationCode] = useState('');
   const [tempToken, setTempToken] = useState('');
   const [showVerification, setShowVerification] = useState(false);
   const [persona, setPersona] = useState('');
   const [selectedPersona, setSelectedPersona] = useState('');
   const [showPersonaModal, setShowPersonaModal] = useState(false);
   const [isSubmitting, setIsSubmitting] = useState(false);

   // Check individual password requirements
   const checkPasswordRequirement = (password: string) => {
      return {
         length: password.length >= 8,
         uppercase: /[A-Z]/.test(password),
         number: /[0-9]/.test(password),
         special: /[!@#$%^&*]/.test(password)
      };
   };

   const validateForm = () => {
      const newErrors: { [key: string]: string } = {};

      // Email validation
      if (!email) {
         newErrors.email = 'Email is required';
      } else if (!/\S+@\S+\.\S+/.test(email)) {
         newErrors.email = 'Please enter a valid email address';
      }

      // Password validation
      if (!password) {
         newErrors.password = 'Password is required';
      } else {
         const requirements = checkPasswordRequirement(password);
         if (!requirements.length || !requirements.uppercase || !requirements.number || !requirements.special) {
            newErrors.password = 'Password does not meet all requirements';
         }
      }

      if (!isLogin) {
         if (!verifyPassword) {
            newErrors.verifyPassword = 'Please verify your password';
         } else if (password !== verifyPassword) {
            newErrors.verifyPassword = 'Passwords do not match';
         }

         if (!userFname) newErrors.userFname = 'First name is required';
         if (!userLname) newErrors.userLname = 'Last name is required';
         if (!persona) newErrors.persona = 'Please select a persona';
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
   };

   const handleVerificationSubmit = async () => {
      if (!verificationCode) {
         setErrors({ verification: 'Please enter the verification code' });
         return;
      }

      try {
         const response = await fetch('http://localhost:3000/verify-2fa', {
            method: 'POST',
            headers: {
               'Content-Type': 'application/json',
            },
            body: JSON.stringify({
               verificationCode,
               tempToken,
            }),
         });

         const data = await response.json();

         if (response.ok) {
            login(data.token);
         } else {
            setErrors({ verification: data.message });
         }
      } catch (error) {
         setErrors({ verification: 'An error occurred during verification' });
      }
   };

   const handleSubmit = async () => {
      if (!validateForm()) return;
      setIsSubmitting(true);

      try {
         const url = `${API_URL}/users/${isLogin ? 'signin' : 'signup'}`;

         const body = isLogin
            ? { email, password }
            : {
               email,
               password,
               verifyPassword,
               user_fname: userFname,
               user_lname: userLname,
               address,
               phone_number: phoneNumber,
               admin: isAdmin,
               persona
            };

         const response = await fetch(url, {
            method: 'POST',
            headers: {
               'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
         });

         const data = await response.json();

         if (response.ok) {
            if (isLogin) {
               // Backend returns JWT as data.token
               login(data.token);
            } else {
               alert('Signup successful, please login');
               setIsLogin(true);
               setEmail('');
               setPassword('');
               setVerifyPassword('');
               setUserFname('');
               setUserLname('');
               setAddress('');
               setPhoneNumber('');
               setIsAdmin(false);
               setErrors({});
            }
         } else {
            if (data.message === 'User with this email already exists') {
               setErrors({ email: data.message });
            } else {
               setErrors({ submit: data.message });
            }
         }
      } catch (error) {
         setErrors({ submit: 'An error occurred. Please try again.' });
      }
      setIsSubmitting(false);
   };

   const renderError = (field: string) => {
      return errors[field] ? (
         <Text style={styles.errorText}>{errors[field]}</Text>
      ) : null;
   };

   const renderPasswordRequirements = () => {
      if (!showPasswordRequirements || isLogin) return null;

      const requirements = checkPasswordRequirement(password);

      return (
         <View style={styles.requirementsContainer}>
            <Text style={styles.requirementsTitle}>Password Requirements:</Text>
            {PASSWORD_REQUIREMENTS.map((req) => (
               <View key={req.id} style={styles.requirementRow}>
                  <Text style={[
                     styles.requirementText,
                     (req.id === 1 && requirements.length) ||
                        (req.id === 2 && requirements.uppercase) ||
                        (req.id === 3 && requirements.number) ||
                        (req.id === 4 && requirements.special)
                        ? styles.requirementMet
                        : styles.requirementNotMet
                  ]}>
                     • {req.text}
                  </Text>
               </View>
            ))}
         </View>
      );
   };

   const renderVerificationForm = () => {
      if (!showVerification) return null;

      return (
         <View style={styles.verificationContainer}>
            <Text style={styles.verificationTitle}>Two-Factor Authentication</Text>
            <Text style={styles.verificationSubtitle}>
               Please enter the verification code sent to your email
            </Text>
            <View style={styles.inputContainer}>
               <TextInput
                  style={[styles.input, errors.verification && styles.inputError]}
                  value={verificationCode}
                  onChangeText={setVerificationCode}
                  placeholder="Enter verification code"
                  keyboardType="number-pad"
                  maxLength={6}
               />
               {errors.verification && (
                  <Text style={styles.errorText}>{errors.verification}</Text>
               )}
            </View>
            <TouchableOpacity
               onPress={handleVerificationSubmit}
               style={styles.submitButton}
            >
               <Text style={styles.submitButtonText}>Verify</Text>
            </TouchableOpacity>
         </View>
      );
   };

   const renderLoginForm = () => (
      <>
         <Text style={styles.title}>{isLogin ? 'Login' : 'Sign Up'}</Text>

         <View style={styles.inputContainer}>
            <Text style={styles.label}>Email <Text style={styles.required}>*</Text></Text>
            <TextInput
               style={[styles.input, errors.email && styles.inputError]}
               value={email}
               onChangeText={setEmail}
               keyboardType="email-address"
               autoCapitalize="none"
               placeholder="Enter your email"
            />
            {renderError('email')}
         </View>

         <View style={styles.inputContainer}>
            <Text style={styles.label}>Password <Text style={styles.required}>*</Text></Text>
            <TextInput
               style={[styles.input, errors.password && styles.inputError]}
               value={password}
               onChangeText={setPassword}
               secureTextEntry
               placeholder="Enter your password"
               onFocus={() => !isLogin && setShowPasswordRequirements(true)}
               onBlur={() => setShowPasswordRequirements(false)}
            />
            {renderError('password')}
            {renderPasswordRequirements()}
         </View>

         {!isLogin && (
            <>
               <View style={styles.inputContainer}>
                  <Text style={styles.label}>Verify Password <Text style={styles.required}>*</Text></Text>
                  <TextInput
                     style={[styles.input, errors.verifyPassword && styles.inputError]}
                     value={verifyPassword}
                     onChangeText={setVerifyPassword}
                     secureTextEntry
                     placeholder="Verify your password"
                  />
                  {renderError('verifyPassword')}
               </View>

               <View style={styles.inputContainer}>
                  <Text style={styles.label}>First Name <Text style={styles.required}>*</Text></Text>
                  <TextInput
                     style={[styles.input, errors.userFname && styles.inputError]}
                     value={userFname}
                     onChangeText={setUserFname}
                     placeholder="Enter your first name"
                  />
                  {renderError('userFname')}
               </View>

               <View style={styles.inputContainer}>
                  <Text style={styles.label}>Last Name <Text style={styles.required}>*</Text></Text>
                  <TextInput
                     style={[styles.input, errors.userLname && styles.inputError]}
                     value={userLname}
                     onChangeText={setUserLname}
                     placeholder="Enter your last name"
                  />
                  {renderError('userLname')}
               </View>

               <View style={styles.inputContainer}>
                  <Text style={styles.label}>Address</Text>
                  <TextInput
                     style={styles.input}
                     value={address}
                     onChangeText={setAddress}
                     placeholder="Enter your address"
                  />
               </View>

               <View style={styles.inputContainer}>
                  <Text style={styles.label}>Phone Number</Text>
                  <TextInput
                     style={styles.input}
                     value={phoneNumber}
                     onChangeText={setPhoneNumber}
                     keyboardType="phone-pad"
                     placeholder="Enter your phone number"
                  />
               </View>

               <View style={styles.inputContainer}>
                  <Text style={styles.label}>Select Persona <Text style={styles.required}>*</Text>
                  </Text>
                  <View style={[styles.input, styles.pickerBox]}>
                     <Picker
                        selectedValue={persona}
                        onValueChange={(value) => setPersona(value)}
                        style={styles.picker}

                     >
                        <Picker.Item label="Select persona" value="" />
                        {PERSONAS.map((p) => (
                           <Picker.Item key={p} label={p} value={p} />
                        ))}
                     </Picker>
                  </View>
                  {renderError('persona')}
               </View>

               <View style={styles.checkboxContainer}>
                  <Text style={styles.label}>Admin</Text>
                  <Switch
                     value={isAdmin}
                     onValueChange={setIsAdmin}
                     trackColor={{ false: '#767577', true: '#81b0ff' }}
                     thumbColor={isAdmin ? '#4CAF50' : '#f4f3f4'}
                  />
               </View>
            </>
         )}

         {renderError('submit')}

         <TouchableOpacity onPress={handleSubmit} style={styles.submitButton}>
            {isSubmitting ? (
               <ActivityIndicator color="#fff" />
            ) : (
               <Text style={styles.submitButtonText}>{isLogin ? 'Login' : 'Sign Up'}</Text>
            )}
         </TouchableOpacity>

         <TouchableOpacity
            onPress={() => {
               setIsLogin(!isLogin);
               setErrors({});
               setPassword('');
               setVerifyPassword('');
               setShowVerification(false);
            }}
            style={styles.switchButton}
         >
            <Text style={styles.switchButtonText}>
               {isLogin ? 'Need an account? Sign Up' : 'Already have an account? Login'}
            </Text>
         </TouchableOpacity>
      </>
   );

   return (
      <SafeAreaView style={styles.container}>
         <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
         </TouchableOpacity>

         <ScrollView
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
         >
            <View style={styles.formContainer}>
               {showVerification ? renderVerificationForm() : renderLoginForm()}
            </View>
         </ScrollView>
      </SafeAreaView>
   );
}

const styles = StyleSheet.create({
   container: {
      flex: 1,
      backgroundColor: '#f5f5f5',
   },
   scrollContainer: {
      flexGrow: 1,
      paddingVertical: 20,
   },
   backButton: {
      position: 'absolute',
      top: 40,
      left: 20,
      zIndex: 1,
   },
   requirementsContainer: {
      marginTop: 10,
      padding: 10,
      backgroundColor: '#f8f8f8',
      borderRadius: 5,
   },
   requirementsTitle: {
      fontSize: 12,
      fontWeight: '500',
      marginBottom: 5,
      color: '#666',
   },
   requirementRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 2,
   },
   requirementText: {
      fontSize: 12,
      marginLeft: 5,
   },
   requirementMet: {
      color: '#4CAF50',
   },
   requirementNotMet: {
      color: '#666',
   },
   errorText: {
      color: '#ff0000',
      fontSize: 12,
      marginTop: 5,
      marginLeft: 5,
   },
   required: {
      color: '#ff0000',
      fontWeight: 'bold',
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
      marginTop: 60,
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
      fontSize: 28,
      fontWeight: 'bold',
      marginBottom: 30,
      color: '#333',
   },
   inputContainer: {
      width: '100%',
      marginBottom: 20,
   },
   label: {
      fontSize: 14,
      marginBottom: 8,
      color: '#333',
      fontWeight: '500',
   },
   required: {
      color: '#ff0000',
   },
   input: {
      width: '100%',
      height: 45,
      borderColor: '#ddd',
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 15,
      fontSize: 16,
      backgroundColor: '#fff',
   },
   inputError: {
      borderColor: '#ff0000',
      borderWidth: 1,
   },
   errorText: {
      color: '#ff0000',
      fontSize: 12,
      marginTop: 5,
      marginLeft: 5,
   },
   checkboxContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      marginBottom: 20,
      paddingHorizontal: 5,
   },
   submitButton: {
      backgroundColor: '#4CAF50',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 8,
      width: '100%',
      alignItems: 'center',
      marginTop: 10,
      elevation: 2,
   },
   submitButtonText: {
      color: '#fff',
      fontWeight: 'bold',
      fontSize: 16,
   },
   switchButton: {
      marginTop: 20,
      padding: 10,
   },
   switchButtonText: {
      color: '#4CAF50',
      fontSize: 14,
      fontWeight: '500',
   },
   verificationContainer: {
      width: '100%',
      alignItems: 'center',
      padding: 20,
   },
   verificationTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 10,
      color: '#333',
   },
   verificationSubtitle: {
      fontSize: 14,
      color: '#666',
      textAlign: 'center',
      marginBottom: 20,
   },
   pickerBox: {
      height: 50,
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: 8,
      backgroundColor: '#fff',
      justifyContent: 'center',
      overflow: 'hidden',
   },
   picker: {
      flex: 1,
      color: '#333',
      borderColor: '#fff',
      backgroundColor: '#fff',
      fontSize: 16,
      fontFamily: 'System',
   },
}
);
