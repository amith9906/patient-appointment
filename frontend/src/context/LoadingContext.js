import React, { createContext, useContext, useState, useEffect } from 'react';
import { subscribeToLoading } from '../services/api';

const LoadingContext = createContext({
  isLoading: false,
  requestCount: 0,
});

export const LoadingProvider = ({ children }) => {
  const [loadingState, setLoadingState] = useState({
    isLoading: false,
    requestCount: 0,
  });

  useEffect(() => {
    const unsubscribe = subscribeToLoading((isLoading, requestCount) => {
      setLoadingState({ isLoading, requestCount });
    });
    return unsubscribe;
  }, []);

  return (
    <LoadingContext.Provider value={loadingState}>
      {children}
    </LoadingContext.Provider>
  );
};

export const useLoading = () => useContext(LoadingContext);
