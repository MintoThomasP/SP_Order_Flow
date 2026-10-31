"use client";

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNotifications } from "@/context/notification-context";
import { soundNotifier } from "@/lib/sound";
import { apiClient, API_BASE_URL } from "@/services/api/client";

export interface LiveActivityEvent {
  id: string;
  event_type: string;
  title: string;
  message: string;
  order_number: string;
  order_id?: string;
  status_code?: string;
  status_name?: string;
  actor_name?: string;
  link?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

interface LiveEventsContextType {
  isConnected: boolean;
  isMuted: boolean;
  toggleSound: () => void;
  testSound: () => void;
  simulateTestOrder: () => Promise<void>;
  simulateStatusChange: () => Promise<void>;
  lastEvent: LiveActivityEvent | null;
}

const LiveEventsContext = createContext<LiveEventsContextType | undefined>(undefined);

export const LiveEventsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const { addNotification } = useNotifications();

  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(() => soundNotifier.getMuted());
  const [lastEvent, setLastEvent] = useState<LiveActivityEvent | null>(null);

  const processedIdsRef = useRef<Set<string>>(new Set());
  const lastTimestampRef = useRef<string>(new Date(Date.now() - 60 * 1000).toISOString());
  const eventSourceRef = useRef<EventSource | null>(null);

  const toggleSound = useCallback(() => {
    const nextMuted = soundNotifier.toggleMute();
    setIsMuted(nextMuted);
    if (!nextMuted) {
      soundNotifier.testSound();
    }
  }, []);

  const testSound = useCallback(() => {
    soundNotifier.testSound();
  }, []);

  // Handler for incoming broadcast events
  const handleIncomingEvent = useCallback(
    (event: LiveActivityEvent) => {
      if (!event.id || processedIdsRef.current.has(event.id)) {
        return;
      }
      processedIdsRef.current.add(event.id);
      setLastEvent(event);

      // 1. Play synthesized audio notification chime
      if (event.event_type === "ORDER_CREATED") {
        soundNotifier.playNewOrder();
      } else if (
        event.event_type === "SLA_ALERT" ||
        event.event_type === "DAMAGE_REPRINT" ||
        event.event_type === "PREPRESS_REJECTED"
      ) {
        soundNotifier.playAlert();
      } else {
        soundNotifier.playStatusChange();
      }

      // 2. Display floating toast & add to notifications tray
      const toastType =
        event.event_type === "ORDER_CREATED"
          ? "success"
          : event.event_type === "SLA_ALERT" || event.event_type === "DAMAGE_REPRINT"
          ? "warning"
          : "info";

      addNotification({
        title: event.title,
        message: event.message,
        type: toastType,
        category: "STATUS_SYNC",
        orderNumber: event.order_number,
        link: event.link || "/orders",
      });

      // 3. AUTO-SYNC: Automatically invalidate and refetch all active dashboard queries
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      queryClient.invalidateQueries({ queryKey: ["prepress"] });
      queryClient.invalidateQueries({ queryKey: ["production"] });
      queryClient.invalidateQueries({ queryKey: ["dispatch"] });
      queryClient.invalidateQueries({ queryKey: ["finance"] });
      queryClient.invalidateQueries({ queryKey: ["shopfloor"] });
    },
    [addNotification, queryClient]
  );

  // Poll fallback for resilience across proxy networks
  const pollEvents = useCallback(async () => {
    try {
      const res = await apiClient.get<{ count: number; events: LiveActivityEvent[]; server_time: string }>(
        "/core/events/poll/",
        {
          params: {
            since: lastTimestampRef.current,
            limit: 25,
          },
        }
      );

      if (res.data?.events && res.data.events.length > 0) {
        // Sort chronologically ascending
        const sorted = [...res.data.events].reverse();
        sorted.forEach((ev) => handleIncomingEvent(ev));
      }

      if (res.data?.server_time) {
        lastTimestampRef.current = res.data.server_time;
      }
      setIsConnected(true);
    } catch {
      // Background poll failure handling
    }
  }, [handleIncomingEvent]);

  // Connect to SSE stream and run background polling interval
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Establish SSE stream
    let sse: EventSource | null = null;
    try {
      const streamUrl = `${API_BASE_URL.replace(/\/$/, "")}/core/events/stream/`;

      sse = new EventSource(streamUrl);
      eventSourceRef.current = sse;

      sse.onopen = () => {
        setIsConnected(true);
      };

      sse.onmessage = (messageEvent) => {
        try {
          if (!messageEvent.data || messageEvent.data === ": heartbeat") return;
          const data = JSON.parse(messageEvent.data);
          if (data && data.event_type) {
            handleIncomingEvent(data as LiveActivityEvent);
          }
        } catch {
          // parse ignore
        }
      };

      sse.onerror = () => {
        // Fallback gracefully to polling if SSE disconnected
        setIsConnected(false);
      };
    } catch {
      // SSE initialization fallback
    }

    // Secondary Polling Heartbeat every 4 seconds
    const interval = setInterval(() => {
      pollEvents();
    }, 4000);

    // Initial check
    pollEvents();

    return () => {
      clearInterval(interval);
      if (sse) {
        sse.close();
      }
    };
  }, [handleIncomingEvent, pollEvents]);

  // Manual Simulation Helpers for Quick Staff Testing
  const simulateTestOrder = async () => {
    try {
      await apiClient.post("/core/events/simulate/", {
        event_type: "ORDER_CREATED",
        title: "Test Inbound Order Ingested",
        message: "Simulated POD order received from Peecho gateway.",
        order_number: `SP-2026-T${Math.floor(1000 + Math.random() * 9000)}`,
      });
      await pollEvents();
    } catch (e) {
      console.error("Simulation failed", e);
    }
  };

  const simulateStatusChange = async () => {
    try {
      await apiClient.post("/core/events/simulate/", {
        event_type: "STATUS_CHANGED",
        title: "Order Moved to In Production",
        message: "Press operator Alexander Vance assigned batch to HP Indigo 12000.",
        order_number: "SP-2026-90412",
      });
      await pollEvents();
    } catch (e) {
      console.error("Simulation failed", e);
    }
  };

  return (
    <LiveEventsContext.Provider
      value={{
        isConnected,
        isMuted,
        toggleSound,
        testSound,
        simulateTestOrder,
        simulateStatusChange,
        lastEvent,
      }}
    >
      {children}
    </LiveEventsContext.Provider>
  );
};

export const useLiveEvents = () => {
  const context = useContext(LiveEventsContext);
  if (!context) {
    throw new Error("useLiveEvents must be used within a LiveEventsProvider");
  }
  return context;
};
