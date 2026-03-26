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
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
      <div className="bg-surface-container-high rounded-[2.5rem] p-10 max-w-md w-full shadow-3xl border border-outline-variant/20 animate-in zoom-in-95 duration-300">
        <h2 className={`text-2xl font-headline font-black mb-4 uppercase tracking-tight ${isDanger ? 'text-error' : 'text-on-surface'}`}>
          {title}
        </h2>
        <p className="text-on-surface-variant text-sm mb-10 leading-relaxed font-medium">
          {message}
        </p>
        
        <div className="flex gap-4">
          <button 
            onClick={onClose} 
            className="flex-1 py-4 text-on-surface-variant font-bold hover:text-on-surface transition-colors uppercase tracking-widest text-[10px]"
          >
            {cancelText}
          </button>
          <button 
            onClick={() => {
              onConfirm();
              onClose();
            }} 
            className={`flex-1 ${isDanger ? 'bg-error-container text-on-error-container shadow-error/10' : 'bg-primary-container text-on-primary-container shadow-primary-container/20'} py-4 rounded-xl font-black uppercase tracking-[0.2em] text-[10px] hover:brightness-110 transition-all shadow-xl active:scale-95`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
