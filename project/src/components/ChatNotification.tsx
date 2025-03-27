import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';

interface NotificationProps {
  senderName: string;
  message: string;
}

export function showChatNotification({ senderName, message }: NotificationProps) {
  toast.custom((t) => (
    <AnimatePresence>
      {t.visible && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="bg-white rounded-lg shadow-lg p-4 flex items-start max-w-sm"
        >
          <div>
            <h4 className="font-semibold text-gray-900">{senderName}</h4>
            <p className="text-gray-600 text-sm line-clamp-2">{message}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  ), {
    duration: 4000,
    position: 'bottom-right',
  });
}

export default function ChatNotificationProvider() {
  return <Toaster />;
}