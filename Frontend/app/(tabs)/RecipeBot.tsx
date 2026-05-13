/* ============================================================
 * RecipeBot.tsx — Floating Recipe Chatbot 
 * ============================================================
 * A persistent chat bubble that lives in the bottom-right
 * corner of every page. Clicking it expands a chat window
 * connected to the Recipe RAG API.
 *
 *
 * Technical: React functional component using hooks (useState
 *            for local UI state, useRef for scroll control).
 *            All styling via React Native's StyleSheet API
 *            so it works on web (Expo) and could later be
 *            shipped to iOS/Android with no changes.
 *
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
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import Markdown from 'react-native-markdown-display';

// ----------------------------------------------------------
// Configuration
// ----------------------------------------------------------
// Where the Node API gateway lives. In dev: localhost:3000.
// In production this should come from an env var, but for now
// hardcoding is fine.
const API_BASE_URL = 'http://localhost:3000';

// How many recipes to retrieve per question. Lower = faster
// LLM call (less context to read). 3-5 is the sweet spot.
const TOP_K = 5;

// ----------------------------------------------------------
// Types — tell TypeScript what a chat message looks like
// ----------------------------------------------------------
interface Message {
   text: string;
   sender: 'user' | 'bot';
}

// ----------------------------------------------------------
// The component
// ----------------------------------------------------------
const RecipeBot: React.FC = () => {

   // --- STATE ---
   // useState gives us a value + a setter function.
   // When we call the setter, React re-renders the component.

   // Is the chat panel expanded? (false = just the bubble)
   const [isOpen, setIsOpen] = useState<boolean>(false);

   // The list of messages currently displayed in the chat
   // Seeded with one welcome message from the bot
   const [messages, setMessages] = useState<Message[]>([
      {
         sender: 'bot',
         text:
            "Hi! I'm your DiscountMate recipe assistant. Ask me what you " +
            "can cook with what you've got, or for a meal idea using " +
            "this week's specials.",
      },
   ]);

   // What the user is currently typing in the input box
   const [inputText, setInputText] = useState<string>('');

   // Whether we're waiting for a bot response (shows the spinner)
   const [isTyping, setIsTyping] = useState<boolean>(false);

   // A reference to the scroll view so we can auto-scroll to the bottom
   // when new messages arrive. useRef gives us a stable reference that
   // survives re-renders without causing them.
   const scrollViewRef = useRef<ScrollView>(null);

   // --- EFFECTS ---
   // useEffect runs code AFTER the component renders.
   // This one runs every time `messages` changes — and scrolls
   // the chat to the bottom so the newest message is visible.
   useEffect(() => {
      if (scrollViewRef.current) {
         scrollViewRef.current.scrollToEnd({ animated: true });
      }
   }, [messages]);

   // A stable session ID for this chat instance. Generated once
   // when the component mounts and reused for every message.
   // useRef (not useState) because changing it shouldn't re-render.
   //
   // crypto.randomUUID() gives us a real UUID like
   //   "f47ac10b-58cc-4372-a567-0e02b2c3d479"
   // Available in modern browsers; Expo web supports it.
   const sessionIdRef = useRef<string>(
      typeof crypto !== 'undefined' && crypto.randomUUID
         ? crypto.randomUUID()
         : `session-${Date.now()}-${Math.random().toString(36).slice(2)}`
   );


   // --- HANDLERS ---
   // Functions that respond to user actions.

   /**
    * Send the user's message to the backend and display the reply.
    *
    * Flow:
    *   1. Show user's message immediately (optimistic UI)
    *   2. Show typing spinner
    *   3. POST to /api/ml/recipe/chat
    *   4. Append bot's answer (or an error message) when it returns
    *
    * Layman: "Take what they typed, send it to the kitchen, and
    *          show whatever the chef sends back — even if the
    *          chef tells us they're closed."
    */
   const handleSend = async (): Promise<void> => {
      const trimmed = inputText.trim();
      if (!trimmed) return;

      // Optimistic UI: show the user's message and clear input
      // BEFORE the network call returns. Feels instant.
      setMessages((prev) => [...prev, { sender: 'user', text: trimmed }]);
      setInputText('');
      setIsTyping(true);

      try {
         // Build the request body matching what Flask expects
         const body = {
            session_id: sessionIdRef.current,
            message: trimmed,
            top_k: TOP_K,
         };

         // The actual HTTP call. fetch() is the JS equivalent of
         // PowerShell's Invoke-RestMethod or Python's requests.post.
         const response = await fetch(`${API_BASE_URL}/api/ml/recipe/chat`, {
            method: 'POST',
            headers: {
               'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
         });

         // Always parse the body, even on error responses, because
         // our backend sends structured JSON with error details.
         const data = await response.json();

         if (!response.ok || data.success === false) {
            // The backend returned an error response (4xx/5xx).
            // Show its message rather than a generic one.
            const errorText =
               data.error ||
               data.message ||
               `Sorry, something went wrong (HTTP ${response.status}).`;
            setMessages((prev) => [
               ...prev,
               { sender: 'bot', text: ` ${errorText}` },
            ]);
         } else {
            // Success path: display the LLM-generated answer
            setMessages((prev) => [
               ...prev,
               { sender: 'bot', text: data.answer },
            ]);

            // If the user has burned through their 3-turn cap, let
            // them know — the next send will be rejected by the API
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
         // Network error (server down, no internet, CORS blocked, etc).
         // err.message is usually "Failed to fetch" — not user-friendly,
         // so we show our own message and log the real one for devs.
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
         // Always hide the typing spinner — whether success or failure
         setIsTyping(false);
      }
   };

   /**
    * Reset the chat: tell the backend to drop this session's
    * history, then clear the local message list and mint a
    * fresh session ID so the next message starts a new turn count.
    */
   const handleReset = async (): Promise<void> => {
      const oldSessionId = sessionIdRef.current;

      // Mint a new session ID immediately so any in-flight
      // sends don't pollute the new conversation.
      sessionIdRef.current =
         typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      // Reset the visible chat to the welcome state.
      setMessages([
         {
            sender: 'bot',
            text:
               "Fresh start! Ask me what you can cook with what you've " +
               "got, or for a meal idea using this week's specials.",
         },
      ]);
      setInputText('');

      // Fire-and-forget the backend reset. We don't block the UI
      // on it — the new session ID already isolates us from the old
      // server-side history, and the server will eventually evict it.
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
   // --- RENDER ---
   // What this component shows on screen.
   // We always render the bubble; the panel only appears when isOpen=true.
   return (
      <View style={styles.container}>

         {/* === EXPANDED CHAT PANEL (only when isOpen) === */}
         {isOpen && (
            <View style={styles.chatWindow}>

               {/* Header bar with title + close button */}
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

               {/* Scrolling message area */}
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
                           <Markdown style={markdownStyles}>
                              {msg.text}
                           </Markdown>
                        ) : (
                           <Text style={styles.messageText}>{msg.text}</Text>
                        )}
                     </View>
                  ))}

                  {/* Typing indicator (only while waiting for bot) */}
                  {isTyping && (
                     <View style={[styles.messageBubble, styles.botBubble]}>
                        <ActivityIndicator size="small" color="#4CAF50" />
                     </View>
                  )}
               </ScrollView>

               {/* Input row at the bottom */}
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

         {/* === ALWAYS-VISIBLE FLOATING BUBBLE === */}
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
// React Native uses a JS-object version of CSS. Numbers are
// pixels (web) or density-independent points (mobile).
const styles = StyleSheet.create({
   container: {
      position: 'absolute',
      bottom: 20,
      right: 20,
      zIndex: 1000,         // float above all other page content
   },
   bubbleButton: {
      backgroundColor: '#4CAF50',
      width: 60,
      height: 60,
      borderRadius: 30,     // half of width/height = perfect circle
      justifyContent: 'center',
      alignItems: 'center',
      // Shadow (works on web + native)
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 6,         // Android-only equivalent of shadow
   },
   chatWindow: {
      position: 'absolute',
      bottom: 70,           // sit just above the bubble
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
      flex: 1,              // fill remaining space, pushing close button to the right
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
   },
   closeButton: {
      padding: 4,
   },
   headerButton: {
      padding: 6,
      marginLeft: 4,
   },
   messagesContainer: {
      flex: 1,              // grow to fill all available vertical space
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
      backgroundColor: '#DCF5E1',  // soft green tint
   },
   messageText: {
      fontSize: 14,
      color: '#222',
      lineHeight: 20,
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
      backgroundColor: '#a5d6a7',  // pale green while waiting
   },
});

// ----------------------------------------------------------
// Markdown styles
// ----------------------------------------------------------
// react-native-markdown-display takes a separate style object
// keyed by markdown element name (body, heading1, list_item, etc).
// We keep it tight so formatted bot messages still look like
// chat bubble content, not a blog post.
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