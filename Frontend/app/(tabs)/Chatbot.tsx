import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import axios from 'axios';

// Add FAQ responses
const quickResponses = {
   "How does DiscountMate work?": "DiscountMate compares prices across multiple retailers in real-time to help you find the best deals. We track prices, apply available coupons, and factor in shipping costs to show you the true lowest price.",
   "Where do you get your price data?": "We collect price data directly from authorized retailers through their official APIs and web services. Our system updates prices multiple times daily to ensure accuracy.",
   "Can I save favorite products?": "Yes! Once you create an account, you can save products to your favorites list and we'll notify you when their prices drop or when they go on sale."
};

// Recipe generation prompt template
const recipePrompt = (ingredients: string) => `
Generate a recipe using these ingredients: ${ingredients}
Please include:
1. Recipe name
2. Ingredients list
3. Step-by-step instructions
4. Cooking time
5. Difficulty level
`;
// Interface definitions for TypeScript type checking
interface Message {
   text: string;
   sender: 'user' | 'bot';
}
// Product interface for e-commerce functionality
interface Product {
   _id: string;
   current_price: number;
   link_image: string;
   product_code: string;
   product_id: string;
   product_name: string;
   category: string;
   link: string;
   measurement: string;
   sub_category_1: string;
   sub_category_2: string;
   unit_per_prod: string;
}

// Recipe interface
interface Recipe {
   name: string;
   ingredients: string[];
   instructions: string[];
   cookingTime: string;
   difficulty: string;
}
// Type guard to ensure product data is valid
const isValidProduct = (product: any): product is Product => {
   return (
      product &&
      typeof product === 'object' &&
      typeof product.product_name === 'string' &&
      typeof product.current_price === 'number' &&
      typeof product.category === 'string'
   );
};
// Class to manage conversation history and context
interface HistoryItem {
   role: 'user' | 'assistant';
   content: string;
}

class ConversationContext {
   private history: HistoryItem[];
   private lastQuery: string | null;

   constructor() {
      this.history = [];
      this.lastQuery = null;
   }
   // Methods to manage conversation history
   addToHistory(message: string, role: 'user' | 'assistant'): void {
      this.history.push({ role, content: message });
      if (this.history.length > 10) this.history.shift();
   }

   getContext(): string {
      return this.history.map(h => `${h.role}: ${h.content}`).join('\n');
   }

   clearContext(): void {
      this.history = [];
      this.lastQuery = null;
   }
}

const conversationContext = new ConversationContext();

const generateRecipe = async (ingredients: string): Promise<string> => {
   try {
      const API_KEY = ''; //Replace the API Here
      // API call to Hugging Face model
      const response = await axios.post(
         'https://api-inference.huggingface.co/models/flax-community/t5-recipe-generation',
         {
            inputs: `ingredients: ${ingredients}`,
            parameters: {
               max_length: 512,
               temperature: 0.7,
               top_p: 0.95,
               do_sample: true
            }
         },
         {
            headers: {
               'Authorization': `Bearer ${API_KEY}`,
               'Content-Type': 'application/json',
            },
         }
      );

      let recipe = response.data[0].generated_text;

      // Remove duplications
      const sections = recipe.split(/\b(title:|ingredients:|directions:|instructions:)/i);
      const uniqueSections = new Map();

      sections.forEach((section: string) => {
         const sectionType = section.toLowerCase().trim();
         if (sectionType === 'title:' || sectionType === 'ingredients:' || sectionType === 'directions:' || sectionType === 'instructions:') {
            uniqueSections.set(sectionType, '');
         } else if (section.trim()) {
            const lastKey = Array.from(uniqueSections.keys()).pop();
            uniqueSections.set(lastKey, section.trim());
         }
      });

      // Format the recipe nicely
      let formattedRecipe = '';

      if (uniqueSections.has('title:')) {
         formattedRecipe += `🍕 ${uniqueSections.get('title:')}\n\n`;
      }

      if (uniqueSections.has('ingredients:')) {
         formattedRecipe += `📝 Ingredients:\n`;
         const ingredients = uniqueSections.get('ingredients:')
            .replace('ingredients', '')
            .split(',')
            .map(i => i.trim())
            .filter(i => i)
            .map(i => `• ${i}`)
            .join('\n');
         formattedRecipe += `${ingredients}\n\n`;
      }

      if (uniqueSections.has('directions:') || uniqueSections.has('instructions:')) {
         formattedRecipe += `👩‍🍳 Instructions:\n`;
         const steps = (uniqueSections.get('directions:') || uniqueSections.get('instructions:'))
            .replace('directions', '')
            .split('.')
            .map(s => s.trim())
            .filter(s => s)
            .map((step, index) => `${index + 1}. ${step}`)
            .join('\n');
         formattedRecipe += steps;
      }

      // Add cooking tips section
      formattedRecipe += '\n\n💡 Tips:\n';
      formattedRecipe += '• Ensure all ingredients are at room temperature before starting\n';
      formattedRecipe += '• Follow the instructions carefully for best results\n';
      formattedRecipe += '• Adjust seasoning to taste';

      return formattedRecipe;

   } catch (error) {
      console.error('Recipe Generation Error:', error);
      return "I'm sorry, I'm having trouble generating a recipe right now. Please try again later.";
   }
};

