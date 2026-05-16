/* ============================================================
 * RecipeBot.tsx — Floating Recipe Chatbot
 * ============================================================
 * A persistent chat bubble that lives in the bottom-right
 * corner of every page. Clicking it expands a chat window
 * connected to the Recipe RAG API.
 *
 * Two-stage rendering:
 *   1. The LLM answer appears immediately when /chat returns.
 *   2. Product cards are fetched in the background via /products
 *      and appended below the answer without re-rendering the text.
 * ============================================================ */

import React, { useState, useRef, useEffect } from 'react';
import {
   View,
   Text,
   TouchableOpacity,
   StyleSheet,
   ScrollView,
   TextInput,
   ActivityIndicator,
   Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/FontAwesome';
import Markdown from 'react-native-markdown-display';
import { useCart } from './CartContext';
import { useShoppingLists } from './ShoppingListsContext';

// ----------------------------------------------------------
// Configuration
// ----------------------------------------------------------
const API_BASE_URL = 'http://localhost:3000';
const TOP_K = 3;
const PRODUCT_CARD_STEP = 118;

// ----------------------------------------------------------
// Types
// ----------------------------------------------------------
interface ProductCard {
   product_id: string;
   product_name: string;
   price: number | null;
   image_url: string | null;
   product_url?: string | null;
}

interface Message {
   sender: 'user' | 'bot';
   text: string;
   /** Unique id for matching product-fetch results back to this message. */
   recipe_context_id?: string;
   /** True while the background product fetch is in flight. */
   products_pending?: boolean;
   /** Populated once the product fetch completes. */
   products_used?: ProductCard[];
}

// ----------------------------------------------------------
// Inline product card shown inside recipe answers.
// ----------------------------------------------------------
function productToListItem(product: ProductCard) {
   return {
      id: product.product_id,
      name: product.product_name,
      price: product.price ?? 0,
      store: product.price != null ? 'Best available' : 'Price unavailable',
      image: product.image_url ?? undefined,
      category: 'Recipe recommendation',
   };
}

function RecipeProductCard({ product }: { product: ProductCard }) {
   const router = useRouter();
   const { addToCart } = useCart();
   const { getActiveList } = useShoppingLists();
   const [added, setAdded] = useState(false);
   const displayPrice =
      product.price != null ? `$${product.price.toFixed(2)}` : '—';
   const openProduct = () => {
      router.push({
         pathname: '/(product)/product/[id]',
         params: { id: product.product_id },
      });
   };
   const addProductToList = async () => {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
         router.push('/(auth)/login');
         return;
      }

      if (!getActiveList()) {
         router.push('/(tabs)/my-lists');
         return;
      }
      addToCart(productToListItem(product));
      setAdded(true);
      setTimeout(() => setAdded(false), 1400);
   };

   return (
      <View style={cardStyles.card}>
         {product.image_url ? (
            <Image
               source={{ uri: product.image_url }}
               style={cardStyles.image}
               resizeMode="contain"
            />
         ) : (
            <View style={[cardStyles.image, cardStyles.imagePlaceholder]}>
               <Icon name="shopping-basket" size={22} color="#bbb" />
            </View>
         )}
         <TouchableOpacity
            onPress={openProduct}
            accessibilityRole="link"
            accessibilityLabel={`Open ${product.product_name} details`}
         >
            <Text style={cardStyles.name} numberOfLines={2}>
               {product.product_name}
            </Text>
         </TouchableOpacity>
         <Text style={cardStyles.price}>{displayPrice}</Text>
         <TouchableOpacity
            onPress={() => {
               void addProductToList();
            }}
            style={[
               cardStyles.addButton,
               added && cardStyles.addButtonAdded,
            ]}
            accessibilityLabel={`Add ${product.product_name} to grocery list`}
         >
            <Icon
               name={added ? 'check' : 'list'}
               size={10}
               color="#fff"
               style={cardStyles.addButtonIcon}
            />
            <Text style={cardStyles.addButtonText}>
               {added ? 'Added' : 'Add'}
            </Text>
         </TouchableOpacity>
      </View>
   );
}

