import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Modal,
  Pressable,
} from "react-native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";

import Entypo from "react-native-vector-icons/Entypo";
import { useToast } from "react-native-toast-notifications";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../(tabs)/AuthContext";

const fallbackImage = require("@/assets/images/defaultprofileimage.png");

interface ProfileImage {
  mime: string;
  content: Buffer;
}

interface Profile {
  email: string;
  user_fname: string;
  user_lname: string;
  phone_number: string;
  address: string;
  persona?: string;
  profile_image?: ProfileImage | null;
}

export default function Profile() {
  const navigation = useNavigation();
  const route = useRoute();
  const { isAuthenticated, logout } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  const toast = useToast();

  // Convert stored image to base64
  const formatImage = (img: { mime: string; content: string } | null) => {
    if (!img) return fallbackImage as string;
    return `data:${img.mime};base64,${img.content}`;
  };

  // Fetch user profile
  const loadProfile = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      if (!token) return;

      const res = await axios.get<Profile>("http://localhost:3000/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });

      setProfile(res.data);

      if (res.data.profile_image) {
        const imgContent =
          typeof res.data.profile_image.content === "string"
            ? res.data.profile_image.content
            : res.data.profile_image.content.toString("base64");

        setImageUri(formatImage({ mime: res.data.profile_image.mime, content: imgContent }));
      }
    } catch (err) {
      console.log("Profile fetch error:", err);
    }
  };

  // Load profile on login
  useEffect(() => {
    if (isAuthenticated) loadProfile();
  }, [isAuthenticated]);

  // Refresh when navigating back
  useFocusEffect(
    React.useCallback(() => {
      if (route.params?.updatedProfile) {
        setProfile(route.params.updatedProfile);
      } else {
        loadProfile();
      }
    }, [route.params])
  );

  // Logout Handler
  const handleLogout = () => {
    logout();
    setProfile(null);

    toast.show("Signed out successfully!", {
      type: "success",
      placement: "top",
    });
  };

  // Pick new profile picture
  const pickImage = async () => {
    const pick = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
      aspect: [4, 3],
    });

    if (!pick.canceled) {
      const selected = pick.assets[0].uri;
      setImageUri(selected);

      await uploadProfileImage(selected, pick.assets[0].fileName!);
      setIsModalVisible(true);
    }
  };

  // Upload image to backend
  const uploadProfileImage = async (uri: string, filename: string) => {
    const token = await AsyncStorage.getItem("authToken");
    if (!token) return;

    try {
      const file = await fetch(uri);
      const blob = await file.blob();

      const form = new FormData();
      form.append("image", blob, filename);

      await axios.post("http://localhost:3000/api/users/upload-profile-image", form, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });
    } catch (err) {
      console.log("Upload error:", err);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Image source={{ uri: imageUri || fallbackImage }} style={styles.avatar} />

        <TouchableOpacity onPress={pickImage} style={styles.cameraBtn}>
          <Entypo name="camera" size={24} color="#fff" />
          <Text style={styles.cameraText}>Change Profile Picture</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => navigation.navigate("EditProfile")}
        >
          <Text style={styles.editText}>Edit Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Modal */}
      <Modal visible={isModalVisible} animationType="fade" transparent>
        <View style={styles.modalWrap}>
          <View style={styles.modalBox}>
            <Text style={styles.modalMsg}>Profile picture updated!</Text>

            <Pressable style={styles.modalClose} onPress={() => setIsModalVisible(false)}>
              <Text style={styles.modalCloseText}>OK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 18,
    paddingHorizontal: 16,
    backgroundColor: "#f3f3f3",
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    marginBottom: 24,
  },

  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: "#ddd",
    marginBottom: 20,
  },

  cameraBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4CAF50",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    marginBottom: 20,
  },

  cameraText: { color: "#fff", marginLeft: 8, fontSize: 16 },

  editBtn: {
    backgroundColor: "#2196F3",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 20,
  },

  editText: { color: "#fff", fontSize: 16 },

  logoutBtn: {
    backgroundColor: "#FF5722",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },

  logoutText: { color: "#fff", fontSize: 16 },

  modalWrap: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },

  modalBox: {
    backgroundColor: "#fff",
    padding: 22,
    borderRadius: 12,
    alignItems: "center",
    width: "75%",
  },

  modalMsg: { fontSize: 17, marginBottom: 20 },

  modalClose: {
    backgroundColor: "#4CAF50",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },

  modalCloseText: { color: "#fff", fontSize: 16 },
});
