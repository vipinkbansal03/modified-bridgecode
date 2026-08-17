"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { requestForToken, onMessageListener } from "../../lib/firebase";
import { apiClient as api } from "../../lib/apiClient";
import { useRouter } from "next/navigation";

interface Notification {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  link?: string;
}

export function NotificationBell({ role = "customer" }: { role?: "admin" | "customer" }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | "default">("default");
  const router = useRouter();

  useEffect(() => {
    fetchNotifications();

    if ("Notification" in window) {
      setPermissionStatus(Notification.permission);
      if (Notification.permission === "granted") {
        initFirebase();
      }
    }

    onMessageListener().then((payload: any) => {
      // Add notification to state
      fetchNotifications(); // Refresh list to get new DB entry
    }).catch(err => console.log('failed: ', err));

  }, [role]);

  const initFirebase = async () => {
    const isTokenValid = (t: string | null) => t && t !== "null" && t !== "undefined";
    const storedToken = role === "admin" ? localStorage.getItem("admin_token") : localStorage.getItem("customer_token");
    if (!isTokenValid(storedToken)) return; // Only init if logged in

    const token = await requestForToken();
    if (token) {
      // Register token with backend
      try {
        await api.post(`/notifications/${role}/register-token`, {
          token,
          deviceType: "web"
        }, {
          headers: { Authorization: `Bearer ${storedToken}` }
        });
      } catch (err) {
        console.error("Failed to register token", err);
      }
    }
    
    if ("Notification" in window) {
      setPermissionStatus(Notification.permission);
    }
  };

  const isTokenValid = (t: string | null) => t && t !== "null" && t !== "undefined";

  const fetchNotifications = async () => {
    const storedToken = role === "admin" ? localStorage.getItem("admin_token") : localStorage.getItem("customer_token");
    if (!isTokenValid(storedToken)) return; // Only fetch if logged in
    
    try {
      const { data } = await api.get(`/notifications/${role}/mine`, {
        headers: { Authorization: `Bearer ${storedToken}` }
      });
      const unread = data.data.filter((n: Notification) => !n.isRead).length;
      setNotifications(data.data);
      setUnreadCount(unread);
    } catch (error) {
      console.error("Failed to fetch notifications", error);
    }
  };

  const markAsRead = async (id: string) => {
    const storedToken = role === "admin" ? localStorage.getItem("admin_token") : localStorage.getItem("customer_token");
    if (!isTokenValid(storedToken)) return;

    try {
      await api.patch(`/notifications/${role}/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${storedToken}` }
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to mark notification as read", error);
    }
  };

  return (
    <div className="relative inline-block">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded hover:bg-gray-100 transition-colors border border-transparent focus:border-gray-300"
      >
        <Bell className="w-5 h-5 text-[#333]" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-[#d93025] rounded-full border border-white shadow-sm">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-[340px] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.15)] z-50 border border-[#e0e0e0] rounded-sm">
          {/* Header Rows */}
          <div className="px-4 py-3 flex justify-between items-center">
            <h3 className="text-[13px] font-medium text-[#777]">Notifications</h3>
            <span className="text-[12px] text-[#777]">Live</span>
          </div>
          <div className="px-4 pb-2 border-b border-[#e0e0e0] flex justify-between items-center">
            <Link 
              href={role === 'admin' ? '/admin/notifications' : '/account/notifications'} 
              className="text-[12px] text-[#0056b3] hover:underline"
              onClick={() => setIsOpen(false)}
            >
              View all notifications
            </Link>
            <button 
              onClick={async (e) => {
                e.stopPropagation();
                const unread = notifications.filter(n => !n.isRead);
                if (unread.length === 0) return;
                
                // Optimistic update
                setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
                setUnreadCount(0);
                
                await Promise.all(unread.map(n => markAsRead(n.id)));
              }}
              className="text-[12px] text-[#555] hover:text-[#000]"
            >
              Mark all as read
            </button>
          </div>
          
          {permissionStatus !== "granted" && permissionStatus !== "denied" && (
            <div className="p-3 bg-[#f8f9fa] border-b border-[#e0e0e0] flex justify-between items-center">
              <p className="text-[12px] text-[#555]">Get live updates</p>
              <button 
                onClick={initFirebase}
                className="text-[11px] font-semibold px-2 py-1 bg-[#0056b3] text-white rounded hover:bg-[#004494] transition"
              >
                Enable
              </button>
            </div>
          )}

          <div className="max-h-[350px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <p className="text-[13px]">No notifications yet</p>
              </div>
            ) : (
              <ul className="flex flex-col">
                {notifications.slice(0, 5).map((notif) => (
                  <li 
                    key={notif.id} 
                    className="p-4 border-b border-[#e0e0e0] hover:bg-[#f8f9fa] transition-colors cursor-pointer last:border-b-0"
                    onClick={async (e) => {
                      e.preventDefault();
                      if (!notif.isRead) {
                        // Optimistic update
                        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
                        setUnreadCount(prev => Math.max(0, prev - 1));
                        await markAsRead(notif.id);
                      }
                      if (notif.link) {
                        router.push(notif.link);
                      }
                    }}
                  >
                    <p className={`text-[13px] ${notif.isRead ? 'font-medium text-[#333]' : 'font-bold text-[#000]'} mb-1`}>
                      {notif.title}
                    </p>
                    <p className="text-[12px] text-[#888] leading-relaxed">
                      {notif.message}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