const handleAIResponse = async (message: string): Promise<string> => {
   try {
      // Check if the message matches any FAQ
      const faqResponse = quickResponses[message as keyof typeof quickResponses];
      if (faqResponse) {
         return faqResponse;
      }

      // Check for recipe-related keywords
      const recipeKeywords = ['recipe', 'cook', 'make', 'prepare', 'ingredients', 'how to make', 'how do i make'];
      const isRecipeQuery = recipeKeywords.some(keyword =>
         message.toLowerCase().includes(keyword)
      );

      if (isRecipeQuery) {
         // Extract ingredients from the message
         let ingredients = message
            .toLowerCase()
            .replace(/recipe|cook|make|prepare|with|using|can you|please|for|how to|how do i/g, '')
            .replace(/[?!.]/g, '')
            .trim();
         if (ingredients.length < 3) {
            return "Could you please specify what ingredients you'd like to use in the recipe?";
         }

         return await generateRecipe(ingredients);
      }

      // Check for product availability keywords
      const productKeywords = ['available', 'in stock', 'have', 'sell', 'price of', 'cost of', 'how much'];
      const isProductQuery = productKeywords.some(keyword =>
         message.toLowerCase().includes(keyword)
      );

      if (isProductQuery) {
         try {
            const response = await axios.get('http://localhost:5002/products'); //Products Backend
            const responseData = response.data;

            // Handle consistent response structure: { items, page, pageSize, total, totalPages }
            const productsData = Array.isArray(responseData)
               ? responseData
               : (responseData?.items || []);

            if (!Array.isArray(productsData)) {
               throw new Error('Invalid product data received - not an array');
            }

            const products: Product[] = productsData.filter(isValidProduct);

            if (products.length === 0) {
               return "I'm sorry, but I couldn't find any valid product information.";
            }

            const messageWords = message.toLowerCase().split(' ').filter(word =>
               word.length > 2 && !['the', 'is', 'are', 'any', 'for', 'and', 'but', 'how', 'much', 'does', 'cost'].includes(word)
            );

            const potentialProducts = products.filter(product => {
               const productName = product.product_name.toLowerCase();
               const category = product.category.toLowerCase();
               const subCategory1 = product.sub_category_1.toLowerCase();
               const subCategory2 = product.sub_category_2.toLowerCase();

               return messageWords.some(word =>
                  productName.includes(word) ||
                  category.includes(word) ||
                  subCategory1.includes(word) ||
                  subCategory2.includes(word)
               );
            });

            if (potentialProducts.length > 0) {
               const productResponses = potentialProducts.map(product => {
                  return `${product.product_name} (${product.unit_per_prod}) is available for $${product.current_price.toFixed(2)} in the ${product.category} category.`;
               });

               return productResponses.join('\n');
            } else {
               return "I couldn't find any products matching your query. Could you please be more specific about what you're looking for?";
            }
         } catch (error) {
            console.error('Product API Error:', error);
            return "I'm having trouble checking product availability right now. Please try again later.";
         }
      }

      // Generate AI response for general queries
      const API_KEY = process.env.API_KEY;

      const response = await axios.post(

         'https://api-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',

         {

            inputs: message,

            parameters: {

               max_length: 100,

               temperature: 0.7,

               top_p: 0.9,

            }

         },

         {
            headers: {
               'Authorization': `Bearer ${API_KEY}`,
               'Content-Type': 'application/json',
            },

         });

      const aiResponse = response.data[0].generated_text;
      return aiResponse;

   } catch (error) {
      console.error('Response Handler Error:', error);
      return "I apologize, but I'm having trouble connecting to our systems. Please try again in a moment.";
   }
};

