import React from "react";
import { View, Text, Pressable } from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";

export type FilterOption = {
  key: string;
  label: string;
  count?: number;
};

type FilterCheckboxGroupProps = {
  title: string;
  options: FilterOption[];
  selectedKeys: string[];
  onToggle: (key: string) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
};

export default function FilterCheckboxGroup({
  title,
  options,
  selectedKeys,
  onToggle,
  expanded,
  onToggleExpanded,
}: FilterCheckboxGroupProps) {
  return (
    <View className="mb-6">
      <Pressable
        onPress={onToggleExpanded}
        className="flex-row items-center justify-between mb-3"
      >
        <Text className="text-sm font-semibold text-gray-900">{title}</Text>
        <FontAwesome6
          name={expanded ? "chevron-up" : "chevron-down"}
          size={12}
          color="#6B7280"
        />
      </Pressable>

      {expanded && (
        <View className="space-y-2">
          {options.map((option) => {
            const isSelected = selectedKeys.includes(option.key);
            return (
              <Pressable
                key={option.key}
                onPress={() => onToggle(option.key)}
                className={[
                  "flex-row items-center justify-between px-3 py-2 rounded-lg mb-1",
                  isSelected
                    ? "bg-[#E5F7F0]"
                    : "bg-transparent hover:bg-gray-50",
                ].join(" ")}
              >
                <View className="flex-row items-center flex-1">
                  <View
                    className={[
                      "w-4 h-4 rounded border-2 mr-3 items-center justify-center",
                      isSelected
                        ? "border-primary_green bg-primary_green"
                        : "border-gray-300 bg-white",
                    ].join(" ")}
                  >
                    {isSelected && (
                      <FontAwesome6 name="check" size={10} color="#FFFFFF" />
                    )}
                  </View>
                  <Text
                    className={[
                      "text-sm",
                      isSelected
                        ? "text-primary_green font-medium"
                        : "text-gray-700",
                    ].join(" ")}
                  >
                    {option.label}
                  </Text>
                </View>
                {typeof option.count === "number" && (
                  <Text className="text-xs text-gray-500 ml-2">
                    ({option.count})
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
