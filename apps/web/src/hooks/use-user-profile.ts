import { UserProfile } from "@nurseconnect/contracts";
import { useQuery } from "@tanstack/react-query";

async function getUserProfile(uid: string): Promise<UserProfile> {
  const res = await fetch(`/api/user?id=${uid}`);
  if (!res.ok) {
    throw new Error("Failed to fetch user data");
  }
  const data = await res.json();
  return UserProfile.parse(data);
}

export function useUserProfile(uid: string) {
  return useQuery({
    queryKey: ["user", uid],
    queryFn: () => getUserProfile(uid),
    staleTime: 30_000,
    retry: 1,
    enabled: !!uid,
  });
}
