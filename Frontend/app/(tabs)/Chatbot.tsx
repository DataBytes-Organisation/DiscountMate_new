import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import axios from 'axios';
import { buildApiUrl } from '../../constants/Api';

// Static FAQ answers. These never hit the network — they are product
// copy, not data, so answering them locally keeps the bot responsive.
const quickResponses = {
   "How does DiscountMate work?": "DiscountMate compares prices across multiple retailers in real-time to help you find the best deals. We track prices, apply available coupons, and factor in shipping costs to show you the true lowest price.",
   "Where do you get your price data?": "We collect price data directly from authorized retailers through their official APIs and web services. Our system updates prices multiple times daily to ensure accuracy.",
   "Can I save favorite products?": "Yes! Once you create an account, you can save products to your favorites list and we'll notify you when their prices drop or when they go on sale."
};

// The DL-06 agent exposes two tools only: search_products and
// compare_prices. Recipe support was removed from the chatbot, so we
// answer recipe asks here rather than sending them to a tool that
// cannot serve them.
const RECIPE_KEYWORDS = ['recipe', 'cook', 'cooking', 'meal', 'dish', 'ingredients to make'];
const RECIPE_FUTURE_FEATURE = 'Recipe suggestions are planned as a future feature.';

interface Message {
   text: string;
   sender: 'user' | 'bot';
   prices?: RetailerPrice[];
   products?: ProductCandidate[];
}

// Mirrors chatbots/schemas/products.py::RetailerPrice
interface RetailerPrice {
   retailer: string;
   price: number;
   currency?: string;
   unit_price?: string | null;
   is_on_special?: boolean | null;
   price_date?: string | null;
}

// Mirrors chatbots/schemas/products.py::ProductCandidate
interface ProductCandidate {
   product_id: string;
   product_name: string;
   brand?: string | null;
   pack_size?: string | null;
   category?: string | null;
   image_url?: string | null;
}

// Mirrors chatbots/schemas/agent.py::AgentResponse
interface AgentResponse {
   success: boolean;
   answer: string;
   action: 'search_products' | 'compare_prices' | 'clarification';
   data?: {
      prices?: RetailerPrice[];
      cheapest?: RetailerPrice | null;
      matched_product?: ProductCandidate | null;
      products?: ProductCandidate[];
      candidate_products?: ProductCandidate[];
      status?: string;
   };
   needs_clarification?: boolean;
   clarification_question?: string | null;
   error?: { code: string; message: string } | null;
}

const isRecipeQuery = (message: string): boolean => {
   const lower = message.toLowerCase();
   return RECIPE_KEYWORDS.some(keyword => lower.includes(keyword));
};

