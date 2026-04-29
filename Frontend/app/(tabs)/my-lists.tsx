import React, { useEffect, useMemo, useState } from "react";
import { View, ScrollView, useWindowDimensions } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useShoppingLists } from "./ShoppingListsContext";
import EditShoppingListModal from "../../components/my-lists/EditShoppingListModal";
import MyListsHeroSection from "../../components/my-lists/MyListsHeroSection";
import MyListsListsSection from "../../components/my-lists/MyListsListsSection";
import MyListsBottomComparisonSections from "../../components/my-lists/MyListsBottomComparisonSections";
import MyListsSelectedListDetailsSection from "../../components/my-lists/MyListsSelectedListDetailsSection";
import FooterSection from "../../components/home/FooterSection";
import type { ShoppingList } from "../../types/ShoppingList";

export default function MyListsScreen() {
   const { width } = useWindowDimensions();
   const { listId, create } = useLocalSearchParams<{ listId?: string; create?: string }>();
   const wide = width >= 900;

   const {
      lists,
      activeListId,
      isLoading,
      setActiveList,
      createList,
      updateList,
      deleteList,
      refreshLists,
   } = useShoppingLists();

   const [selectedListId, setSelectedListId] = useState<string | null>(null);
   const [recentCreatedListId, setRecentCreatedListId] = useState<string | null>(null);
   const [modalOpen, setModalOpen] = useState(false);
   const [editingList, setEditingList] = useState<ShoppingList | null>(null);

   const effectiveSelectedId = selectedListId ?? activeListId;
   const selectedList = useMemo(
      () => lists.find((list) => list.id === effectiveSelectedId) ?? null,
      [lists, effectiveSelectedId]
   );
   const showInitialLoading = isLoading && lists.length === 0;

   const sortedLists = useMemo(
      () =>
         [...lists].sort((a, b) => {
            if (a.id === activeListId) return -1;
            if (b.id === activeListId) return 1;
            if (recentCreatedListId) {
               if (a.id === recentCreatedListId) return -1;
               if (b.id === recentCreatedListId) return 1;
            }
            return a.name.localeCompare(b.name);
         }),
      [lists, activeListId, recentCreatedListId]
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

   useEffect(() => {
      refreshLists();
   }, [refreshLists]);

   useEffect(() => {
      if (!listId) return;
      const requestedListId = Array.isArray(listId) ? listId[0] : listId;
      if (!requestedListId) return;
      if (!lists.some((list) => list.id === requestedListId)) return;
      setSelectedListId(requestedListId);
   }, [listId, lists]);

   useEffect(() => {
      if (create !== "1") return;
      setEditingList(null);
      setModalOpen(true);
   }, [create]);

   const handleSaveModal = async (payload: {
      name: string;
      description: string;
      accent: ShoppingList["accent"];
   }) => {
      if (editingList) {
         updateList(editingList.id, payload);
         setRecentCreatedListId(null);
      } else {
         try {
            const createdList = await createList(payload);
            setRecentCreatedListId(createdList.id);
            setSelectedListId(createdList.id);
         } catch (error) {
            console.error("Failed to create shopping list:", error);
         }
      }
   };

   const handleDeleteList = (id: string) => {
      deleteList(id);
      setSelectedListId((current) => (current === id ? null : current));
      setRecentCreatedListId((current) => (current === id ? null : current));
      setEditingList((current) => (current?.id === id ? null : current));
   };

   return (
      <View className="flex-1 bg-[#F9FAFB]">
         <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingBottom: 0 }}
            nestedScrollEnabled
         >
            <MyListsHeroSection onCreate={openCreate} />

            <View className={wide ? "md:pr-8" : "px-4 md:px-8 pt-6"}>
               <View className={`${wide ? "flex-row items-start gap-6" : ""}`}>
                  <MyListsListsSection
                     lists={sortedLists}
                     masonryColumns={masonryColumns}
                     listColumnCount={listColumnCount}
                     activeListId={activeListId}
                     effectiveSelectedId={effectiveSelectedId}
                     wide={wide}
                     show
                     forceSingleColumn={wide}
                     containerClassName={
                        wide
                           ? "w-[260px] shrink-0 bg-white border-r border-gray-100 shadow-sm p-4 sticky top-0 h-[calc(100vh-64px)] overflow-y-auto"
                           : ""
                     }
                     cardVariant={wide ? "compact" : "full"}
                     hideManageActions={wide}
                     isLoading={showInitialLoading}
                     onSelectList={setSelectedListId}
                     onSetActiveList={setActiveList}
                     onEditList={openEdit}
                     onDeleteList={handleDeleteList}
                  />
                  {wide ? (
                     <View className="flex-1 min-w-0">
                        <View className="px-4 md:px-8">
                           {showInitialLoading ? (
                              <ListDetailsSkeleton />
                           ) : (
                              <MyListsSelectedListDetailsSection
                                 list={selectedList}
                                 isActive={selectedList?.id === activeListId}
                                 onEdit={() => {
                                    if (selectedList) openEdit(selectedList);
                                 }}
                                 onDelete={() => {
                                    if (selectedList) handleDeleteList(selectedList.id);
                                 }}
                                 onSetActive={() => {
                                    if (selectedList) setActiveList(selectedList.id);
                                 }}
                              />
                           )}
                        </View>
                        {showInitialLoading ? <ComparisonSkeleton /> : <MyListsBottomComparisonSections selectedList={selectedList} />}
                     </View>
                  ) : null}
               </View>
            </View>

            {!wide ? (
               <>
                  <View className="px-4 md:px-8 pt-6">
                     {showInitialLoading ? (
                        <ListDetailsSkeleton />
                     ) : (
                        <MyListsSelectedListDetailsSection
                           list={selectedList}
                           isActive={selectedList?.id === activeListId}
                           onEdit={() => {
                              if (selectedList) openEdit(selectedList);
                           }}
                           onDelete={() => {
                              if (selectedList) handleDeleteList(selectedList.id);
                           }}
                           onSetActive={() => {
                              if (selectedList) setActiveList(selectedList.id);
                           }}
                        />
                     )}
                  </View>
                  {showInitialLoading ? <ComparisonSkeleton /> : <MyListsBottomComparisonSections selectedList={selectedList} />}
               </>
            ) : null}

            <View>
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

function ListDetailsSkeleton() {
   return (
      <View className="bg-white rounded-3xl border border-gray-200 px-6 py-8 shadow-sm mt-8 mb-2">
         <View className="flex-row items-start justify-between mb-6">
            <View className="h-8 rounded-full bg-gray-200 w-1/3" />
            <View className="h-10 rounded-xl bg-gray-100 w-32" />
         </View>
         <View className="h-4 rounded-full bg-gray-100 w-2/3 mb-6" />
         <View className="flex-row flex-wrap gap-3 mb-6">
            {[0, 1, 2].map((index) => (
               <View
                  key={`metric-skeleton-${index}`}
                  className="min-w-[170px] flex-1 h-20 rounded-2xl bg-gray-100"
               />
            ))}
         </View>
         <View className="flex-row gap-10">
            <View className="flex-1 gap-3">
               {[0, 1, 2, 3].map((index) => (
                  <View key={`item-skeleton-${index}`} className="h-14 rounded-xl bg-gray-100" />
               ))}
            </View>
            <View className="w-[320px] gap-3">
               <View className="h-7 rounded-full bg-gray-200 w-3/4" />
               {[0, 1, 2].map((index) => (
                  <View key={`category-skeleton-${index}`}>
                     <View className="h-4 rounded-full bg-gray-100 w-2/3 mb-2" />
                     <View className="h-3 rounded-full bg-gray-100 w-full" />
                  </View>
               ))}
               <View className="h-40 rounded-2xl bg-gray-100 mt-4" />
            </View>
         </View>
      </View>
   );
}

function ComparisonSkeleton() {
   return (
      <View className="px-4 md:px-8 py-10 bg-[#F9FAFB]">
         <View className="h-8 rounded-full bg-gray-200 w-1/3 mb-3" />
         <View className="h-4 rounded-full bg-gray-100 w-1/2 mb-8" />
         <View className="flex-row gap-6">
            <View className="flex-[2] h-80 rounded-3xl bg-white border border-gray-200 p-6">
               <View className="h-6 rounded-full bg-gray-200 w-1/3 mb-6" />
               <View className="gap-4">
                  {[0, 1, 2, 3].map((index) => (
                     <View key={`comparison-list-skeleton-${index}`} className="h-14 rounded-xl bg-gray-100" />
                  ))}
               </View>
            </View>
            <View className="flex-1 h-80 rounded-3xl bg-white border border-gray-200 p-6">
               <View className="h-6 rounded-full bg-gray-200 w-1/2 mb-6" />
               <View className="gap-4">
                  {[0, 1, 2].map((index) => (
                     <View key={`store-total-skeleton-${index}`} className="h-20 rounded-2xl bg-gray-100" />
                  ))}
               </View>
            </View>
         </View>
      </View>
   );
}
