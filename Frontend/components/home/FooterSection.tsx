import React from "react";
import { View, Text, TextInput, TouchableOpacity, Linking, Alert } from "react-native";
import { FontAwesome } from "@expo/vector-icons";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import { router } from "expo-router";

interface FooterSectionProps {
  disableEdgeOffset?: boolean;
}

type FooterLink = {
  label: string;
  route?: string;     // internal route (Expo Router)
  url?: string;       // external link
};

const quickLinks: FooterLink[] = [
  { label: "Home", route: "/" },
  { label: "Compare Prices", route: "/compare" },
  { label: "Weekly Specials", route: "/specials" },
  { label: "My Lists", route: "/my-lists" },
  { label: "Price Alerts", route: "/price-alerts" },
];

const supportLinks: FooterLink[] = [
  { label: "Help Center", route: "/help" },
  { label: "Contact Us", route: "/contact" },
  { label: "FAQs", route: "/faqs" },
  { label: "Privacy Policy", route: "/privacy" },
  { label: "Terms of Service", route: "/terms" },
];

const bottomLinks: FooterLink[] = [
  { label: "Privacy", route: "/privacy" },
  { label: "Terms", route: "/terms" },
  { label: "Cookies", route: "/cookies" },
];

const socialLinks: FooterLink[] = [
  // Replace these with your real social URLs (or remove buttons)
  { label: "facebook", url: "https://facebook.com" },
  { label: "twitter", url: "https://twitter.com" },
  { label: "instagram", url: "https://instagram.com" },
];

const FooterSection: React.FC<FooterSectionProps> = ({ disableEdgeOffset }) => {
  const go = async (link: FooterLink) => {
    try {
      if (link.route) {
        router.push(link.route);
        return;
      }
      if (link.url) {
        const canOpen = await Linking.canOpenURL(link.url);
        if (!canOpen) {
          Alert.alert("Cannot open link", link.url);
          return;
        }
        await Linking.openURL(link.url);
      }
    } catch (e) {
      Alert.alert("Navigation error", "Could not open that link.");
    }
  };

  return (
    <View
      className="bg-dark m-0"
      style={[
        disableEdgeOffset ? undefined : { marginHorizontal: -16 },
        { marginBottom: -24 },
      ]}
    >
      <View className="w-full px-6 md:px-12 py-12">
        {/* Top grid */}
        <View className="flex flex-col gap-10 md:flex-row md:justify-between md:gap-8 mb-10">
          {/* Brand + description + social */}
          <View className="flex-1">
            <View className="flex flex-row items-center gap-2 mb-6">
              <View className="w-11 h-11 rounded-lg items-center justify-center bg-gradient-to-br from-primary_green to-secondary_green shadow-md">
                <FontAwesome6 name="tag" size={20} color="#FFFFFF" solid />
              </View>
              <Text className="text-2xl font-bold text-white">DiscountMate</Text>
            </View>

            <Text className="text-sm text-gray-400 mb-6">
              Your smart shopping companion for finding the best grocery deals
              across Australia&apos;s leading retailers.
            </Text>

            <View className="flex flex-row items-center gap-4">
              <TouchableOpacity
                className="w-10 h-10 rounded-lg bg-white/10 items-center justify-center active:bg-primary"
                onPress={() => go(socialLinks[0])}
                accessibilityRole="link"
              >
                <FontAwesome name="facebook" size={18} color="#E5E7EB" />
              </TouchableOpacity>

              <TouchableOpacity
                className="w-10 h-10 rounded-lg bg-white/10 items-center justify-center active:bg-primary"
                onPress={() => go(socialLinks[1])}
                accessibilityRole="link"
              >
                <FontAwesome name="twitter" size={18} color="#E5E7EB" />
              </TouchableOpacity>

              <TouchableOpacity
                className="w-10 h-10 rounded-lg bg-white/10 items-center justify-center active:bg-primary"
                onPress={() => go(socialLinks[2])}
                accessibilityRole="link"
              >
                <FontAwesome name="instagram" size={18} color="#E5E7EB" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick Links */}
          <View className="flex-1">
            <Text className="text-white font-bold mb-5">Quick Links</Text>
            <View className="gap-3">
              {quickLinks.map((item) => (
                <TouchableOpacity
                  key={item.label}
                  onPress={() => go(item)}
                  accessibilityRole="link"
                >
                  <Text className="text-sm text-gray-400 active:text-primary">
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Support */}
          <View className="flex-1">
            <Text className="text-white font-bold mb-5">Support</Text>
            <View className="gap-3">
              {supportLinks.map((item) => (
                <TouchableOpacity
                  key={item.label}
                  onPress={() => go(item)}
                  accessibilityRole="link"
                >
                  <Text className="text-sm text-gray-400 active:text-primary">
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Newsletter */}
          <View className="flex-1">
            <Text className="text-white font-bold mb-5">Newsletter</Text>
            <Text className="text-sm text-gray-400 mb-5">
              Subscribe to get weekly deals and exclusive offers.
            </Text>

            <View className="flex-row items-center gap-2">
              <TextInput
                placeholder="Your email"
                placeholderTextColor="#9CA3AF"
                className="flex-1 px-4 py-3 rounded-lg border border-white/20 bg-white/10 text-sm text-white"
              />
              <TouchableOpacity
                className="px-4 py-3 rounded-lg bg-gradient-to-r from-primary_green to-secondary_green items-center justify-center shadow-lg"
                onPress={() => Alert.alert("Newsletter", "Connect this to your backend later.")}
              >
                <FontAwesome6 name="paper-plane" size={15} color="#FFFFFF" solid />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Bottom bar */}
        <View className="border-t border-white/10 pt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <Text className="text-sm text-gray-400">
            © {new Date().getFullYear()} DiscountMate. All rights reserved.
          </Text>

          <View className="flex flex-row items-center gap-6">
            {bottomLinks.map((item) => (
              <TouchableOpacity
                key={item.label}
                onPress={() => go(item)}
                accessibilityRole="link"
              >
                <Text className="text-sm text-gray-400 active:text-primary">
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
};

export default FooterSection;
