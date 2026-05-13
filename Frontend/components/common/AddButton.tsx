import React from "react";
import { Pressable, Text } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";

type AddButtonProps = {
   label?: string;
   onPress?: () => void;
   className?: string;
};

export default function AddButton({ label = "Add", onPress, className = "" }: AddButtonProps) {
   return (
      <Pressable
         onPress={onPress}
         className={`flex-row items-center justify-center py-2.5 rounded-xl bg-gradient-to-r from-primary_green to-secondary_green active:opacity-90 ${className}`}
      >
         <FontAwesome5
            name="list"
            size={14}
            color="#FFFFFF"
            style={{ marginRight: 6 }}
         />
         <Text className="text-white text-sm font-semibold">{label}</Text>
      </Pressable>
   );
}
