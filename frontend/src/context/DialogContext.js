import React, { createContext, useContext, useState, useCallback } from 'react';
import Modal from '../components/Modal';

const DialogContext = createContext({
  confirm: () => Promise.resolve(false),
  alert: () => Promise.resolve(),
});

export const DialogProvider = ({ children }) => {
  const [dialogState, setDialogState] = useState({
    isOpen: false,
    mode: 'confirm', // 'confirm' or 'alert'
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    type: 'primary', // 'primary', 'danger', 'warning'
    resolveRef: null,
  });

  const confirm = useCallback(({ title = 'Confirm Action', message = 'Are you sure you want to proceed?', confirmText = 'Confirm', cancelText = 'Cancel', type = 'danger' }) => {
    return new Promise((resolve) => {
      setDialogState({
        isOpen: true,
        mode: 'confirm',
        title,
        message,
        confirmText,
        cancelText,
        type,
        resolveRef: resolve,
      });
    });
  }, []);

  const alert = useCallback(({ title = 'Notice', message = '', confirmText = 'OK', type = 'primary' }) => {
    return new Promise((resolve) => {
      setDialogState({
        isOpen: true,
        mode: 'alert',
        title,
        message,
        confirmText,
        cancelText: 'Close',
        type,
        resolveRef: resolve,
      });
    });
  }, []);

  const handleClose = (result) => {
    if (dialogState.resolveRef) {
      dialogState.resolveRef(result);
    }
    setDialogState((prev) => ({ ...prev, isOpen: false, resolveRef: null }));
  };

  const getButtonClass = () => {
    if (dialogState.type === 'danger') return 'bg-red-600 hover:bg-red-700 text-white';
    if (dialogState.type === 'warning') return 'bg-amber-600 hover:bg-amber-700 text-white';
    return 'bg-blue-600 hover:bg-blue-700 text-white';
  };

  return (
    <DialogContext.Provider value={{ confirm, alert }}>
      {children}

      <Modal
        isOpen={dialogState.isOpen}
        onClose={() => handleClose(false)}
        title={dialogState.title}
        size="sm"
      >
        <div className="space-y-4">
          <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-line">
            {dialogState.message}
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            {dialogState.mode === 'confirm' && (
              <button
                type="button"
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition"
                onClick={() => handleClose(false)}
              >
                {dialogState.cancelText}
              </button>
            )}
            <button
              type="button"
              className={`px-4 py-2 text-xs font-semibold rounded-lg shadow-sm transition ${getButtonClass()}`}
              onClick={() => handleClose(true)}
            >
              {dialogState.confirmText}
            </button>
          </div>
        </div>
      </Modal>
    </DialogContext.Provider>
  );
};

export const useDialog = () => useContext(DialogContext);