function RecipeProductCarousel({ products }: { products: ProductCard[] }) {
   const router = useRouter();
   const scrollRef = useRef<ScrollView>(null);
   const [index, setIndex] = useState(0);
   const [addedAll, setAddedAll] = useState(false);
   const { addToCart } = useCart();
   const { getActiveList } = useShoppingLists();

   const maxIndex = Math.max(products.length - 1, 0);

   const browseTo = (direction: 1 | -1) => {
      const nextIndex = Math.max(0, Math.min(index + direction * 2, maxIndex));
      setIndex(nextIndex);
      scrollRef.current?.scrollTo({
         x: nextIndex * PRODUCT_CARD_STEP,
         animated: true,
      });
   };

   const addAllToList = async () => {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
         router.push('/(auth)/login');
         return;
      }

      if (!getActiveList()) {
         router.push('/(tabs)/my-lists');
         return;
      }
      products.forEach((product) => addToCart(productToListItem(product)));
      setAddedAll(true);
      setTimeout(() => setAddedAll(false), 1600);
   };

   return (
      <View style={styles.productCarouselBlock}>
         <TouchableOpacity
            onPress={() => {
               void addAllToList();
            }}
            style={[
               styles.addAllProductsButton,
               addedAll && styles.addAllProductsButtonAdded,
            ]}
            accessibilityLabel="Add all recommended products to grocery list"
         >
            <Icon
               name={addedAll ? 'check' : 'list'}
               size={12}
               color="#fff"
               style={styles.addAllProductsIcon}
            />
            <Text style={styles.addAllProductsText}>
               {addedAll ? 'Added all to Grocery List' : 'Add all to Grocery List'}
            </Text>
         </TouchableOpacity>

         <View style={styles.productCarouselRow}>
            <TouchableOpacity
               onPress={() => browseTo(-1)}
               disabled={index === 0}
               style={[
                  styles.productNavButton,
                  index === 0 && styles.productNavButtonDisabled,
               ]}
               accessibilityLabel="Browse previous products"
            >
               <Icon name="chevron-left" size={12} color="#2e7d32" />
            </TouchableOpacity>

            <ScrollView
               ref={scrollRef}
               horizontal
               showsHorizontalScrollIndicator={false}
               style={styles.productScroll}
               contentContainerStyle={styles.productScrollContent}
            >
               {products.map((p) => (
                  <RecipeProductCard key={p.product_id} product={p} />
               ))}
            </ScrollView>

            <TouchableOpacity
               onPress={() => browseTo(1)}
               disabled={index >= maxIndex}
               style={[
                  styles.productNavButton,
                  index >= maxIndex && styles.productNavButtonDisabled,
               ]}
               accessibilityLabel="Browse later products"
            >
               <Icon name="chevron-right" size={12} color="#2e7d32" />
            </TouchableOpacity>
         </View>
      </View>
   );
}