const Chatbot: React.FC = () => {
   const [isOpen, setIsOpen] = useState<boolean>(false);
   const [messages, setMessages] = useState<Message[]>([
      { text: "Hi, I'm your AI shopping and cooking assistant! I can help you check product availability, generate recipes, and answer questions.", sender: 'bot' },
      { text: "Try asking me about products, recipes, or check out our FAQ!", sender: 'bot' },
   ]);
   const [inputText, setInputText] = useState<string>('');
   const [isTyping, setIsTyping] = useState<boolean>(false);
   const scrollViewRef = useRef<ScrollView>(null);

   // Add FAQ questions as clickable options
   const faqQuestions = Object.keys(quickResponses);

   const handleFAQClick = async (question: string) => {
      setMessages(prevMessages => [...prevMessages, { text: question, sender: 'user' }]);
      setIsTyping(true);

      const response = quickResponses[question as keyof typeof quickResponses];

      setTimeout(() => {
         setMessages(prevMessages => [...prevMessages, { text: response, sender: 'bot' }]);
         setIsTyping(false);
      }, 500);
   };

   useEffect(() => {
      conversationContext.clearContext();
   }, []);

   const handleSend = async (): Promise<void> => {
      if (inputText.trim()) {
         const userMessage = inputText.trim();
         setMessages(prevMessages => [...prevMessages, { text: userMessage, sender: 'user' }]);
         setInputText('');
         setIsTyping(true);

         const aiResponse = await handleAIResponse(userMessage);

         setTimeout(() => {
            setMessages(prevMessages => [...prevMessages, { text: aiResponse, sender: 'bot' }]);
            setIsTyping(false);
         }, 500);
      }
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
                     <View key={index} style={[styles.messageBubble, message.sender === 'bot' ? styles.botBubble : styles.userBubble]}>
                        <Text style={styles.messageText}>{message.text}</Text>
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
                        <TouchableOpacity
                           style={styles.recipeButton}
                           onPress={() => setInputText("Can you suggest a recipe with chicken and vegetables?")}
                        >
                           <Text style={styles.recipeButton}>🍳 Get Recipe Suggestions</Text>
                        </TouchableOpacity>
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
   typingIndicator: {
      flexDirection: 'row',
      padding: 10,
      alignItems: 'center',
   },
   recipeButton: {
      backgroundColor: '#4CAF50',
      padding: 12,
      borderRadius: 8,
      marginTop: 8,
      alignItems: 'center',
   },
   recipeText: {
      fontSize: 14,
      color: '#444',
      lineHeight: 20,
   },
   recipeDifficultyEasy: {
      color: '#4CAF50',
   },
   recipeDifficultyMedium: {
      color: '#FFA726',
   },
   recipeDifficultyHard: {
      color: '#F44336',
   },
   cookingTime: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
   },
   cookingTimeText: {
      fontSize: 12,
      color: '#666',
      marginLeft: 4,
   },
});

export default Chatbot;
