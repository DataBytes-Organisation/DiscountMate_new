export type UserProfile = {
   firstName?: string;
   lastName?: string;
   email?: string;
   emailVerified?: boolean;
   phoneNumber?: string;
   phoneVerified?: boolean;
   address?: string;
   postcode?: string;
   memberSince?: string;
   subscriptionPlan?: string;
   profileImage?: string | null;
   totalSaved?: number;
   shoppingTrips?: number;
   activeAlerts?: number;
   shoppingLists?: number;
};
