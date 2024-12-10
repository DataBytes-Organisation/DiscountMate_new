import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';

const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { text: "We respect your privacy. Please don't share personal information unless specifically requested. See our Privacy Policy for details on how we handle data.", sender: 'bot' },
    { text: "Hi, I'm MateBot, your digital shopping assistant for DiscountMate!", sender: 'bot' },
    { text: "I can help you find the best deals across different stores, compare prices, and answer questions about our services.", sender: 'bot' },
    { text: "How can I assist you today?", sender: 'bot' },
  ]);
  const [inputText, setInputText] = useState('');
  const scrollViewRef = useRef();

  const questions = [
    "How does DiscountMate work?",
    "Where do you get your price data?",
    "Can I save favorite products?"
  ];

  useEffect(() => {
    const timer = setTimeout(() => {
      setMessages(prevMessages => [
        ...prevMessages,
        ...questions.map(q => ({ text: q, sender: 'bot', isQuestion: true }))
      ]);
    }, 1000); // Delay of 1 second

    return () => clearTimeout(timer);
  }, []);

  const toggleChatbot = () => {
    setIsOpen(!isOpen);
  };

  const handleQuestionClick = (question) => {
    setMessages(prevMessages => [...prevMessages, { text: question, sender: 'user' }]);
    // Here you would typically add logic to generate a response based on the question
    const response = `Thank you for asking about "${question}". Here's some information...`;
    setTimeout(() => {
      setMessages(prevMessages => [...prevMessages, { text: response, sender: 'bot' }]);
    }, 500);
  };

  const handleSend = () => {
    if (inputText.trim()) {
      setMessages(prevMessages => [...prevMessages, { text: inputText, sender: 'user' }]);
      setInputText('');
      // Here you would typically add logic to generate a response
      setTimeout(() => {
        setMessages(prevMessages => [...prevMessages, { text: 'Thank you for your message. How else can I help you?', sender: 'bot' }]);
      }, 500);
    }
  };

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  return (
    <View style={styles.container}>
      {isOpen && (
        <View style={styles.chatWindow}>
          <View style={styles.header}>
            <Icon name="leaf" size={24} color="#fff" style={styles.botIcon} />
            <Text style={styles.headerText}>MateBot</Text>
            <TouchableOpacity onPress={toggleChatbot} style={styles.closeButton}>
              <Icon name="times" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <ScrollView 
            style={styles.messagesContainer}
            ref={scrollViewRef}
            onContentSizeChange={() => scrollViewRef.current.scrollToEnd({ animated: true })}
          >
            {messages.map((message, index) => (
              <View key={index} style={[styles.messageBubble, message.sender === 'bot' ? styles.botBubble : styles.userBubble]}>
                <Text style={styles.messageText}>{message.text}</Text>
                {message.isQuestion && (
                  <TouchableOpacity onPress={() => handleQuestionClick(message.text)}>
                    <Text style={styles.questionLink}>Click to ask</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </ScrollView>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Type a message"
            />
            <TouchableOpacity onPress={handleSend} style={styles.sendButton}>
              <Icon name="send" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}
      <TouchableOpacity onPress={toggleChatbot} style={styles.chatbotButton}>
        <Icon name="comment" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    zIndex: 1000,
  },
  chatbotButton: {
    backgroundColor: '#4CAF50',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },
  chatWindow: {
    position: 'absolute',
    bottom: 70,
    right: 0,
    width: 300,
    height: 450,
    backgroundColor: '#fff',
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    padding: 10,
  },
  botIcon: {
    marginRight: 10,
  },
  headerText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  closeButton: {
    padding: 5,
  },
  messagesContainer: {
    flex: 1,
    padding: 10,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  botBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#e3f2fd',
  },
  messageText: {
    fontSize: 14,
  },
  questionLink: {
    color: '#4CAF50',
    marginTop: 5,
    textDecorationLine: 'underline',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  input: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: '#4CAF50',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default Chatbot;