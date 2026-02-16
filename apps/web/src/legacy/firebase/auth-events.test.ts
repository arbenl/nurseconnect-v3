import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Firestore } from "firebase/firestore";
import { onUserSignIn } from "./auth-events";

// Create spies we can assert on
const mockSetDoc = vi.fn();
const mockGetDoc = vi.fn();
const mockDoc = vi.fn();

// Mock only the Firestore functions we use
vi.mock("firebase/firestore", async () => {
  const actual = await vi.importActual<any>("firebase/firestore");
  return {
    ...actual,
    doc: (...args: any[]) => {
      mockDoc(...args);
      return {} as any;
    },
    getDoc: (...args: any[]) => mockGetDoc(...args),
    setDoc: (...args: any[]) => mockSetDoc(...args),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Auth Events", () => {
  it("should create a user profile on first sign-in", async () => {
    // Simulate "doc does not exist" snapshot
    mockGetDoc.mockResolvedValue({ exists: () => false });

    const fakeDb = {} as unknown as Firestore;
    await onUserSignIn(fakeDb, {
      id: "u1",
      email: "a@b.com",
      displayName: "Alice",
    });

    expect(mockDoc).toHaveBeenCalledWith(fakeDb, "users", "u1");
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
  });

  it("should not overwrite an existing user profile", async () => {
    // Simulate "doc exists" snapshot
    mockGetDoc.mockResolvedValue({ exists: () => true });

    const fakeDb = {} as unknown as Firestore;
    await onUserSignIn(fakeDb, {
      id: "u2",
      email: "b@b.com",
      displayName: "Bob",
    });

    expect(mockSetDoc).not.toHaveBeenCalled();
  });
});
