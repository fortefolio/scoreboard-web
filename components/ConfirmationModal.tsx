"use client";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
}

export default function ConfirmationModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = "Confirm", 
  cancelText = "Cancel",
  isDanger = false
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-200">
      <div className="bg-surface-container rounded-2xl p-6 sm:p-7 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-outline-variant animate-in zoom-in-95 duration-200">
        <h2 className={`text-lg sm:text-xl font-semibold mb-2 tracking-tight ${isDanger ? 'text-error' : 'text-text-primary'}`}>
          {title}
        </h2>
        <p className="text-text-muted text-xs sm:text-sm mb-6 leading-relaxed">
          {message}
        </p>
        
        <div className="flex gap-3">
          <button 
            onClick={onClose} 
            className="flex-1 py-2.5 px-4 bg-transparent hover:bg-surface-container-high border border-outline-variant text-text-secondary rounded-lg font-medium text-xs transition-colors"
          >
            {cancelText}
          </button>
          <button 
            onClick={() => {
              onConfirm();
              onClose();
            }} 
            className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-xs transition-colors text-white ${
              isDanger 
                ? 'bg-error hover:bg-error/90' 
                : 'bg-primary hover:bg-primary/90'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
