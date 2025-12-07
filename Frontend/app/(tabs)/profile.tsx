import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Modal,
} from "react-native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../context/AuthContext";
import Entypo from "react-native-vector-icons/Entypo";

const defaultImage = require("../assets/images/defaultprofileimage.png");

interface Profile {
  user_fname: string;
  user_lname: string;
  email: string;
  phone_number: string;
  address: string;
  profile_image?: {
    mime: string;
    content: string;
  } | null;
}

export default function Profile() {
  const { logout } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // IMPORTANT: Replace with your machine IP
  const API_URL = "http://172.16.11.120:3000";

  const formatImage = (img: any) => {
    if (!img) return null;
    return `data:${img.mime};base64,${img.content}`;
  };

  const fetchProfile = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      if (!token) return;

      const response = await axios.get(`${API_URL}/api/users/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setProfile(response.data);

      if (response.data.profile_image) {
        setImage(formatImage(response.data.profile_image));
      }
    } catch (err) {
      console.log("Profile fetch error:", err);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      base64: true,
      quality: 1,
    });

    if (!result.canceled) {
      const file = result.assets[0];
      setImage(file.uri);
      await uploadImage(file);
      setModalVisible(true);
    }
  };

  const uploadImage = async (file: any) => {
    const token = await AsyncStorage.getItem("authToken");
    if (!token) return;

    const formData = new FormData();
    formData.append("image", {
      uri: file.uri,
      type: file.mimeType || "image/jpeg",
      name: file.fileName || "profile.jpg",
    });

    try {
      await axios.post(`${API_URL}/api/users/upload-profile-image`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      fetchProfile(); // refresh UI
    } catch (err) {
      console.log("Upload error:", err);
    }
  };

  const signOut = () => {
    logout();
    setProfile(null);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Image
          source={image ? { uri: image } : defaultImage}
          style={styles.profileImage}
        />

        <Text style={styles.name}>
          {profile?.user_fname} {profile?.user_lname}
        </Text>

        <Text style={styles.text}>{profile?.email}</Text>
        <Text style={styles.text}>{profile?.phone_number}</Text>
        <Text style={styles.text}>{profile?.address}</Text>

        <TouchableOpacity style={styles.button} onPress={pickImage}>
          <Entypo name="camera" size={20} color="#fff" />
          <Text style={styles.buttonText}>Change Profile Picture</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Success Modal */}
      <Modal transparent visible={modalVisible}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalText}>Profile Updated!</Text>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.closeTxt}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#f5f5f5",
    flex: 1,
    padding: 20,
  },
  card: {
    backgroundColor: "#fff",
    padding: 25,
    borderRadius: 15,
    alignItems: "center",
    elevation: 5,
  },
  profileImage: {
    width: 140,
    height: 140,
    borderRadius: 80,
    marginBottom: 20,
  },
  name: {
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 10,
  },
  text: {
    fontSize: 16,
    marginBottom: 4,
    color: "#444",
  },
  button: {
    flexDirection: "row",
    backgroundColor: "#0c8",
    padding: 10,
    borderRadius: 8,
    marginVertical: 20,
  },
  buttonText: {
    color: "#fff",
    marginLeft: 8,
    fontSize: 16,
  },
  logoutButton: {
    backgroundColor: "#d9534f",
    padding: 12,
    borderRadius: 8,
  },
  logoutButtonText: {
    color: "#fff",
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modal: {
    backgroundColor: "#fff",
    padding: 25,
    borderRadius: 10,
  },
  modalText: {
    fontSize: 18,
    marginBottom: 20,
    textAlign: "center",
  },
  closeBtn: {
    backgroundColor: "#0c8",
    borderRadius: 6,
    padding: 10,
  },
  closeTxt: {
    color: "#fff",
    textAlign: "center",
  },
});
