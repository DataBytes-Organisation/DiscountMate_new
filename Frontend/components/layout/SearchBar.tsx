import React, { useEffect, useRef, useState } from "react";
import {
   ActivityIndicator,
   Modal,
   Platform,
   Pressable,
   Text,
   TextInput,
   TouchableWithoutFeedback,
   useWindowDimensions,
   View,
} from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { REVERSE_IMAGE_SEARCH_API_URL } from "@/constants/Api";
import { useImageSearch } from "../../app/(tabs)/ImageSearchContext";

export default function SearchBar() {
   const [isFocused, setIsFocused] = useState(false);
   const [searchQuery, setSearchQuery] = useState("");
   const [imageSearchLoading, setImageSearchLoading] = useState(false);
   const [imageSearchError, setImageSearchError] = useState<string | null>(null);
   const [showImageMenu, setShowImageMenu] = useState(false);
   const [menuAnchor, setMenuAnchor] = useState({ top: 0, right: 0 });
   const [webcamActive, setWebcamActive] = useState(false);

   const cameraButtonRef = useRef<View>(null);
   const videoRef = useRef<any>(null);
   const streamRef = useRef<any>(null);
   const { width: windowWidth } = useWindowDimensions();
   const router = useRouter();
   const { setResults } = useImageSearch();

   const uploadFormData = async (formData: FormData) => {
      setImageSearchLoading(true);
      setImageSearchError(null);

      try {
         const response = await fetch(`${REVERSE_IMAGE_SEARCH_API_URL}?top_k=5`, {
            method: "POST",
            body: formData,
         });

         if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            const detail = (body as any).detail || (body as any).message;
            const message = Array.isArray(detail)
               ? "Uploaded file could not be processed."
               : typeof detail === "string"
                  ? detail
                  : `Server error ${response.status}`;
            throw new Error(message);
         }

         const results = await response.json();
         setResults(results);
         router.push("/search?imageSearch=true");
      } catch (error: any) {
         const raw = typeof error?.message === "string" ? error.message : String(error ?? "");
         setImageSearchError(
            raw.toLowerCase().includes("fetch") || raw.toLowerCase().includes("network")
               ? "Image search is unavailable right now. Please try again later."
               : raw || "Image search failed."
         );
      } finally {
         setImageSearchLoading(false);
      }
   };

   const uploadBlob = (blob: Blob, name = "image.jpg") => {
      const formData = new FormData();
      const WebFile = (globalThis as any).File;
      formData.append("file", new WebFile([blob], name, { type: blob.type || "image/jpeg" }));
      return uploadFormData(formData);
   };

   const uploadNativeAsset = (asset: ImagePicker.ImagePickerAsset) => {
      const formData = new FormData();
      formData.append("file", {
         uri: asset.uri,
         name: asset.fileName ?? "image.jpg",
         type: asset.mimeType ?? "image/jpeg",
      } as any);
      return uploadFormData(formData);
   };

   const startWebcam = async () => {
      try {
         const stream = await (globalThis as any).navigator.mediaDevices.getUserMedia({ video: true });
         streamRef.current = stream;
         if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
         setImageSearchError("Could not access camera. Please allow camera permission in your browser.");
         setWebcamActive(false);
      }
   };

   const stopWebcam = () => {
      streamRef.current?.getTracks().forEach((track: any) => track.stop());
      streamRef.current = null;
   };

   useEffect(() => {
      if (webcamActive && Platform.OS === "web") startWebcam();
      return () => {
         if (Platform.OS === "web") stopWebcam();
      };
   }, [webcamActive]);

   const capturePhoto = () => {
      const video = videoRef.current;
      if (!video) return;

      const canvas = (globalThis as any).document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d").drawImage(video, 0, 0);
      canvas.toBlob((blob: Blob | null) => {
         stopWebcam();
         setWebcamActive(false);
         if (blob) uploadBlob(blob, "capture.jpg");
      }, "image/jpeg", 0.85);
   };

   const handleSearch = () => {
      if (searchQuery.trim().length > 0) {
         router.push(`/search?query=${encodeURIComponent(searchQuery.trim())}`);
      }
   };

   const handleImageSearch = async (source: "library" | "camera") => {
      setShowImageMenu(false);
      setImageSearchError(null);

      if (source === "camera") {
         if (Platform.OS === "web") {
            setWebcamActive(true);
            return;
         }

         const permission = await ImagePicker.requestCameraPermissionsAsync();
         if (!permission.granted) {
            setImageSearchError("Camera permission is required to take a photo.");
            return;
         }

         const picked = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
         });
         if (!picked.canceled && picked.assets?.length) uploadNativeAsset(picked.assets[0]);
         return;
      }

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
         setImageSearchError("Permission to access photos is required.");
         return;
      }

      const picked = await ImagePicker.launchImageLibraryAsync({
         mediaTypes: ImagePicker.MediaTypeOptions.Images,
         quality: 0.8,
      });
      if (picked.canceled || !picked.assets?.length) return;

      const asset = picked.assets[0];
      if (Platform.OS === "web") {
         const blobResponse = await fetch(asset.uri);
         const blob = await blobResponse.blob();
         uploadBlob(blob, asset.fileName ?? "image.jpg");
      } else {
         uploadNativeAsset(asset);
      }
   };

   const openImageMenu = () => {
      cameraButtonRef.current?.measure((_x, _y, width, height, pageX, pageY) => {
         setMenuAnchor({ top: pageY + height + 6, right: windowWidth - pageX - width });
         setShowImageMenu(true);
      });
   };

   return (
      <View className="bg-white border-b border-gray-100 sticky top-[128px] z-40 shadow-sm">
         <View className="w-full px-4 md:px-8 py-6">
            <View className="flex-row items-center gap-4">
               {/* Search input */}
               <View
                  className={[
                     "flex-1 relative rounded-xl border-2 bg-white",
                     isFocused
                        ? "border-primary_green shadow-[0_0_0_3px_rgba(16,185,129,0.25)]"
                        : "border-gray-200",
                  ].join(" ")}
               >
                  <FontAwesome6
                     name="magnifying-glass"
                     size={16}
                     className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <TextInput
                     placeholder="Search for products, brands, or categories..."
                     placeholderTextColor="#9CA3AF"
                     className="w-full pl-14 pr-4 py-4 text-base text-[#111827] focus:outline-none focus:ring-0"
                     value={searchQuery}
                     onChangeText={setSearchQuery}
                     onFocus={() => setIsFocused(true)}
                     onBlur={() => setIsFocused(false)}
                     onSubmitEditing={handleSearch}
                     returnKeyType="search"
                  />
               </View>

               <View ref={cameraButtonRef}>
                  <Pressable
                     className="w-14 py-4 items-center justify-center border-2 border-primary_green rounded-xl bg-white"
                     onPress={openImageMenu}
                     disabled={imageSearchLoading}
                     accessibilityLabel="Search by image"
                  >
                     {imageSearchLoading ? (
                        <ActivityIndicator size="small" color="#10B981" />
                     ) : (
                        <FontAwesome6 name="camera" size={18} color="#10B981" />
                     )}
                  </Pressable>
               </View>

               <Modal
                  visible={showImageMenu}
                  transparent
                  animationType="none"
                  onRequestClose={() => setShowImageMenu(false)}
               >
                  <TouchableWithoutFeedback onPress={() => setShowImageMenu(false)}>
                     <View style={{ flex: 1 }}>
                        <TouchableWithoutFeedback>
                           <View
                              style={{
                                 position: "absolute",
                                 top: menuAnchor.top,
                                 right: menuAnchor.right,
                                 backgroundColor: "white",
                                 borderRadius: 12,
                                 borderWidth: 1,
                                 borderColor: "#E5E7EB",
                                 minWidth: 190,
                                 shadowColor: "#000",
                                 shadowOffset: { width: 0, height: 4 },
                                 shadowOpacity: 0.12,
                                 shadowRadius: 8,
                                 elevation: 8,
                                 overflow: "hidden",
                              }}
                           >
                              <Pressable
                                 style={({ pressed }) => ({
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 12,
                                    paddingHorizontal: 16,
                                    paddingVertical: 13,
                                    backgroundColor: pressed ? "#F9FAFB" : "white",
                                 })}
                                 onPress={() => handleImageSearch("camera")}
                              >
                                 <FontAwesome6 name="camera" size={15} color="#10B981" />
                                 <Text style={{ fontSize: 14, color: "#1F2937", fontWeight: "500" }}>
                                    Take Photo
                                 </Text>
                              </Pressable>
                              <View style={{ height: 1, backgroundColor: "#F3F4F6" }} />
                              <Pressable
                                 style={({ pressed }) => ({
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 12,
                                    paddingHorizontal: 16,
                                    paddingVertical: 13,
                                    backgroundColor: pressed ? "#F9FAFB" : "white",
                                 })}
                                 onPress={() => handleImageSearch("library")}
                              >
                                 <FontAwesome6 name="image" size={15} color="#10B981" />
                                 <Text style={{ fontSize: 14, color: "#1F2937", fontWeight: "500" }}>
                                    Choose from Library
                                 </Text>
                              </Pressable>
                           </View>
                        </TouchableWithoutFeedback>
                     </View>
                  </TouchableWithoutFeedback>
               </Modal>

               {Platform.OS === "web" && (
                  <Modal
                     visible={webcamActive}
                     transparent
                     animationType="fade"
                     onRequestClose={() => {
                        stopWebcam();
                        setWebcamActive(false);
                     }}
                  >
                     <View
                        style={{
                           flex: 1,
                           backgroundColor: "rgba(0,0,0,0.75)",
                           justifyContent: "center",
                           alignItems: "center",
                        }}
                     >
                        <View
                           style={{
                              width: "90%",
                              maxWidth: 600,
                              backgroundColor: "white",
                              borderRadius: 16,
                              overflow: "hidden",
                           }}
                        >
                           {React.createElement("video", {
                              ref: videoRef,
                              autoPlay: true,
                              playsInline: true,
                              style: {
                                 width: "100%",
                                 maxHeight: 420,
                                 objectFit: "cover",
                                 display: "block",
                                 backgroundColor: "#000",
                              },
                           })}
                           <View style={{ padding: 16, flexDirection: "row", gap: 12 }}>
                              <Pressable
                                 onPress={() => {
                                    stopWebcam();
                                    setWebcamActive(false);
                                 }}
                                 style={{
                                    flex: 1,
                                    paddingVertical: 13,
                                    borderRadius: 10,
                                    borderWidth: 2,
                                    borderColor: "#E5E7EB",
                                    alignItems: "center",
                                 }}
                              >
                                 <Text style={{ fontSize: 15, color: "#374151", fontWeight: "600" }}>
                                    Cancel
                                 </Text>
                              </Pressable>
                              <Pressable
                                 onPress={capturePhoto}
                                 style={{
                                    flex: 2,
                                    paddingVertical: 13,
                                    borderRadius: 10,
                                    backgroundColor: "#10B981",
                                    alignItems: "center",
                                 }}
                              >
                                 <Text style={{ fontSize: 15, color: "white", fontWeight: "600" }}>
                                    Capture Photo
                                 </Text>
                              </Pressable>
                           </View>
                        </View>
                     </View>
                  </Modal>
               )}

               {/* Search button */}
               <Pressable
                  className="px-8 py-4 bg-gradient-to-r from-primary_green to-secondary_green rounded-xl shadow-sm hover:shadow-lg transition-shadow"
                  onPress={handleSearch}
               >
                  <Text className="text-white font-semibold">Search</Text>
               </Pressable>
            </View>

            {imageSearchError && (
               <View className="mt-3 px-4 py-2 rounded-lg bg-red-50 border border-red-200">
                  <Text className="text-sm text-red-700">{imageSearchError}</Text>
               </View>
            )}
         </View>
      </View>
   );
}
