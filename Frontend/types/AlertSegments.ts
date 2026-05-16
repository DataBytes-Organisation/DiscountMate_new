export type AlertSegment = {
   categoryKey: string;
   categoryLabel: string;
   active: boolean;
   triggeredCount: number;
};

export type AlertSegmentsSummary = {
   totalCategories: number;
   activeCategories: number;
   triggeredCategories: number;
};

export type AlertSegmentsResponse = {
   summary: AlertSegmentsSummary;
   segments: AlertSegment[];
};
