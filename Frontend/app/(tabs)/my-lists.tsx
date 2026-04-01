import React, { useMemo, useState } from "react";
import {
   View,
   Text,
   ScrollView,
   Pressable,
   useWindowDimensions,
} from "react-native";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import { useShoppingLists } from "./ShoppingListsContext";
import ShoppingListCard from "../../components/my-lists/ShoppingListCard";
import ListAnalyticsPanel from "../../components/my-lists/ListAnalyticsPanel";
import EditShoppingListModal from "../../components/my-lists/EditShoppingListModal";
import FooterSection from "../../components/home/FooterSection";
import type { ShoppingList } from "../../types/ShoppingList";

type MobileTab = "lists" | "insights";

export default function MyListsScreen() {
   const { width } = useWindowDimensions();
   const wide = width >= 900;

   const {
      lists,
      activeListId,
      setActiveList,
      createList,
      updateList,
      deleteList,
      getListById,
   } = useShoppingLists();

   const [selectedListId, setSelectedListId] = useState<string | null>(null);
   const [mobileTab, setMobileTab] = useState<MobileTab>("lists");
   const [modalOpen, setModalOpen] = useState(false);
   const [editingList, setEditingList] = useState<ShoppingList | null>(null);

   const effectiveSelectedId = selectedListId ?? activeListId;
   const selectedList = effectiveSelectedId ? getListById(effectiveSelectedId) ?? null : null;

   const sortedLists = useMemo(
      () =>
         [...lists].sort((a, b) => {
            if (a.id === activeListId) return -1;
            if (b.id === activeListId) return 1;
            return a.name.localeCompare(b.name);
         }),
      [lists, activeListId]
   );
   const listColumnCount = useMemo(() => {
      if (width >= 1500) return 3;
      if (width >= 1100) return 2;
      return 1;
   }, [width]);
   const masonryColumns = useMemo(() => {
      const columns: ShoppingList[][] = Array.from({ length: listColumnCount }, () => []);
      const columnHeights = Array.from({ length: listColumnCount }, () => 0);

      sortedLists.forEach((list) => {
         const nextColumnIndex = columnHeights.indexOf(Math.min(...columnHeights));
         columns[nextColumnIndex].push(list);

         const estimatedHeight =
            1 +
            Math.ceil(list.name.length / 22) +
            Math.ceil((list.description?.length ?? 0) / 48);
         columnHeights[nextColumnIndex] += estimatedHeight;
      });

      return columns;
   }, [sortedLists, listColumnCount]);

   const openCreate = () => {
      setEditingList(null);
      setModalOpen(true);
   };

   const openEdit = (list: ShoppingList) => {
      setEditingList(list);
      setModalOpen(true);
   };

   const handleSaveModal = (payload: {
      name: string;
      description: string;
      accent: ShoppingList["accent"];
   }) => {
      if (editingList) {
         updateList(editingList.id, payload);
      } else {
         createList(payload);
      }
   };

   return (
      <View className="flex-1 bg-[#F9FAFB]">
         <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingBottom: 0 }}
            nestedScrollEnabled
         >
            <View className="px-4 md:px-8 py-10 bg-white border-b border-gray-100">
               <View className="mb-6 items-center">
                  <Text className="text-4xl font-bold text-gray-900 mb-2 text-center">My Lists</Text>
                  <Text className="text-lg text-gray-600 text-center max-w-2xl">
                     Create and organise lists, preview
                     savings analytics.
                  </Text>
               </View>
               <View className="flex-row flex-wrap items-center justify-center gap-3">
                  <Pressable
                     onPress={openCreate}
                     className="flex-row items-center gap-2 px-6 py-3 rounded-2xl bg-primary_green"
                  >
                     <FontAwesome6 name="plus" size={14} color="#FFFFFF" />
                     <Text className="text-base font-semibold text-white">New list</Text>
                  </Pressable>
               </View>
            </View>

            <View className="px-4 md:px-8 pt-6">
               {!wide && (
                  <View className="flex-row rounded-2xl border border-gray-200 bg-white p-1 mb-5">
                     <Pressable
                        onPress={() => setMobileTab("lists")}
                        className={`flex-1 py-2.5 rounded-xl items-center ${mobileTab === "lists" ? "bg-primary_green" : ""
                           }`}
                     >
                        <Text
                           className={`text-sm font-semibold ${mobileTab === "lists" ? "text-white" : "text-gray-700"
                              }`}
                        >
                           Lists
                        </Text>
                     </Pressable>
                     <Pressable
                        onPress={() => setMobileTab("insights")}
                        className={`flex-1 py-2.5 rounded-xl items-center ${mobileTab === "insights" ? "bg-primary_green" : ""
                           }`}
                     >
                        <Text
                           className={`text-sm font-semibold ${mobileTab === "insights" ? "text-white" : "text-gray-700"
                              }`}
                        >
                           Insights
                        </Text>
                     </Pressable>
                  </View>
               )}

               <View className={`${wide ? "flex-row gap-6 items-start" : ""}`}>
                  <View
                     className={`${wide ? "flex-1 min-w-0" : ""} ${!wide && mobileTab === "insights" ? "hidden" : ""
                        }`}
                  >
                     <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                        Your lists ({lists.length})
                     </Text>
                     {listColumnCount === 1 ? (
                        <View className="gap-4">
                           {sortedLists.map((list) => (
                              <ShoppingListCard
                                 key={list.id}
                                 list={list}
                                 variant="full"
                                 isActive={list.id === activeListId}
                                 isSelected={list.id === effectiveSelectedId}
                                 onPressCard={() => {
                                    setSelectedListId(list.id);
                                    if (!wide) setMobileTab("insights");
                                 }}
                                 onSetActive={() => setActiveList(list.id)}
                                 onEdit={() => openEdit(list)}
                                 onDelete={() => deleteList(list.id)}
                              />
                           ))}
                        </View>
                     ) : (
                        <View className="flex-row items-start gap-4">
                           {masonryColumns.map((column, columnIndex) => (
                              <View key={`column-${columnIndex}`} className="flex-1 gap-4">
                                 {column.map((list) => (
                                    <ShoppingListCard
                                       key={list.id}
                                       list={list}
                                       variant="full"
                                       isActive={list.id === activeListId}
                                       isSelected={list.id === effectiveSelectedId}
                                       onPressCard={() => {
                                          setSelectedListId(list.id);
                                          if (!wide) setMobileTab("insights");
                                       }}
                                       onSetActive={() => setActiveList(list.id)}
                                       onEdit={() => openEdit(list)}
                                       onDelete={() => deleteList(list.id)}
                                    />
                                 ))}
                              </View>
                           ))}
                        </View>
                     )}
                  </View>

                  {wide ? (
                     <View className="w-[300px] shrink-0">
                        <ListAnalyticsPanel list={selectedList} />
                     </View>
                  ) : (
                     mobileTab === "insights" && (
                        <View className="mt-2">
                           <ListAnalyticsPanel list={selectedList} />
                        </View>
                     )
                  )}
               </View>
            </View>

            <View className="mt-12">
               <FooterSection disableEdgeOffset />
            </View>
         </ScrollView>

         <EditShoppingListModal
            visible={modalOpen}
            onClose={() => setModalOpen(false)}
            editingList={editingList}
            onSave={handleSaveModal}
         />
      </View>
   );
}