// ----------------------------------------------------------
// The component
// ----------------------------------------------------------
const RecipeBot: React.FC = () => {

   const [isOpen, setIsOpen] = useState<boolean>(false);

   const [messages, setMessages] = useState<Message[]>([
      {
         sender: 'bot',
         text:
            "Hi! I'm your DiscountMate recipe assistant. Ask me what you " +
            "can cook with what you've got, or for a meal idea using " +
            "this week's specials.",
      },
   ]);

   const [inputText, setInputText] = useState<string>('');
   const [isTyping, setIsTyping] = useState<boolean>(false);

   const scrollViewRef = useRef<ScrollView>(null);

   useEffect(() => {
      if (scrollViewRef.current) {
         scrollViewRef.current.scrollToEnd({ animated: true });
      }
   }, [messages]);

   const sessionIdRef = useRef<string>(
      typeof crypto !== 'undefined' && crypto.randomUUID
         ? crypto.randomUUID()
         : `session-${Date.now()}-${Math.random().toString(36).slice(2)}`
   );

   // ----------------------------------------------------------
   // Background product fetch — called after /chat returns
   // ----------------------------------------------------------
   const fetchProducts = (contextId: string) => {
      fetch(`${API_BASE_URL}/api/ml/recipe/products?context_id=${encodeURIComponent(contextId)}`)
         .then((r) => r.json())
         .then((data) => {
            if (data.success && Array.isArray(data.products_used)) {
               setMessages((prev) =>
                  prev.map((msg) =>
                     msg.recipe_context_id === contextId
                        ? { ...msg, products_used: data.products_used, products_pending: false }
                        : msg
                  )
               );
            } else {
               setMessages((prev) =>
                  prev.map((msg) =>
                     msg.recipe_context_id === contextId
                        ? { ...msg, products_pending: false }
                        : msg
                  )
               );
            }
         })
         .catch((err) => {
            console.warn('RecipeBot products fetch (non-fatal):', err);
            setMessages((prev) =>
               prev.map((msg) =>
                  msg.recipe_context_id === contextId
                     ? { ...msg, products_pending: false }
                     : msg
               )
            );
         });
   };

   // ----------------------------------------------------------
   // Send handler
   // ----------------------------------------------------------
   const handleSend = async (): Promise<void> => {
      const trimmed = inputText.trim();
      if (!trimmed) return;

      setMessages((prev) => [...prev, { sender: 'user', text: trimmed }]);
      setInputText('');
      setIsTyping(true);

      try {
         const response = await fetch(`${API_BASE_URL}/api/ml/recipe/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
               session_id: sessionIdRef.current,
               message: trimmed,
               top_k: TOP_K,
            }),
         });

         const data = await response.json();

         if (!response.ok || data.success === false) {
            const errorText =
               data.error ||
               data.message ||
               `Sorry, something went wrong (HTTP ${response.status}).`;
            setMessages((prev) => [
               ...prev,
               { sender: 'bot', text: ` ${errorText}` },
            ]);
         } else {
            // Stage 1 — show the LLM answer immediately
            const botMessage: Message = {
               sender: 'bot',
               text: data.answer,
               recipe_context_id: data.recipe_context_id ?? undefined,
               products_pending: data.products_pending ?? false,
               products_used: undefined,
            };
            setMessages((prev) => [...prev, botMessage]);

            // Stage 2 — fetch product cards in the background
            if (data.products_pending && data.recipe_context_id) {
               fetchProducts(data.recipe_context_id);
            }

            if (data.limit_reached) {
               setMessages((prev) => [
                  ...prev,
                  {
                     sender: 'bot',
                     text:
                        "You've reached the message limit for this " +
                        "chat. Refresh the page to start a new conversation.",
                  },
               ]);
            }
         }
      } catch (err) {
         console.error('RecipeBot fetch error:', err);
         setMessages((prev) => [
            ...prev,
            {
               sender: 'bot',
               text:
                  "I couldn't reach the recipe service. Please check " +
                  "your connection and try again. (If you're a developer, " +
                  "make sure both the Node and Flask services are running.)",
            },
         ]);
      } finally {
         setIsTyping(false);
      }
   };

   // ----------------------------------------------------------
   // Reset handler
   // ----------------------------------------------------------
   const handleReset = async (): Promise<void> => {
      const oldSessionId = sessionIdRef.current;

      sessionIdRef.current =
         typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      setMessages([
         {
            sender: 'bot',
            text:
               "Fresh start! Ask me what you can cook with what you've " +
               "got, or for a meal idea using this week's specials.",
         },
      ]);
      setInputText('');

      try {
         await fetch(`${API_BASE_URL}/api/ml/recipe/reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: oldSessionId }),
         });
      } catch (err) {
         console.warn('RecipeBot reset (non-fatal):', err);
      }
   };

   // ----------------------------------------------------------
   // Render
   // ----------------------------------------------------------
   return (
      <View style={styles.container}>

         {isOpen && (
            <View style={styles.chatWindow}>

               <View style={styles.header}>
                  <Icon
                     name="comments"
                     size={20}
                     color="#fff"
                     style={styles.headerIcon}
                  />
                  <Text style={styles.headerText}>Recipe Suggestions</Text>
                  <TouchableOpacity
                     onPress={handleReset}
                     style={styles.headerButton}
                     disabled={isTyping}
                     accessibilityLabel="Start a new conversation"
                  >
                     <Icon name="refresh" size={18} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                     onPress={() => setIsOpen(false)}
                     style={styles.headerButton}
                     accessibilityLabel="Close chat"
                  >
                     <Icon name="times" size={20} color="#fff" />
                  </TouchableOpacity>
               </View>

               <ScrollView
                  style={styles.messagesContainer}
                  ref={scrollViewRef}
                  contentContainerStyle={{ paddingBottom: 8 }}
               >
                  {messages.map((msg, idx) => (
                     <View
                        key={idx}
                        style={[
                           styles.messageBubble,
                           msg.sender === 'bot'
                              ? styles.botBubble
                              : styles.userBubble,
                        ]}
                     >
                        {msg.sender === 'bot' ? (
                           <>
                              <Markdown style={markdownStyles}>
                                 {msg.text}
                              </Markdown>

                              {/* Spinner while background product fetch is in flight */}
                              {msg.products_pending && (
                                 <View style={styles.productLoadingRow}>
                                    <ActivityIndicator size="small" color="#4CAF50" />
                                    <Text style={styles.productLoadingText}>
                                       Loading product suggestions…
                                    </Text>
                                 </View>
                              )}

                              {/* Horizontal product card list */}
                              {msg.products_used && msg.products_used.length > 0 && (
                                 <RecipeProductCarousel products={msg.products_used} />
                              )}
                           </>
                        ) : (
                           <Text style={styles.messageText}>{msg.text}</Text>
                        )}
                     </View>
                  ))}

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
                     placeholder="Ask for a recipe..."
                     placeholderTextColor="#999"
                     onSubmitEditing={handleSend}
                     returnKeyType="send"
                     editable={!isTyping}
                  />
                  <TouchableOpacity
                     onPress={handleSend}
                     style={[
                        styles.sendButton,
                        isTyping && styles.sendButtonDisabled,
                     ]}
                     disabled={isTyping}
                  >
                     <Icon name="send" size={16} color="#fff" />
                  </TouchableOpacity>
               </View>

            </View>
         )}

         <TouchableOpacity
            onPress={() => setIsOpen(!isOpen)}
            style={styles.bubbleButton}
            activeOpacity={0.8}
         >
            <Icon
               name={isOpen ? 'chevron-down' : 'comment'}
               size={24}
               color="#fff"
            />
         </TouchableOpacity>

      </View>
   );
};

