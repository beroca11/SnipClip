import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const sessionToken = localStorage.getItem("sessionToken");
  const userKey = localStorage.getItem("userKey");
  
  const headers: Record<string, string> = data ? { "Content-Type": "application/json" } : {};
  
  // Use session token if available, otherwise fall back to userKey
  if (sessionToken) {
    headers["x-session-token"] = sessionToken;
  } else if (userKey) {
    headers["x-user-id"] = userKey;
  }
  
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  // Handle authentication errors gracefully
  if (res.status === 401) {
    // Clear invalid credentials
    localStorage.removeItem("sessionToken");
    localStorage.removeItem("userKey");
    
    // If this is a login request, don't throw
    if (url.includes("/api/auth/login")) {
      return res;
    }
    
    // For other requests, redirect to login or show login modal
    window.location.reload();
    throw new Error("Authentication required");
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const sessionToken = localStorage.getItem("sessionToken");
    const userKey = localStorage.getItem("userKey");
    
    const headers: Record<string, string> = {};
    
    // Use session token if available, otherwise fall back to userKey
    if (sessionToken) {
      headers["x-session-token"] = sessionToken;
    } else if (userKey) {
      headers["x-user-id"] = userKey;
    }
    
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
      headers,
    });

    if (res.status === 401) {
      // Clear invalid credentials
      localStorage.removeItem("sessionToken");
      localStorage.removeItem("userKey");
      
      if (unauthorizedBehavior === "returnNull") {
        return null;
      }
      
      // For throw behavior, reload the page to show login
      window.location.reload();
      throw new Error("Authentication required");
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
