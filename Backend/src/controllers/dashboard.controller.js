const { ObjectId } = require('mongodb');
const { connectToMongoDB } = require('../config/database');
const {
   DASHBOARD_RETAILERS,
   DASHBOARD_COMPARISON_STATUS,
   applyOwnershipFields,
   buildOwnershipFilter,
   getSavedListsForUser,
   getSavedListById,
   getShoppingListTotal,
   formatSavedListSummary,
   calculateListPricingSnapshot,
   formatSnapshotResponse,
   inferSnapshotComparisonStatus,
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

function getSnapshotListId(snapshot) {
   return String(
      snapshot?.shopping_list_id ||
         snapshot?.saved_list_id ||
         snapshot?.savedListId ||
         snapshot?._id ||
         ''
   );
}

function isComparableSnapshot(snapshot) {
   return (
      inferSnapshotComparisonStatus(snapshot) === DASHBOARD_COMPARISON_STATUS.comparable
   );
}

function getSnapshotBucketIndex(snapshot, rangeWindow) {
   const recordDate = getSnapshotDate(snapshot);
   if (!recordDate) {
      return null;
   }

   if (rangeWindow.key === '1y') {
      return recordDate.getMonth();
   }

   const daysFromStart = Math.max(
      0,
      Math.floor(
         (recordDate.getTime() - rangeWindow.startDate.getTime()) /
            (1000 * 60 * 60 * 24)
      )
   );
   const bucketSize = rangeWindow.key === '90d' ? 30 : 7;
   const maxBucket = rangeWindow.key === '90d' ? 2 : 3;
   return Math.min(maxBucket, Math.floor(daysFromStart / bucketSize));
}

function mergeTrendRows(rangeSnapshots, currentListRows, rangeWindow) {
   const persistedKeys = new Set(
      (rangeSnapshots || []).map((snapshot) => {
         const bucketIndex = getSnapshotBucketIndex(snapshot, rangeWindow);
         return `${getSnapshotListId(snapshot)}:${bucketIndex}`;
      })
   );

   const currentRowsWithoutPersistedBucket = (currentListRows || []).filter((row) => {
      const bucketIndex = getSnapshotBucketIndex(row, rangeWindow);
      return !persistedKeys.has(`${getSnapshotListId(row)}:${bucketIndex}`);
   });

   return [...(rangeSnapshots || []), ...currentRowsWithoutPersistedBucket];
}

function buildRecentSnapshotRows(currentListRows, rangeSnapshots) {
   const latestRowsByList = new Map();

   (rangeSnapshots || []).forEach((snapshot) => {
      const listId = getSnapshotListId(snapshot);
      if (listId && !latestRowsByList.has(listId)) {
         latestRowsByList.set(listId, snapshot);
      }
   });

   (currentListRows || []).forEach((snapshot) => {
      const listId = getSnapshotListId(snapshot);
      if (listId && !latestRowsByList.has(listId)) {
         latestRowsByList.set(listId, snapshot);
      }
   });

   return Array.from(latestRowsByList.values()).slice(0, 8);
}

function buildTrend(snapshots, rangeWindow) {
   const rangeKey = rangeWindow.key;
   const bucketCount = rangeKey === '30d' ? 4 : rangeKey === '90d' ? 3 : 12;
   const bucketSnapshotsByList = Array.from({ length: bucketCount }, () => new Map());
   const labels = getTrendLabels(rangeKey);

   snapshots.forEach((snapshot) => {
      const recordDate = getSnapshotDate(snapshot);

      if (!recordDate) {
         return;
      }

      const spent = Number(snapshot?.selected_total || 0);
      const saved = isComparableSnapshot(snapshot)
         ? Number(snapshot?.total_saved || 0)
         : 0;

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

      const listKey = String(
         snapshot?.shopping_list_id ||
            snapshot?.saved_list_id ||
            snapshot?._id ||
            `snapshot-${bucketIndex}`
      );
      const existing = bucketSnapshotsByList[bucketIndex].get(listKey);
      const existingDate = existing ? getSnapshotDate(existing.snapshot) : null;

      if (!existing || !existingDate || recordDate >= existingDate) {
         bucketSnapshotsByList[bucketIndex].set(listKey, {
            snapshot,
            spent,
            saved,
         });
      }
   });

   const spentBuckets = bucketSnapshotsByList.map((bucket) =>
      Array.from(bucket.values()).reduce((sum, item) => sum + item.spent, 0)
   );
   const savedBuckets = bucketSnapshotsByList.map((bucket) =>
      Array.from(bucket.values()).reduce((sum, item) => sum + item.saved, 0)
   );

   return {
      labels,
      spent: spentBuckets.map((value) => Number(value.toFixed(2))),
      saved: savedBuckets.map((value) => Number(value.toFixed(2))),
   };
}

function formatSnapshotRow(snapshot) {
   const snapshotDate = getSnapshotDate(snapshot);
   const comparisonStatus = inferSnapshotComparisonStatus(snapshot);
   const retailerTotals = snapshot?.retailer_totals || {};
   const cheapestRetailerKey = snapshot?.cheapest_retailer || null;
   const highestRetailerKey = snapshot?.highest_retailer || null;
   const cheapestRetailer =
      comparisonStatus === DASHBOARD_COMPARISON_STATUS.comparable
         ? DASHBOARD_RETAILERS[cheapestRetailerKey] ||
           cheapestRetailerKey ||
           null
         : null;
   const highestRetailer =
      comparisonStatus === DASHBOARD_COMPARISON_STATUS.comparable
         ? DASHBOARD_RETAILERS[highestRetailerKey] ||
           highestRetailerKey ||
           null
         : null;
   const availableRetailers = Array.isArray(snapshot?.available_retailers)
      ? snapshot.available_retailers.map((value) => String(value))
      : Object.keys(snapshot?.retailer_totals || {});

   return {
      id: String(snapshot?._id || ''),
      date: snapshotDate
         ? snapshotDate.toLocaleDateString('en-AU', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
           })
         : 'Unknown date',
      listName: String(snapshot?.shopping_list_name || snapshot?.saved_list_name || 'Saved List'),
      selectedRetailer:
         DASHBOARD_RETAILERS[snapshot?.selected_retailer] || snapshot?.selected_retailer || 'Unknown',
      comparisonStatus,
      comparableRetailerCount: Number(
         snapshot?.comparable_retailer_count || availableRetailers.length || 0
      ),
      availableRetailers,
      comparisonLabel:
         comparisonStatus === DASHBOARD_COMPARISON_STATUS.comparable
            ? snapshot?.comparison_label || 'Cheapest vs highest retailer'
            : 'Comparison unavailable',
      cheapestRetailer,
      cheapestTotal:
         comparisonStatus === DASHBOARD_COMPARISON_STATUS.comparable
            ? Number(
                 snapshot?.cheapest_total ||
                    retailerTotals[cheapestRetailerKey] ||
                    0
              )
            : 0,
      highestRetailer,
      highestTotal:
         comparisonStatus === DASHBOARD_COMPARISON_STATUS.comparable
            ? Number(
                 snapshot?.highest_total ||
                    retailerTotals[highestRetailerKey] ||
                    0
              )
            : 0,
      selectedTotal: Number(snapshot?.selected_total || 0),
      totalSaved:
         comparisonStatus === DASHBOARD_COMPARISON_STATUS.comparable
            ? Number(
                 snapshot?.total_saved ||
                    Math.max(
                       0,
                       Number(
                          snapshot?.highest_total ||
                             retailerTotals[highestRetailerKey] ||
                             0
                       ) -
                          Number(
                             snapshot?.cheapest_total ||
                                retailerTotals[cheapestRetailerKey] ||
                                0
                          )
                    )
              )
            : 0,
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
      {
         $or: [
            { shopping_list_id: String(selectedList._id) },
            { saved_list_id: String(selectedList._id) },
         ],
      },
   ];
}

