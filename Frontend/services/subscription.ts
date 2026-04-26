import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../constants/Api";
import {
   SubscriptionPlan,
   SubscriptionSummary,
} from "../types/Subscription";
import { normalizeApiErrorMessage } from "../utils/authSession";

type SubscriptionPlanResponse = {
   key?: string;
   label?: string;
   price_label?: string;
   price_suffix?: string;
   badge?: string | null;
   current?: boolean;
   features?: string[];
   limits?: {
      price_alerts?: number | null;
      saved_lists?: number | null;
   };
};

type SubscriptionResponse = {
   current_plan?: string;
   current_plan_label?: string;
   current_price_label?: string;
   current_price_suffix?: string;
   plans?: SubscriptionPlanResponse[];
   usage?: {
      price_alerts?: {
         label?: string;
         used?: number;
         limit?: number | null;
      };
      saved_lists?: {
         label?: string;
         used?: number;
         limit?: number | null;
      };
   };
   message?: string;
};

async function getAuthToken(): Promise<string> {
   const token = await AsyncStorage.getItem("authToken");
   if (!token) {
      throw new Error("You need to log in to manage your subscription.");
   }

   return token;
}

function mapPlan(plan: SubscriptionPlanResponse): SubscriptionPlan {
   return {
      key:
         plan.key === "premium" || plan.key === "family" ? plan.key : "free",
      label: String(plan.label || "Free"),
      priceLabel: String(plan.price_label || "$0"),
      priceSuffix: String(plan.price_suffix || "forever"),
      badge: plan.badge ?? null,
      current: Boolean(plan.current),
      features: Array.isArray(plan.features) ? plan.features : [],
      limits: {
         priceAlerts:
            typeof plan.limits?.price_alerts === "number"
               ? plan.limits.price_alerts
               : null,
         savedLists:
            typeof plan.limits?.saved_lists === "number"
               ? plan.limits.saved_lists
               : null,
      },
   };
}

function mapSubscriptionResponse(data: SubscriptionResponse): SubscriptionSummary {
   return {
      currentPlan:
         data.current_plan === "premium" || data.current_plan === "family"
            ? data.current_plan
            : "free",
      currentPlanLabel: String(data.current_plan_label || "Free"),
      currentPriceLabel: String(data.current_price_label || "$0"),
      currentPriceSuffix: String(data.current_price_suffix || "forever"),
      plans: Array.isArray(data.plans) ? data.plans.map(mapPlan) : [],
      usage: {
         priceAlerts: {
            label: String(data.usage?.price_alerts?.label || "Price Alerts"),
            used: Number(data.usage?.price_alerts?.used || 0),
            limit:
               typeof data.usage?.price_alerts?.limit === "number"
                  ? data.usage.price_alerts.limit
                  : null,
         },
         savedLists: {
            label: String(data.usage?.saved_lists?.label || "Saved Lists"),
            used: Number(data.usage?.saved_lists?.used || 0),
            limit:
               typeof data.usage?.saved_lists?.limit === "number"
                  ? data.usage.saved_lists.limit
                  : null,
         },
      },
   };
}

export async function fetchSubscription(): Promise<SubscriptionSummary> {
   const token = await getAuthToken();
   const response = await fetch(`${API_URL}/users/subscription`, {
      headers: {
         Authorization: `Bearer ${token}`,
      },
   });

   const data: SubscriptionResponse = await response.json();
   if (!response.ok) {
      throw new Error(
         await normalizeApiErrorMessage(
            data?.message,
            "Unable to load subscription."
         )
      );
   }

   return mapSubscriptionResponse(data);
}

export async function updateSubscription(
   plan: "free" | "premium" | "family"
): Promise<SubscriptionSummary> {
   const token = await getAuthToken();
   const response = await fetch(`${API_URL}/users/subscription`, {
      method: "PUT",
      headers: {
         "Content-Type": "application/json",
         Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ plan }),
   });

   const data: SubscriptionResponse = await response.json();
   if (!response.ok) {
      throw new Error(
         await normalizeApiErrorMessage(
            data?.message,
            "Unable to update subscription."
         )
      );
   }

   return mapSubscriptionResponse(data);
}