// ----------------------------------------------------------
// Styles
// ----------------------------------------------------------
const styles = StyleSheet.create({
   container: {
      position: 'absolute',
      bottom: 20,
      right: 20,
      zIndex: 1000,
   },
   bubbleButton: {
      backgroundColor: '#4CAF50',
      width: 60,
      height: 60,
      borderRadius: 30,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 6,
   },
   chatWindow: {
      position: 'absolute',
      bottom: 70,
      right: 0,
      width: 360,
      height: 540,
      backgroundColor: '#fff',
      borderRadius: 12,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 8,
   },
   header: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#4CAF50',
      paddingHorizontal: 12,
      paddingVertical: 10,
   },
   headerIcon: {
      marginRight: 8,
   },
   headerText: {
      flex: 1,
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
   },
   headerButton: {
      padding: 6,
      marginLeft: 4,
   },
   messagesContainer: {
      flex: 1,
      paddingHorizontal: 12,
      paddingTop: 12,
   },
   messageBubble: {
      maxWidth: '85%',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      marginBottom: 8,
   },
   botBubble: {
      alignSelf: 'flex-start',
      backgroundColor: '#f0f0f0',
   },
   userBubble: {
      alignSelf: 'flex-end',
      backgroundColor: '#DCF5E1',
   },
   messageText: {
      fontSize: 14,
      color: '#222',
      lineHeight: 20,
   },
   productLoadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 6,
   },
   productLoadingText: {
      marginLeft: 6,
      fontSize: 12,
      color: '#888',
   },
   productScroll: {
      flex: 1,
   },
   productScrollContent: {
      paddingHorizontal: 4,
   },
   productCarouselBlock: {
      marginTop: 8,
      marginHorizontal: -6,
   },
   addAllProductsButton: {
      alignSelf: 'stretch',
      minHeight: 34,
      borderRadius: 10,
      backgroundColor: '#2e7d32',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: 6,
      marginBottom: 8,
      paddingHorizontal: 10,
   },
   addAllProductsButtonAdded: {
      backgroundColor: '#1b5e20',
   },
   addAllProductsIcon: {
      marginRight: 6,
   },
   addAllProductsText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '600',
   },
   productCarouselRow: {
      flexDirection: 'row',
      alignItems: 'center',
   },
   productNavButton: {
      width: 28,
      height: 126,
      borderRadius: 8,
      backgroundColor: '#E8F5E9',
      borderWidth: 1,
      borderColor: '#C8E6C9',
      justifyContent: 'center',
      alignItems: 'center',
   },
   productNavButtonDisabled: {
      opacity: 0.35,
   },
   inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: '#e0e0e0',
   },
   input: {
      flex: 1,
      backgroundColor: '#f5f5f5',
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 8,
      marginRight: 8,
      fontSize: 14,
   },
   sendButton: {
      backgroundColor: '#4CAF50',
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
   },
   sendButtonDisabled: {
      backgroundColor: '#a5d6a7',
   },
});

