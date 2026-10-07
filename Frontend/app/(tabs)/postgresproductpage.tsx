import React, {useEffect, useMemo, useState} from "react";
import {ActivityIndicator,Text,View} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { API_URL } from "@/constants/Api";
import HomeMainSection from "../../components/home/HomeMainSection";
import FooterSection from "../../components/home/FooterSection";
import NotFoundScreen from "../+not-found";

type CatalogueGateState =
    | "checking"
    | "available"
    | "not-found";

type PostgresStatusResponse = {
    enabled?: boolean;
    available?: boolean;
};

export default function PostgresProductPage() {
    const { categoryId } = useLocalSearchParams<{
        categoryId?: string | string[];
    }>();

    const [gateState, setGateState] =
        useState<CatalogueGateState>("checking");

    const activeCategory = useMemo(() => {
        if (Array.isArray(categoryId)) {
            return categoryId[0] || "All";
        }

        return categoryId || "All";
    }, [categoryId]);

    useEffect(() => {
        const controller = new AbortController();

        async function checkPostgresCatalogue() {
            try {
                const response = await fetch(
                    `${API_URL}/postgres/status`,
                    {
                        signal: controller.signal,
                    }
                );

                if (!response.ok) {
                    throw new Error(
                        `PostgreSQL status request failed: ${response.status}`
                    );
                }

                const status =
                    (await response.json()) as PostgresStatusResponse;

                if (controller.signal.aborted) {
                    return;
                }

                const canUseCatalogue =
                    status.enabled === true &&
                    status.available === true;

                setGateState(
                    canUseCatalogue
                        ? "available"
                        : "not-found"
                );
            } catch (error) {
                if (
                    error instanceof Error &&
                    error.name === "AbortError"
                ) {
                    return;
                }

                /*
                 * Fail closed: if capability cannot be confirmed,
                 * do not expose the PostgreSQL catalogue page.
                 */
                if (!controller.signal.aborted) {
                    setGateState("not-found");
                }
            }
        }
        checkPostgresCatalogue();
        return () => controller.abort();
    }, []);

    if (gateState === "checking") {
        return (
            <View className="flex-1 bg-[#F9FAFB] items-center justify-center py-20">
                <ActivityIndicator
                    size="large"
                    color="#10B981"
                />

                <Text className="text-gray-500 mt-4">
                    Loading catalogue...
                </Text>
            </View>
        );
    }
    if (gateState === "not-found") {
        return <NotFoundScreen />;
    }
    return (
        <View className="flex-1 bg-[#F9FAFB]">
            <HomeMainSection
                source="postgres"
                activeCategory={activeCategory}
            />

            <FooterSection />
        </View>
    );
}