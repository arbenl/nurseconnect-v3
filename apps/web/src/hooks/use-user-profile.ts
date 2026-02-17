import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { MeResponse } from "@/types/me";

const ME_KEY = ["me"];

async function fetchMe(): Promise<MeResponse> {
  const res = await fetch("/api/me");
  if (!res.ok) throw new Error("Failed to fetch /api/me");
  return res.json();
}

type ProfilePatch = {
  firstName: string;
  lastName: string;
  phone: string;
  city: string;
  address?: string;
};

async function patchProfile(input: ProfilePatch) {
  const res = await fetch("/api/me/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Failed to update profile");
  return res.json();
}

type NurseProfilePatch = {
  licenseNumber: string;
  specialization: string;
  isAvailable?: boolean;
};

async function patchNurseProfile(input: NurseProfilePatch) {
  const res = await fetch("/api/me/nurse", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Failed to update nurse profile");
  return res.json();
}

export function useUserProfile() {
  const qc = useQueryClient();

  const meQuery = useQuery({
    queryKey: ME_KEY,
    queryFn: fetchMe,
    staleTime: 5_000,
  });

  const mutateProfile = useMutation({
    mutationFn: patchProfile,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ME_KEY });
    },
  });

  const mutateNurseProfile = useMutation({
    mutationFn: patchNurseProfile,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ME_KEY });
    },
  });

  const me = meQuery.data;
  // Safely extract user only if ok:true and user exists
  const user = me && "ok" in me && me.ok && me.user ? me.user : null;
  const profileComplete = !!user?.profileComplete;

  return {
    me,
    user,
    profileComplete,
    isLoading: meQuery.isLoading,
    isFetching: meQuery.isFetching,
    error: meQuery.error,
    refetch: meQuery.refetch,
    mutateProfile,
    mutateNurseProfile,
  };
}
