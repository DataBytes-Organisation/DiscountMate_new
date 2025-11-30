import React from "react";
import { Pressable, Text } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";

export default function AddButton({ label = "Add", onPress }: { label?: string; onPress?: () => void }) {
   return (
      <Pressable
         onPress={onPress}
         className="flex-row items-center justify-center py-2.5 rounded-xl bg-gradient-to-r from-primary to-secondary shadow-sm active:opacity-90"
      >
         <FontAwesome5
            name="shopping-basket"
            size={14}
            color="#FFFFFF"
            style={{ marginRight: 6 }}
         />
         <Text className="text-white text-sm font-semibold">{label}</Text>
      </Pressable>
   );
}
