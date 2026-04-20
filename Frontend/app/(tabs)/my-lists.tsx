import React, { useMemo, useState } from "react";
import { View, ScrollView, useWindowDimensions } from "react-native";
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
   const wide = width >= 900;

   const {
      lists,
      activeListId,
      setActiveList,
      createList,
      updateList,
      deleteList,
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

   const handleSaveModal = (payload: {
      name: string;
      description: string;
      accent: ShoppingList["accent"];
   }) => {
      if (editingList) {
         updateList(editingList.id, payload);
         setRecentCreatedListId(null);
      } else {
         const createdList = createList(payload);
         setRecentCreatedListId(createdList.id);
         setSelectedListId(createdList.id);
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
               <View className={`${wide ? "flex-row items-stretch gap-6" : ""}`}>
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
                           ? "w-[260px] shrink-0 bg-white border-r border-gray-100 shadow-sm p-4"
                           : ""
                     }
                     cardVariant={wide ? "compact" : "full"}
                     hideManageActions={wide}
                     onSelectList={setSelectedListId}
                     onSetActiveList={setActiveList}
                     onEditList={openEdit}
                     onDeleteList={handleDeleteList}
                  />
                  {wide ? (
                     <View className="flex-1 min-w-0">
                        <View className="px-4 md:px-8">
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
                        </View>
                        <MyListsBottomComparisonSections selectedList={selectedList} />
                     </View>
                  ) : null}
               </View>
            </View>

            {!wide ? (
               <>
                  <View className="px-4 md:px-8 pt-6">
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
                  </View>
                  <MyListsBottomComparisonSections selectedList={selectedList} />
               </>
            ) : null}

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
