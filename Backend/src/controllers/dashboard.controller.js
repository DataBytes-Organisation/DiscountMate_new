const { ObjectId } = require('mongodb');
const { connectToMongoDB } = require('../config/database');
const {
   DASHBOARD_RETAILERS,
   buildOwnershipFilter,
   getSavedListsForUser,
   getSavedListById,
   formatSavedListSummary,
   calculateListPricingSnapshot,
   normalizeDashboardRetailer,
} = require('../utils/savedLists');

const RANGE_CONFIG = {
   '30d': { key: '30d', days: 30, label: '30 Days' },
   '90d': { key: '90d', days: 90, label: '3 Months' },
   '1y': { key: '1y', days: 365, label: 'This Year' },
};

const TREND_LABELS = {
   '30d': ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
   '90d': ['Month 1', 'Month 2', 'Month 3'],
   '1y': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

const SNAPSHOT_SORT = { createdAt: -1, created_at: -1, _id: -1 };

function getMembershipLabel(plan) {
   switch (String(plan || '').toLowerCase()) {
      case 'premium':
         return 'Premium Member';
      case 'family':
         return 'Family Plan';
      default:
         return 'Free Plan';
   }
}

function calculateProfileCompletion(user) {
   const fields = [
      user?.user_fname,
      user?.user_lname,
      user?.email,
      user?.phone_number,
      user?.address,
      user?.profile_image?.content ? 'image' : null,
   ];

   const complete = fields.filter((value) => {
      if (typeof value === 'string') {
         return value.trim().length > 0;
      }
      return Boolean(value);
   }).length;

   return Math.round((complete / fields.length) * 100);
}

function resolveRange(rangeKey) {
   return RANGE_CONFIG[rangeKey] || RANGE_CONFIG['1y'];
}

function buildRangeWindow(rangeKey) {
   const resolved = resolveRange(rangeKey);
   const endDate = new Date();
   const startDate = new Date(endDate);
   startDate.setDate(startDate.getDate() - (resolved.days - 1));

   return {
      ...resolved,
      startDate,
      endDate,
   };
}

function getTrendLabels(rangeKey) {
   return [...(TREND_LABELS[rangeKey] || TREND_LABELS['1y'])];
}

function buildEmptyTrend(rangeWindow) {
   return {
      labels: getTrendLabels(rangeWindow.key),
      spent: [],
      saved: [],
   };
}

function getSnapshotDate(snapshot) {
   const rawDate = snapshot?.createdAt || snapshot?.created_at;
   if (!rawDate) {
      return null;
   }

   const parsedDate = new Date(rawDate);
   return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function buildTrend(snapshots, rangeWindow) {
   const rangeKey = rangeWindow.key;
   const bucketCount = rangeKey === '30d' ? 4 : rangeKey === '90d' ? 3 : 12;
   const spentBuckets = Array.from({ length: bucketCount }, () => 0);
   const savedBuckets = Array.from({ length: bucketCount }, () => 0);
   const labels = getTrendLabels(rangeKey);

   snapshots.forEach((snapshot) => {
      const recordDate = getSnapshotDate(snapshot);

      if (!recordDate) {
         return;
      }

      const spent = Number(snapshot?.selected_total || 0);
      const saved = Number(snapshot?.total_saved || 0);

      let bucketIndex = 0;
      if (rangeKey === '1y') {
         bucketIndex = recordDate.getMonth();
      } else {
         const daysFromStart = Math.max(
            0,
            Math.floor((recordDate.getTime() - rangeWindow.startDate.getTime()) / (1000 * 60 * 60 * 24))
         );
         const bucketSize = rangeKey === '90d' ? 30 : 7;
         const maxBucket = rangeKey === '90d' ? 2 : 3;
         bucketIndex = Math.min(maxBucket, Math.floor(daysFromStart / bucketSize));
      }

      spentBuckets[bucketIndex] += spent;
      savedBuckets[bucketIndex] += saved;
   });

   return {
      labels,
      spent: spentBuckets.map((value) => Number(value.toFixed(2))),
      saved: savedBuckets.map((value) => Number(value.toFixed(2))),
   };
}

function formatSnapshotRow(snapshot) {
   const snapshotDate = getSnapshotDate(snapshot);

   return {
      id: String(snapshot?._id || ''),
      date: snapshotDate
         ? snapshotDate.toLocaleDateString('en-AU', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
           })
         : 'Unknown date',
      listName: String(snapshot?.saved_list_name || 'Saved List'),
      selectedRetailer:
         DASHBOARD_RETAILERS[snapshot?.selected_retailer] || snapshot?.selected_retailer || 'Unknown',
      selectedTotal: Number(snapshot?.selected_total || 0),
      totalSaved: Number(snapshot?.total_saved || 0),
   };
}

function getSelectedDashboardTarget(user, savedLists = []) {
   const dashboardPreferences = user?.dashboard_preferences || {};
   const preferredListId = String(
      dashboardPreferences.selected_dashboard_list_id || ''
   ).trim();
   const firstAvailableListId = savedLists[0]?._id ? String(savedLists[0]._id) : '';
   const preferredListExists = savedLists.some(
      (list) => String(list?._id || '') === preferredListId
   );

   return {
      selectedListId: preferredListExists ? preferredListId : firstAvailableListId,
      selectedRetailer:
         normalizeDashboardRetailer(
            dashboardPreferences.selected_dashboard_retailer
         ) || 'coles',
   };
}

function formatSubscriptionPlan(plan) {
   const normalizedPlan = String(plan || 'free').trim().toLowerCase() || 'free';
   return normalizedPlan.charAt(0).toUpperCase() + normalizedPlan.slice(1);
}

function buildSnapshotFilters(ownershipFilter, selectedList, selectedRetailer) {
   return [
      ownershipFilter,
      { saved_list_id: String(selectedList._id) },
      { selected_retailer: selectedRetailer },
   ];
}

function buildLiveSnapshot(selectedList, pricingSummary) {
   if (!selectedList || !pricingSummary || pricingSummary.error) {
      return null;
   }

   const now = new Date();
   return {
      _id: `live-${String(selectedList._id)}`,
      saved_list_id: String(selectedList._id),
      saved_list_name: selectedList.name || 'Saved List',
      selected_retailer: pricingSummary.selectedRetailer,
      retailer_totals: pricingSummary.retailerTotals,
      cheapest_retailer: pricingSummary.cheapestRetailer,
      cheapest_total: pricingSummary.cheapestTotal,
      selected_total: pricingSummary.selectedTotal,
      total_saved: pricingSummary.totalSaved,
      savings_rate: pricingSummary.savingsRate,
      item_count: pricingSummary.itemCount,
      createdAt: now,
      updatedAt: now,
      source: 'live_list_pricing',
   };
}

function mergeLiveSnapshot(rangeSnapshots, liveSnapshot) {
   if (!liveSnapshot) {
      return rangeSnapshots;
   }

   return [
      liveSnapshot,
      ...rangeSnapshots.filter((snapshot) => String(snapshot?._id || '') !== String(liveSnapshot._id)),
   ];
}

function buildSnapshotRangeFilter(rangeWindow) {
   return {
      $or: [
         {
            createdAt: {
               $gte: rangeWindow.startDate,
               $lte: rangeWindow.endDate,
            },
         },
         {
            created_at: {
               $gte: rangeWindow.startDate,
               $lte: rangeWindow.endDate,
            },
         },
      ],
   };
}

async function getSavedListsForDashboard(db, user, email) {
   // V1 bridge: reuse the current basket-backed saved list until the list backend v2 lands.
   return getSavedListsForUser(db, user, email);
}

async function getDashboardCounters(db, ownershipFilter) {
   const [unreadNotifications, activeAlerts] = await Promise.all([
      db.collection('notifications').countDocuments({
         $and: [ownershipFilter, { read: { $ne: true } }],
      }),
      db.collection('alert_segments').countDocuments({
         $and: [ownershipFilter, { active: { $ne: false } }],
      }),
   ]);

   return {
      unreadNotifications,
      activeAlerts,
   };
}

async function getSnapshotState(db, user, email, ownershipFilter, dashboardTarget, rangeWindow) {
   const { selectedListId, selectedRetailer } = dashboardTarget;

   if (!selectedListId || !ObjectId.isValid(selectedListId)) {
      return {
         selectedList: null,
         latestSnapshot: null,
         rangeSnapshots: [],
      };
   }

   const selectedList = await getSavedListById(db, user, email, selectedListId);
   if (!selectedList) {
      return {
         selectedList: null,
         latestSnapshot: null,
         rangeSnapshots: [],
      };
   }

   const snapshotFilters = buildSnapshotFilters(
      ownershipFilter,
      selectedList,
      selectedRetailer
   );

   const [latestSnapshot, rangeSnapshots] = await Promise.all([
      db
         .collection('list_pricing_snapshots')
         .find({ $and: snapshotFilters })
         .sort(SNAPSHOT_SORT)
         .limit(1)
         .next(),
      db
         .collection('list_pricing_snapshots')
         .find({
            $and: [
               ...snapshotFilters,
               buildSnapshotRangeFilter(rangeWindow),
            ],
         })
         .sort(SNAPSHOT_SORT)
         .toArray(),
   ]);
   const pricingSummary = await calculateListPricingSnapshot(
      db,
      selectedList,
      selectedRetailer
   );
   const liveSnapshot = buildLiveSnapshot(selectedList, pricingSummary);

   return {
      selectedList,
      latestSnapshot: liveSnapshot || latestSnapshot,
      rangeSnapshots: mergeLiveSnapshot(rangeSnapshots, liveSnapshot),
   };
}

function buildDashboardResponse({
   user,
   rangeWindow,
   dashboardTarget,
   savedLists,
   counters,
   selectedList,
   latestSnapshot,
   rangeSnapshots,
}) {
   const historicalDataAvailable = rangeSnapshots.length > 0;
   const subscriptionPlan = user?.subscription?.plan || user?.subscriptionPlan || 'free';
   const selectedRetailer =
      normalizeDashboardRetailer(latestSnapshot?.selected_retailer) ||
      dashboardTarget.selectedRetailer;
   const reportUpdatedAt =
      latestSnapshot?.createdAt ||
      latestSnapshot?.created_at ||
      selectedList?.updatedAt ||
      selectedList?.createdAt ||
      null;

   return {
      user: {
         displayName:
            `${user.user_fname || ''} ${user.user_lname || ''}`.trim() || 'Guest',
         email: user.email || '',
         membershipLabel: getMembershipLabel(subscriptionPlan),
         profileCompletion: calculateProfileCompletion(user),
      },
      range: {
         key: rangeWindow.key,
         label: rangeWindow.label,
         startDate: rangeWindow.startDate.toISOString(),
         endDate: rangeWindow.endDate.toISOString(),
         historicalDataAvailable,
      },
      selectedList: selectedList
         ? {
              ...formatSavedListSummary(selectedList),
              selectedRetailer,
              lastPricedAt: latestSnapshot?.createdAt || latestSnapshot?.created_at || null,
           }
         : null,
      metrics: {
         totalSpent: Number(latestSnapshot?.selected_total || 0),
         totalSaved: Number(latestSnapshot?.total_saved || 0),
         savingsRate: Number(latestSnapshot?.savings_rate || 0),
         activeAlerts: counters.activeAlerts,
         unreadNotifications: counters.unreadNotifications,
         shoppingLists: savedLists.length,
      },
      trend: historicalDataAvailable
         ? buildTrend(rangeSnapshots, rangeWindow)
         : buildEmptyTrend(rangeWindow),
      recentSnapshots: rangeSnapshots.slice(0, 8).map(formatSnapshotRow),
      highlights: {
         subscriptionPlan: formatSubscriptionPlan(subscriptionPlan),
         reportUpdatedAt,
      },
   };
}

async function getDashboardSummary(req, res) {
   try {
      const email = req.user?.email;
      if (!email) {
         return res.status(401).json({ message: 'Unauthorized' });
      }

      const rangeKey = typeof req.query?.range === 'string' ? req.query.range : '1y';
      const rangeWindow = buildRangeWindow(rangeKey);
      const db = await connectToMongoDB();
      const user = await db
         .collection('users')
         .findOne({ email }, { projection: { encrypted_password: 0 } });

      if (!user) {
         return res.status(404).json({ message: 'User not found' });
      }

      const ownershipFilter = buildOwnershipFilter(user, email);
      const [savedLists, counters] = await Promise.all([
         getSavedListsForDashboard(db, user, email),
         getDashboardCounters(db, ownershipFilter),
      ]);
      const dashboardTarget = getSelectedDashboardTarget(user, savedLists);
      const snapshotState = await getSnapshotState(
         db,
         user,
         email,
         ownershipFilter,
         dashboardTarget,
         rangeWindow
      );

      return res.status(200).json(
         buildDashboardResponse({
            user,
            rangeWindow,
            dashboardTarget,
            savedLists,
            counters,
            ...snapshotState,
         })
      );
   } catch (error) {
      console.error('Error fetching dashboard summary:', error);
      return res.status(500).json({ message: 'Failed to load dashboard summary' });
   }
}

module.exports = {
   getDashboardSummary,
};
