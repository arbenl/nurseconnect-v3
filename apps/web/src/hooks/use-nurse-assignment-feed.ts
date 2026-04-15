import { useQuery } from "@tanstack/react-query";

type NurseAssignment = {
  id: string;
  address: string;
  status: string;
  createdAt: string;
  requestType: string;
  scheduledFor: string | null;
  careType: string | null;
};

type NurseAssignmentFeedResponse = {
  activeAssignment: NurseAssignment | null;
  recentAssignments: NurseAssignment[];
};

const NURSE_ASSIGNMENT_FEED_KEY = ["nurse-assignment-feed"];

async function fetchNurseAssignmentFeed(): Promise<NurseAssignmentFeedResponse> {
  const response = await fetch("/api/requests/assigned", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch nurse assignments");
  }

  return response.json();
}

export function useNurseAssignmentFeed(enabled: boolean) {
  return useQuery({
    queryKey: NURSE_ASSIGNMENT_FEED_KEY,
    queryFn: fetchNurseAssignmentFeed,
    enabled,
    staleTime: 3_000,
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.activeAssignment ? 3_000 : false;
    },
  });
}

export type { NurseAssignment, NurseAssignmentFeedResponse };