// ----------------------------------------------------------
// Product card styles
// ----------------------------------------------------------
const cardStyles = StyleSheet.create({
   card: {
      width: 110,
      backgroundColor: '#fff',
      borderRadius: 8,
      marginRight: 8,
      padding: 8,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#e8e8e8',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
      elevation: 2,
   },
   image: {
      width: 72,
      height: 72,
      borderRadius: 6,
      marginBottom: 6,
   },
   imagePlaceholder: {
      backgroundColor: '#f0f0f0',
      justifyContent: 'center',
      alignItems: 'center',
   },
   name: {
      fontSize: 11,
      color: '#2e7d32',
      textAlign: 'center',
      lineHeight: 15,
      marginBottom: 4,
      textDecorationLine: 'underline',
   },
   price: {
      fontSize: 13,
      fontWeight: '600',
      color: '#2e7d32',
      marginBottom: 6,
   },
   addButton: {
      minHeight: 28,
      borderRadius: 8,
      backgroundColor: '#4CAF50',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'stretch',
      paddingHorizontal: 8,
   },
   addButtonAdded: {
      backgroundColor: '#2e7d32',
   },
   addButtonIcon: {
      marginRight: 5,
   },
   addButtonText: {
      color: '#fff',
      fontSize: 11,
      fontWeight: '600',
   },
});

// ----------------------------------------------------------
// Markdown styles
// ----------------------------------------------------------
const markdownStyles = {
   body: {
      fontSize: 14,
      color: '#222',
      lineHeight: 20,
   },
   heading1: { fontSize: 17, fontWeight: '600' as const, marginTop: 4, marginBottom: 4 },
   heading2: { fontSize: 16, fontWeight: '600' as const, marginTop: 4, marginBottom: 4 },
   heading3: { fontSize: 15, fontWeight: '600' as const, marginTop: 4, marginBottom: 4 },
   strong:   { fontWeight: '600' as const },
   em:       { fontStyle: 'italic' as const },
   bullet_list: { marginVertical: 2 },
   ordered_list: { marginVertical: 2 },
   list_item: { marginVertical: 1 },
   paragraph: { marginTop: 0, marginBottom: 6 },
   code_inline: {
      backgroundColor: '#eaeaea',
      paddingHorizontal: 4,
      borderRadius: 4,
      fontFamily: 'monospace',
      fontSize: 13,
   },
   code_block: {
      backgroundColor: '#f4f4f4',
      padding: 8,
      borderRadius: 6,
      fontFamily: 'monospace',
      fontSize: 13,
   },
   link: { color: '#2e7d32', textDecorationLine: 'underline' as const },
};

export default RecipeBot;