function buildAllDashboardSnapshotFilters(ownershipFilter) {
   return [
      ownershipFilter,
      {
         $or: [
            {
               source: {
                  $in: ['shopping_list_pricing', 'dashboard_shopping_list_pricing'],
               },
            },
            { shopping_list_id: { $exists: true } },
         ],
      },
   ];
}

function buildLiveSnapshot(selectedList, pricingSummary) {
   if (!selectedList || !pricingSummary) {
      return null;
   }

   const now = new Date();
   return {
      _id: `live-${String(selectedList._id)}`,
      shopping_list_id: String(selectedList._id),
      shopping_list_name: selectedList.list_name || selectedList.name || 'Saved List',
      saved_list_id: String(selectedList._id),
      saved_list_name: selectedList.list_name || selectedList.name || 'Saved List',
      selected_retailer: pricingSummary.selectedRetailer,
      retailer_totals: pricingSummary.retailerTotals,
      comparison_status: pricingSummary.comparisonStatus,
      comparable_retailer_count: pricingSummary.comparableRetailerCount,
      available_retailers: pricingSummary.availableRetailers,
      cheapest_retailer: pricingSummary.cheapestRetailer,
      cheapest_total: pricingSummary.cheapestTotal,
      highest_retailer: pricingSummary.highestRetailer,
      highest_total: pricingSummary.highestTotal,
      selected_total: pricingSummary.selectedTotal,
      total_saved: pricingSummary.totalSaved,
      savings_rate: pricingSummary.savingsRate,
      comparison_label: pricingSummary.comparisonLabel,
      item_count: pricingSummary.itemCount,
      createdAt: now,
      updatedAt: now,
      source: 'live_shopping_list_pricing',
   };
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

async function getCurrentAggregateMetrics(db, savedLists) {
   const totalSpent = savedLists.reduce(
      (sum, list) => sum + getShoppingListTotal(list),
      0
   );

   const pricingSummaries = await Promise.all(
      savedLists.map(async (list) => {
         const listTotal = getShoppingListTotal(list);
         const summary = await calculateListPricingSnapshot(db, list, 'coles');
         return {
            list,
            listTotal,
            summary,
         };
      })
   );

   const totalSaved = pricingSummaries.reduce(
      (sum, item) =>
         sum +
         (item?.summary?.comparisonStatus === DASHBOARD_COMPARISON_STATUS.comparable
            ? Number(item?.summary?.totalSaved || 0)
            : 0),
      0
   );
   const comparisonBaseline = pricingSummaries.reduce(
      (sum, item) =>
         sum +
         (item?.summary?.comparisonStatus === DASHBOARD_COMPARISON_STATUS.comparable
            ? Number(item?.summary?.highestTotal || 0)
            : 0),
      0
   );
   const now = new Date();

   return {
      totalSpent: Number(totalSpent.toFixed(2)),
      totalSaved: Number(totalSaved.toFixed(2)),
      savingsRate:
         comparisonBaseline > 0
            ? Number(((totalSaved / comparisonBaseline) * 100).toFixed(2))
            : 0,
      currentListRows: pricingSummaries.map(({ list, listTotal, summary }) => ({
         _id: `current-list-${String(list._id)}`,
         shopping_list_id: String(list._id),
         shopping_list_name: list.list_name || list.name || 'Shopping List',
         saved_list_id: String(list._id),
         saved_list_name: list.list_name || list.name || 'Shopping List',
         selected_retailer: summary?.selectedRetailer || 'coles',
         retailer_totals: summary?.retailerTotals || {},
         comparison_status:
            summary?.comparisonStatus || DASHBOARD_COMPARISON_STATUS.unpriceable,
         comparable_retailer_count: Number(summary?.comparableRetailerCount || 0),
         available_retailers: summary?.availableRetailers || [],
         cheapest_retailer:
            summary?.comparisonStatus === DASHBOARD_COMPARISON_STATUS.comparable
               ? summary?.cheapestRetailer || null
               : null,
         cheapest_total:
            summary?.comparisonStatus === DASHBOARD_COMPARISON_STATUS.comparable
               ? Number(summary?.cheapestTotal || 0)
               : 0,
         highest_retailer:
            summary?.comparisonStatus === DASHBOARD_COMPARISON_STATUS.comparable
               ? summary?.highestRetailer || null
               : null,
         highest_total:
            summary?.comparisonStatus === DASHBOARD_COMPARISON_STATUS.comparable
               ? Number(summary?.highestTotal || 0)
               : 0,
         selected_total: listTotal,
         total_saved:
            summary?.comparisonStatus === DASHBOARD_COMPARISON_STATUS.comparable
               ? Number(summary?.totalSaved || 0)
               : 0,
         savings_rate:
            summary?.comparisonStatus === DASHBOARD_COMPARISON_STATUS.comparable
               ? Number(summary?.savingsRate || 0)
               : 0,
         comparison_label: summary?.comparisonLabel || 'Comparison unavailable',
         createdAt: now,
         source: 'current_shopping_list',
      })),
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

   const selectedSnapshotFilters = buildSnapshotFilters(
      ownershipFilter,
      selectedList,
      selectedRetailer
   );
   const allSnapshotFilters = buildAllDashboardSnapshotFilters(ownershipFilter);

   const [latestSnapshot, rangeSnapshots] = await Promise.all([
      db
         .collection('list_pricing_snapshots')
         .find({ $and: selectedSnapshotFilters })
         .sort(SNAPSHOT_SORT)
         .limit(1)
         .next(),
      db
         .collection('list_pricing_snapshots')
         .find({
            $and: [
               ...allSnapshotFilters,
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
      rangeSnapshots,
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
   aggregateMetrics,
}) {
   const currentListRows = Array.isArray(aggregateMetrics?.currentListRows)
      ? aggregateMetrics.currentListRows
      : [];
   const trendRows = mergeTrendRows(rangeSnapshots, currentListRows, rangeWindow);
   const historicalDataAvailable = trendRows.length > 0;
   const recentRows = buildRecentSnapshotRows(currentListRows, rangeSnapshots);
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
         totalSpent: Number(aggregateMetrics?.totalSpent || 0),
         totalSaved: Number(aggregateMetrics?.totalSaved || 0),
         savingsRate: Number(aggregateMetrics?.savingsRate || 0),
         activeAlerts: counters.activeAlerts,
         unreadNotifications: counters.unreadNotifications,
         shoppingLists: savedLists.length,
      },
      trend: historicalDataAvailable
         ? buildTrend(trendRows, rangeWindow)
         : buildEmptyTrend(rangeWindow),
      recentSnapshots: recentRows.map(formatSnapshotRow),
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
      const [snapshotState, aggregateMetrics] = await Promise.all([
         getSnapshotState(
            db,
            user,
            email,
            ownershipFilter,
            dashboardTarget,
            rangeWindow
         ),
         getCurrentAggregateMetrics(db, savedLists),
      ]);

      return res.status(200).json(
         buildDashboardResponse({
            user,
            rangeWindow,
            dashboardTarget,
            savedLists,
            counters,
            aggregateMetrics,
            ...snapshotState,
         })
      );
   } catch (error) {
      console.error('Error fetching dashboard summary:', error);
      return res.status(500).json({ message: 'Failed to load dashboard summary' });
   }
}

async function repriceDashboardLists(req, res) {
   try {
      const email = req.user?.email;
      if (!email) {
         return res.status(401).json({ message: 'Unauthorized' });
      }

      const db = await connectToMongoDB();
      const user = await db
         .collection('users')
         .findOne({ email }, { projection: { encrypted_password: 0 } });

      if (!user) {
         return res.status(404).json({ message: 'User not found' });
      }

      const savedLists = await getSavedListsForDashboard(db, user, email);
      if (!savedLists.length) {
         return res.status(409).json({
            message: 'Create a grocery list before refreshing dashboard pricing.',
         });
      }

      const selectedRetailer =
         normalizeDashboardRetailer(req.body?.selectedRetailer) ||
         normalizeDashboardRetailer(user?.dashboard_preferences?.selected_dashboard_retailer) ||
         'coles';
      const now = new Date();
      const normalizedEmail = String(email || '').trim().toLowerCase();
      const snapshotResults = [];
      const skippedLists = [];

      for (const list of savedLists) {
         const pricingSummary = await calculateListPricingSnapshot(
            db,
            list,
            selectedRetailer
         );

         const listName = list.list_name || list.name || 'Shopping List';
         const snapshotDocument = applyOwnershipFields(
            {
               shopping_list_id: String(list._id),
               shopping_list_name: listName,
               saved_list_id: String(list._id),
               saved_list_name: listName,
               selected_retailer: pricingSummary.selectedRetailer,
               retailer_totals: pricingSummary.retailerTotals,
               comparison_status: pricingSummary.comparisonStatus,
               comparable_retailer_count: pricingSummary.comparableRetailerCount,
               available_retailers: pricingSummary.availableRetailers,
               cheapest_retailer: pricingSummary.cheapestRetailer,
               cheapest_total: pricingSummary.cheapestTotal,
               highest_retailer: pricingSummary.highestRetailer,
               highest_total: pricingSummary.highestTotal,
               selected_total: pricingSummary.selectedTotal,
               total_saved: pricingSummary.totalSaved,
               savings_rate: pricingSummary.savingsRate,
               comparison_label: pricingSummary.comparisonLabel,
               item_count: pricingSummary.itemCount,
               source: 'dashboard_shopping_list_pricing',
               createdAt: now,
               updatedAt: now,
            },
            user,
            normalizedEmail
         );

         const insertResult = await db
            .collection('list_pricing_snapshots')
            .insertOne(snapshotDocument);

         snapshotResults.push(
            formatSnapshotResponse({
               ...snapshotDocument,
               _id: insertResult.insertedId,
            })
         );
      }

      const dashboardTarget = getSelectedDashboardTarget(user, savedLists);
      await db.collection('users').updateOne(
         { _id: user._id },
         {
            $set: {
               dashboard_preferences: {
                  selected_dashboard_list_id: dashboardTarget.selectedListId,
                  selected_dashboard_retailer: selectedRetailer,
                  updatedAt: now,
               },
               shoppingLists: savedLists.length,
               updatedAt: now,
            },
         }
      );

      return res.status(200).json({
         message: 'Dashboard grocery list pricing refreshed successfully',
         snapshotsCreated: snapshotResults.length,
         skippedLists,
         snapshots: snapshotResults,
      });
   } catch (error) {
      console.error('Error refreshing dashboard pricing:', error);
      return res.status(500).json({
         message: error.message || 'Failed to refresh dashboard pricing',
      });
   }
}

module.exports = {
   getDashboardSummary,
   repriceDashboardLists,
};