const newSessionId = (): string =>
   `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const Chatbot: React.FC = () => {
   const [isOpen, setIsOpen] = useState<boolean>(false);
   const [messages, setMessages] = useState<Message[]>([
      { text: "Hi, I'm your AI shopping assistant! I can help you search for products and compare prices across Coles, Woolworths and IGA.", sender: 'bot' },
      { text: "Try \"Compare prices for Coke Zero 2L\" or \"Find me milk\".", sender: 'bot' },
   ]);
   const [inputText, setInputText] = useState<string>('');
   const [isTyping, setIsTyping] = useState<boolean>(false);
   const scrollViewRef = useRef<ScrollView>(null);
   const sessionIdRef = useRef<string>(newSessionId());

   const faqQuestions = Object.keys(quickResponses);

   const pushBotMessage = (message: Message) => {
      setMessages(prev => [...prev, message]);
   };

   const handleFAQClick = (question: string) => {
      setMessages(prev => [...prev, { text: question, sender: 'user' }]);
      pushBotMessage({
         text: quickResponses[question as keyof typeof quickResponses],
         sender: 'bot',
      });
   };

   // Sends one turn to the DL-06 agent and renders whatever tool it chose.
   const askAgent = async (userMessage: string): Promise<Message> => {
      try {
         const response = await axios.post<AgentResponse>(
            buildApiUrl('/ml/chatbot/chat'),
            {
               session_id: sessionIdRef.current,
               message: userMessage,
               top_k: 5,
            },
            { timeout: 30000 }
         );

         const result = response.data;

         if (!result.success) {
            console.error('Chatbot agent error:', result.error);
            return {
               text: "I'm having trouble reaching product data right now. Please try again in a moment.",
               sender: 'bot',
            };
         }

         const data = result.data || {};
         return {
            text: result.answer,
            sender: 'bot',
            prices: result.action === 'compare_prices' ? data.prices : undefined,
            products: result.action === 'search_products'
               ? data.products
               : undefined,
         };
      } catch (error) {
         console.error('Chatbot request failed:', error);
         return {
            text: "I'm having trouble connecting to DiscountMate right now. Please try again in a moment.",
            sender: 'bot',
         };
      }
   };

   const handleSend = async (): Promise<void> => {
      const userMessage = inputText.trim();
      if (!userMessage) {
         return;
      }

      setMessages(prev => [...prev, { text: userMessage, sender: 'user' }]);
      setInputText('');

      const faqResponse = quickResponses[userMessage as keyof typeof quickResponses];
      if (faqResponse) {
         pushBotMessage({ text: faqResponse, sender: 'bot' });
         return;
      }

      if (isRecipeQuery(userMessage)) {
         pushBotMessage({ text: RECIPE_FUTURE_FEATURE, sender: 'bot' });
         return;
      }

      setIsTyping(true);
      const botMessage = await askAgent(userMessage);
      setIsTyping(false);
      pushBotMessage(botMessage);
   };

   useEffect(() => {
      if (scrollViewRef.current) {
         scrollViewRef.current.scrollToEnd({ animated: true });
      }
   }, [messages]);

   return (
      <View style={styles.container}>
         {isOpen && (
            <View style={styles.chatWindow}>
               <View style={styles.header}>
                  <Icon name="leaf" size={24} color="#fff" style={styles.botIcon} />
                  <Text style={styles.headerText}>MateBot</Text>
                  <TouchableOpacity onPress={() => setIsOpen(false)} style={styles.closeButton}>
                     <Icon name="times" size={24} color="#fff" />
                  </TouchableOpacity>
               </View>
               <ScrollView
                  style={styles.messagesContainer}
                  ref={scrollViewRef}
                  onContentSizeChange={() => {
                     scrollViewRef.current?.scrollToEnd({ animated: true });
                  }}
               >
                  {messages.map((message, index) => (
                     <View key={index} style={styles.messageRow}>
                        <View style={[styles.messageBubble, message.sender === 'bot' ? styles.botBubble : styles.userBubble]}>
                           <Text style={styles.messageText}>{message.text}</Text>
                        </View>

                        {/* Retailer price breakdown for compare_prices turns */}
                        {message.prices && message.prices.length > 0 && (
                           <View style={styles.detailCard}>
                              {message.prices.map((price, priceIndex) => (
                                 <View key={priceIndex} style={styles.priceRow}>
                                    <Text style={styles.priceRetailer}>{price.retailer}</Text>
                                    <Text style={styles.priceValue}>
                                       ${Number(price.price).toFixed(2)}
                                       {price.is_on_special ? ' (special)' : ''}
                                    </Text>
                                 </View>
                              ))}
                           </View>
                        )}

                        {/* Matched products for search_products turns */}
                        {message.products && message.products.length > 0 && (
                           <View style={styles.detailCard}>
                              {message.products.slice(0, 5).map((product, productIndex) => (
                                 <View key={productIndex} style={styles.productRow}>
                                    <Text style={styles.productName}>{product.product_name}</Text>
                                    {!!product.brand && (
                                       <Text style={styles.productMeta}>{product.brand}</Text>
                                    )}
                                 </View>
                              ))}
                           </View>
                        )}
                     </View>
                  ))}

                  {messages.length === 2 && (
                     <View style={styles.faqContainer}>
                        {faqQuestions.map((question, index) => (
                           <TouchableOpacity
                              key={index}
                              style={styles.faqButton}
                              onPress={() => handleFAQClick(question)}
                           >
                              <Text style={styles.faqText}>{question}</Text>
                           </TouchableOpacity>
                        ))}
                     </View>
                  )}

                  {isTyping && (
                     <View style={[styles.messageBubble, styles.botBubble]}>
                        <ActivityIndicator size="small" color="#4CAF50" />
                     </View>
                  )}
               </ScrollView>
               <View style={styles.inputContainer}>
                  <TextInput
                     style={styles.input}
                     value={inputText}
                     onChangeText={setInputText}
                     placeholder="Type a message..."
                     onSubmitEditing={handleSend}
                  />
                  <TouchableOpacity onPress={handleSend} style={styles.sendButton}>
                     <Icon name="send" size={20} color="#fff" />
                  </TouchableOpacity>
               </View>
            </View>
         )}
         <TouchableOpacity onPress={() => setIsOpen(true)} style={styles.chatbotButton}>
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
   messageRow: {
      marginBottom: 10,
   },
   messageBubble: {
      maxWidth: '80%',
      padding: 10,
      borderRadius: 10,
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
   detailCard: {
      alignSelf: 'flex-start',
      backgroundColor: '#fafafa',
      borderWidth: 1,
      borderColor: '#e0e0e0',
      borderRadius: 8,
      padding: 8,
      marginTop: 6,
      maxWidth: '90%',
   },
   priceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 3,
   },
   priceRetailer: {
      fontSize: 13,
      color: '#444',
      marginRight: 12,
   },
   priceValue: {
      fontSize: 13,
      fontWeight: 'bold',
      color: '#2E7D32',
   },
   productRow: {
      paddingVertical: 3,
   },
   productName: {
      fontSize: 13,
      color: '#333',
   },
   productMeta: {
      fontSize: 11,
      color: '#777',
   },
   faqContainer: {
      marginTop: 10,
      marginBottom: 10,
   },
   faqButton: {
      backgroundColor: '#f5f5f5',
      padding: 10,
      borderRadius: 8,
      marginBottom: 8,
   },
   faqText: {
      color: '#4CAF50',
      fontSize: 14,
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
