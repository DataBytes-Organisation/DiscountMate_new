import React, { useEffect, useRef, useState } from "react";
import {
   ActivityIndicator,
   Modal,
   Platform,
   Pressable,
   Text,
   TouchableWithoutFeedback,
   useWindowDimensions,
   View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import { REVERSE_IMAGE_SEARCH_API_URL } from "../../constants/Api";

export type ImageSearchResult = {
   id?: string;
   name?: string;
   product_name?: string;
   title?: string;
   [key: string]: unknown;
};

export function ProductImageScanner({
   onResults,
   label = "Scan product",
   compact = false,
   square = false,
}: {
   onResults: (results: ImageSearchResult[]) => void;
   label?: string;
   compact?: boolean;
   square?: boolean;
}) {
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [showMenu, setShowMenu] = useState(false);
   const [webcamActive, setWebcamActive] = useState(false);
   const [anchor, setAnchor] = useState({ top: 0, right: 0 });
   const buttonRef = useRef<View>(null);
   const videoRef = useRef<any>(null);
   const streamRef = useRef<any>(null);
   const { width } = useWindowDimensions();

   const stopWebcam = () => {
      streamRef.current?.getTracks().forEach((track: any) => track.stop());
      streamRef.current = null;
   };

   useEffect(() => {
      if (!webcamActive || Platform.OS !== "web") return undefined;
      void (async () => {
         try {
            const stream = await (globalThis as any).navigator.mediaDevices.getUserMedia({ video: true });
            streamRef.current = stream;
            if (videoRef.current) videoRef.current.srcObject = stream;
         } catch {
            setError("Could not access the camera. Check your browser permission and try again.");
            setWebcamActive(false);
         }
      })();
      return stopWebcam;
   }, [webcamActive]);

   const upload = async (formData: FormData) => {
      setLoading(true);
      setError(null);
      try {
         const response = await fetch(`${REVERSE_IMAGE_SEARCH_API_URL}?top_k=5`, {
            method: "POST",
            body: formData,
         });
         const payload = await response.json().catch(() => ({}));
         if (!response.ok) {
            const detail = (payload as any).detail || (payload as any).message;
            throw new Error(typeof detail === "string" ? detail : "The image could not be processed.");
         }
         const results = Array.isArray(payload) ? payload : Array.isArray((payload as any).results) ? (payload as any).results : [];
         if (!results.length) throw new Error("No products were recognised. Try a clearer front-facing photo.");
         onResults(results);
      } catch (cause) {
         const message = cause instanceof Error ? cause.message : "Image search is unavailable right now.";
         setError(/fetch|network/i.test(message) ? "Image search is unavailable right now. Please try again later." : message);
      } finally {
         setLoading(false);
      }
   };

   const uploadBlob = (blob: Blob, name = "product.jpg") => {
      const formData = new FormData();
      const WebFile = (globalThis as any).File;
      formData.append("file", new WebFile([blob], name, { type: blob.type || "image/jpeg" }));
      return upload(formData);
   };

   const uploadNativeAsset = (asset: ImagePicker.ImagePickerAsset) => {
      const formData = new FormData();
      formData.append("file", {
         uri: asset.uri,
         name: asset.fileName || "product.jpg",
         type: asset.mimeType || "image/jpeg",
      } as any);
      return upload(formData);
   };

   const chooseSource = async (source: "camera" | "library") => {
      setShowMenu(false);
      setError(null);
      if (source === "camera" && Platform.OS === "web") {
         setWebcamActive(true);
         return;
      }
      const permission = source === "camera"
         ? await ImagePicker.requestCameraPermissionsAsync()
         : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
         setError(`${source === "camera" ? "Camera" : "Photo library"} permission is required.`);
         return;
      }
      const picked = source === "camera"
         ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 })
         : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
      if (picked.canceled || !picked.assets?.length) return;
      const asset = picked.assets[0];
      if (Platform.OS === "web") {
         const response = await fetch(asset.uri);
         await uploadBlob(await response.blob(), asset.fileName || "product.jpg");
      } else {
         await uploadNativeAsset(asset);
      }
   };

   const capture = () => {
      const video = videoRef.current;
      if (!video) return;
      const canvas = (globalThis as any).document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d").drawImage(video, 0, 0);
      canvas.toBlob((blob: Blob | null) => {
         stopWebcam();
         setWebcamActive(false);
         if (blob) void uploadBlob(blob, "capture.jpg");
      }, "image/jpeg", 0.85);
   };

   const openMenu = () => {
      buttonRef.current?.measure((_x, _y, measuredWidth, height, pageX, pageY) => {
         setAnchor({ top: pageY + height + 6, right: width - pageX - measuredWidth });
         setShowMenu(true);
      });
   };

   return (
      <View>
         <View ref={buttonRef}>
            <Pressable
               accessibilityLabel={label}
               onPress={openMenu}
               disabled={loading}
               className={`${square ? "h-12 w-12" : compact ? "px-3 py-2" : "px-4 py-3"} flex-row items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white`}
            >
               {loading ? <ActivityIndicator size="small" color="#0DAD79" /> : <FontAwesome6 name="camera" size={15} color="#0DAD79" />}
               {!square ? <Text className="text-sm font-semibold text-emerald-700">{label}</Text> : null}
            </Pressable>
         </View>
         {error ? <Text className="mt-2 max-w-[280px] text-xs text-red-700">{error}</Text> : null}

         <Modal visible={showMenu} transparent animationType="none" onRequestClose={() => setShowMenu(false)}>
            <TouchableWithoutFeedback onPress={() => setShowMenu(false)}>
               <View className="flex-1">
                  <TouchableWithoutFeedback>
                     <View
                        className="absolute min-w-[210px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
                        style={{ top: anchor.top, right: anchor.right }}
                     >
                        <ScannerMenuItem icon="camera" label="Take photo" onPress={() => void chooseSource("camera")} />
                        <View className="h-px bg-gray-100" />
                        <ScannerMenuItem icon="image" label="Choose from library" onPress={() => void chooseSource("library")} />
                     </View>
                  </TouchableWithoutFeedback>
               </View>
            </TouchableWithoutFeedback>
         </Modal>

         {Platform.OS === "web" ? (
            <Modal visible={webcamActive} transparent animationType="fade" onRequestClose={() => { stopWebcam(); setWebcamActive(false); }}>
               <View className="flex-1 items-center justify-center bg-black/75 px-5">
                  <View className="w-full max-w-[620px] overflow-hidden rounded-2xl bg-white">
                     {React.createElement("video", {
                        ref: videoRef,
                        autoPlay: true,
                        playsInline: true,
                        style: { width: "100%", maxHeight: 420, objectFit: "cover", backgroundColor: "#000" },
                     })}
                     <View className="flex-row gap-3 p-4">
                        <Pressable onPress={() => { stopWebcam(); setWebcamActive(false); }} className="flex-1 items-center rounded-xl border border-gray-200 py-3">
                           <Text className="font-semibold text-gray-700">Cancel</Text>
                        </Pressable>
                        <Pressable onPress={capture} className="flex-[2] items-center rounded-xl bg-emerald-600 py-3">
                           <Text className="font-semibold text-white">Capture product</Text>
                        </Pressable>
                     </View>
                  </View>
               </View>
            </Modal>
         ) : null}
      </View>
   );
}

function ScannerMenuItem({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
   return (
      <Pressable onPress={onPress} className="flex-row items-center gap-3 px-4 py-3 hover:bg-gray-50">
         <FontAwesome6 name={icon} size={15} color="#0DAD79" />
         <Text className="text-sm font-medium text-gray-800">{label}</Text>
      </Pressable>
   );
}
